package agents

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/gemini"
	"github.com/will-zappro/hvacr-swarm/internal/memory"
	"github.com/will-zappro/hvacr-swarm/internal/rag"
)

// RAGIndexerAgent handles indexing HVAC manuals into Qdrant.
// Flow: PDF/URL -> Verify (qwen2.5-vl) -> Chunk -> WhitelistCheck -> Index to Qdrant
type RAGIndexerAgent struct {
	verifier    *rag.Verifier
	chunker     *rag.Chunker
	whitelist   *rag.WhitelistManager
	qdrant      *memory.QdrantLayer
	embedder    gemini.EmbedderInterface
	httpClient  *http.Client
	tmpDir      string
}

// NewRAGIndexerAgent creates a new RAG indexer agent.
func NewRAGIndexerAgent(
	embedder gemini.EmbedderInterface,
	qdrant *memory.QdrantLayer,
	whitelist *rag.WhitelistManager,
) *RAGIndexerAgent {
	return &RAGIndexerAgent{
		verifier:   rag.NewVerifier(),
		chunker:    rag.NewChunker(),
		whitelist:  whitelist,
		qdrant:     qdrant,
		embedder:   embedder,
		httpClient: &http.Client{Timeout: 60 * time.Second},
		tmpDir:     "/tmp/rag_indexer",
	}
}

// RAGIndexerInput defines input for the indexer agent.
type RAGIndexerInput struct {
	Source     string            `json:"source"` // PDF path or URL
	Brand      string            `json:"brand,omitempty"`
	Model      string            `json:"model,omitempty"`
	Codigo     string            `json:"codigo,omitempty"` // Model code for whitelist check
	BTU        int               `json:"btu,omitempty"`
	Type       string            `json:"type,omitempty"`
	Technology string            `json:"technology,omitempty"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// RAGIndexerOutput defines output from the indexer agent.
type RAGIndexerOutput struct {
	Success        bool                    `json:"success"`
	IndexedCount   int                     `json:"indexed_count"`
	ChunkCount     int                     `json:"chunk_count"`
	Validation     *rag.ValidationResult   `json:"validation,omitempty"`
	WhitelistHit   bool                    `json:"whitelist_hit"`
	Rejected       bool                    `json:"rejected"`
	RejectReason   string                  `json:"reject_reason,omitempty"`
	Chunks         []rag.ChunkResult       `json:"chunks,omitempty"`
	SourceHash     string                  `json:"source_hash"`
	ModelID        string                  `json:"model_id"`
}

// Execute indexes a PDF or URL to Qdrant after verification and chunking.
func (a *RAGIndexerAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	// Parse input
	source, ok := task.Input["source"].(string)
	if !ok || source == "" {
		return nil, fmt.Errorf("source (PDF path or URL) is required")
	}

	codigo, _ := task.Input["codigo"].(string)
	brand, _ := task.Input["brand"].(string)
	model, _ := task.Input["model"].(string)
	btu, _ := task.Input["btu"].(int)
	indexerType, _ := task.Input["type"].(string)
	technology, _ := task.Input["technology"].(string)

	// Build metadata
	metadata := a.buildMetadata(brand, model, codigo, btu, indexerType, technology, task.Input)

	// Step 1: Whitelist check first (skip verification if already whitelisted)
	if codigo != "" && a.whitelist.IsWhitelisted(codigo) {
		return map[string]any{
			"success":        true,
			"whitelist_hit":  true,
			"rejected":       false,
			"reject_reason":  "",
			"indexed_count":  0,
			"chunk_count":    0,
			"validation":     nil,
			"model_id":       codigo,
			"source_hash":    "",
		}, nil
	}

	// Step 2: Fetch or verify local file
	var localPath string
	var sourceHash string
	var err error

	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
		localPath, sourceHash, err = a.downloadPDF(ctx, source)
		if err != nil {
			return nil, fmt.Errorf("download PDF: %w", err)
		}
		defer os.Remove(localPath)
	} else {
		localPath = source
		sourceHash, err = a.hashFile(source)
		if err != nil {
			return nil, fmt.Errorf("hash file: %w", err)
		}
	}

	// Step 3: Check blacklist (skip if already whitelisted by codigo)
	if a.whitelist.IsBlacklisted(sourceHash) {
		return map[string]any{
			"success":       false,
			"whitelist_hit": false,
			"rejected":      true,
			"reject_reason": "blacklisted_manual",
			"indexed_count": 0,
			"chunk_count":   0,
			"source_hash":    sourceHash,
			"model_id":      codigo,
		}, nil
	}

	// Step 4: Verify with qwen2.5-vl
	validationResult, err := a.verifier.VerifyFromFile(ctx, localPath)
	if err != nil {
		return nil, fmt.Errorf("verify: %w", err)
	}

	// Step 5: Check whitelist via validation result indicators
	if !validationResult.ShouldApprove() {
		reason := validationResult.GetRejectionReason()
		// Add to blacklist for future fast-rejection
		a.whitelist.AddToBlacklist(&rag.BlacklistEntry{
			ID:              sourceHash,
			ManualHash:      sourceHash,
			SourceURL:       source,
			RejectionReason: reason,
			RejectedAt:      time.Now(),
			RejectedBy:      "qwen2.5-vl",
			QwenConfidence:  validationResult.Confidence,
		})
		return map[string]any{
			"success":       false,
			"whitelist_hit": false,
			"rejected":      true,
			"reject_reason": reason,
			"validation":    validationResult,
			"indexed_count": 0,
			"chunk_count":   0,
			"source_hash":   sourceHash,
			"model_id":      codigo,
		}, nil
	}

	// Step 6: Chunk the document
	chunks, err := a.chunker.ChunkFromPDF(localPath, metadata)
	if err != nil {
		return nil, fmt.Errorf("chunk: %w", err)
	}

	if len(chunks) == 0 {
		return nil, fmt.Errorf("no chunks generated from document")
	}

	// Step 7: Index chunks to Qdrant
	indexedCount, err := a.indexChunks(ctx, chunks, codigo, sourceHash)
	if err != nil {
		return nil, fmt.Errorf("index chunks: %w", err)
	}

	// Step 8: Add to whitelist if codigo provided
	if codigo != "" {
		a.whitelist.AddToWhitelist(&rag.WhitelistEntry{
			ID:             codigo,
			Codigo:         codigo,
			NomeCompleto:   model,
			Marca:          brand,
			Serie:          "",
			CapacidadeBTU:  btu,
			Tipo:           indexerType,
			Tecnologia:     technology,
			IsApproved:     true,
			ApprovedAt:    time.Now(),
			Source:        "rag_indexer:" + source,
		})
	}

	return map[string]any{
		"success":        true,
		"whitelist_hit":  false,
		"rejected":       false,
		"reject_reason":  "",
		"indexed_count":  indexedCount,
		"chunk_count":    len(chunks),
		"validation":     validationResult,
		"chunks":         chunks,
		"source_hash":    sourceHash,
		"model_id":       codigo,
	}, nil
}

// buildMetadata constructs metadata map from input fields.
func (a *RAGIndexerAgent) buildMetadata(brand, model, codigo string, btu int, indexerType, technology string, input map[string]any) map[string]string {
	m := make(map[string]string)

	if brand != "" {
		m["brand"] = brand
	}
	if model != "" {
		m["model"] = model
	}
	if codigo != "" {
		m["codigo"] = codigo
	}
	if btu > 0 {
		m["btu"] = fmt.Sprintf("%d", btu)
	}
	if indexerType != "" {
		m["type"] = indexerType
	}
	if technology != "" {
		m["technology"] = technology
	}

	// Merge additional metadata
	if meta, ok := input["metadata"].(map[string]string); ok {
		for k, v := range meta {
			if v != "" {
				m[k] = v
			}
		}
	}

	return m
}

// downloadPDF downloads a PDF from URL to temp file.
func (a *RAGIndexerAgent) downloadPDF(ctx context.Context, url string) (string, string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", "", fmt.Errorf("create request: %w", err)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("fetch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	// Ensure temp dir exists
	if err := os.MkdirAll(a.tmpDir, 0755); err != nil {
		return "", "", fmt.Errorf("mkdir: %w", err)
	}

	// Generate temp file
	tmpFile := filepath.Join(a.tmpDir, fmt.Sprintf("manual_%d.pdf", time.Now().UnixNano()))
	f, err := os.Create(tmpFile)
	if err != nil {
		return "", "", fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	// Write and compute hash
	hash := sha256.New()
	writer := io.MultiWriter(f, hash)

	if _, err := io.Copy(writer, resp.Body); err != nil {
		os.Remove(tmpFile)
		return "", "", fmt.Errorf("write: %w", err)
	}

	return tmpFile, hex.EncodeToString(hash.Sum(nil)), nil
}

// hashFile computes SHA-256 hash of a file.
func (a *RAGIndexerAgent) hashFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:]), nil
}

// indexChunks embeds and indexes chunks to Qdrant.
func (a *RAGIndexerAgent) indexChunks(ctx context.Context, chunks []rag.ChunkResult, modelID, sourceHash string) (int, error) {
	if a.qdrant == nil || a.embedder == nil {
		return 0, fmt.Errorf("qdrant or embedder not configured")
	}

	// Collect texts for batch embedding
	texts := make([]string, len(chunks))
	for i, chunk := range chunks {
		texts[i] = chunk.Text
	}

	// Batch embed
	embeddings, err := a.embedder.BatchEmbed(ctx, texts)
	if err != nil {
		return 0, fmt.Errorf("batch embed: %w", err)
	}

	// Index each chunk
	indexed := 0
	for i, chunk := range chunks {
		vector := embeddings[i]
		if len(vector) == 0 {
			continue
		}

		payload := map[string]any{
			"model_id":    modelID,
			"source_hash": sourceHash,
			"chunk_text":  chunk.Text,
			"content_type": chunk.ContentType,
			"section":      chunk.Section,
			"token_count": chunk.TokenCount,
			"chunk_index": i,
		}

		// Add metadata to payload
		for k, v := range chunk.Metadata {
			payload[k] = v
		}

		if err := a.qdrant.UpsertPoint(ctx, chunk.ID, vector, payload); err != nil {
			// Log but continue
			continue
		}
		indexed++
	}

	return indexed, nil
}

// AgentType implements AgentInterface.AgentType.
func (a *RAGIndexerAgent) AgentType() string {
	return "rag_indexer"
}

// MaxRetries implements AgentInterface.MaxRetries.
func (a *RAGIndexerAgent) MaxRetries() int {
	return 2
}

// TimeoutMs implements AgentInterface.TimeoutMs.
func (a *RAGIndexerAgent) TimeoutMs() int {
	return 120000 // 2 minutes for PDF processing
}

// Ensure RAGIndexerAgent implements AgentInterface.
var _ AgentInterface = (*RAGIndexerAgent)(nil)
