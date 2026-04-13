package agents

import (
	"context"
	"fmt"
	"strings"

	"github.com/will-zappro/hvacr-swarm/internal/ollama"
	"github.com/will-zappro/hvacr-swarm/internal/rag"
	"github.com/will-zappro/hvacr-swarm/internal/rag/qdrant"
	"github.com/will-zappro/hvacr-swarm/internal/rag/parser"
)

// RAGQueryInput defines input for RAG query agent
type RAGQueryInput struct {
	Query       string            `json:"query"`
	Brand       string            `json:"brand,omitempty"`
	Model       string            `json:"model,omitempty"`
	ErrorCode   string            `json:"error_code,omitempty"`
	BTU         int               `json:"btu,omitempty"`
	Type        string            `json:"type,omitempty"` // split, multi-split, etc
	Technology  string            `json:"technology,omitempty"` // inverter, convencional
}

// RAGQueryOutput defines output from RAG query agent
type RAGQueryOutput struct {
	Response     string            `json:"response"`
	Confidence   float64           `json:"confidence"`
	Source       string            `json:"source"`
	ChunksUsed   int               `json:"chunks_used"`
	ErrorCode    string            `json:"error_code,omitempty"`
	NeedsTech    bool              `json:"needs_technician"`
}

// RAGQueryAgent handles RAG queries with confidence-based refinement
type RAGQueryAgent struct {
	chunker         *rag.Chunker
	refiner         *rag.Refiner
	verifier        *rag.Verifier
	whitelistManager *rag.WhitelistManager
	qdrantClient    *qdrant.Client
	embedder        *ollama.Embedder
}

// NewRAGQueryAgent creates a new RAG query agent with default Ollama embedder and Qdrant client
func NewRAGQueryAgent() *RAGQueryAgent {
	embedder := ollama.NewEmbedder()
	return &RAGQueryAgent{
		chunker: rag.NewChunker(),
		refiner: rag.NewRefiner(),
		embedder: embedder,
	}
}

// NewRAGQueryAgentWithDeps creates a RAG query agent with dependency injection
func NewRAGQueryAgentWithDeps(chunker *rag.Chunker, refiner *rag.Refiner, verifier *rag.Verifier, whitelistManager *rag.WhitelistManager) *RAGQueryAgent {
	return &RAGQueryAgent{
		chunker:         chunker,
		refiner:         refiner,
		verifier:        verifier,
		whitelistManager: whitelistManager,
	}
}

// NewRAGQueryAgentWithQdrant creates a RAG query agent with Qdrant and Ollama embedder for vector search
func NewRAGQueryAgentWithQdrant(qdrantAddr string, chunker *rag.Chunker, refiner *rag.Refiner, verifier *rag.Verifier, whitelistManager *rag.WhitelistManager) (*RAGQueryAgent, error) {
	qdrantClient, err := qdrant.NewClient(qdrantAddr)
	if err != nil {
		return nil, fmt.Errorf("qdrant client: %w", err)
	}

	embedder := ollama.NewEmbedder()

	agent := &RAGQueryAgent{
		chunker:         chunker,
		refiner:         refiner,
		verifier:        verifier,
		whitelistManager: whitelistManager,
		qdrantClient:    qdrantClient,
		embedder:        embedder,
	}

	return agent, nil
}

// SetQdrantClient sets the Qdrant client and embedder for vector search
func (a *RAGQueryAgent) SetQdrantClient(client *qdrant.Client, embedder *ollama.Embedder) {
	a.qdrantClient = client
	a.embedder = embedder
}

// Execute processes a RAG query with vector search
// Flow: embed query via Ollama -> search Qdrant -> refine results -> return with citations
func (a *RAGQueryAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	query, ok := task.Input["query"].(string)
	if !ok {
		return nil, fmt.Errorf("query is required")
	}

	brand, _ := task.Input["brand"].(string)
	model, _ := task.Input["model"].(string)
	errorCode, _ := task.Input["error_code"].(string)
	btu, _ := task.Input["btu"].(int)

	// Build metadata from input
	metadata := make(map[string]string)
	if brand != "" {
		metadata["brand"] = strings.ToLower(brand)
	}
	if model != "" {
		metadata["model"] = strings.ToLower(model)
	}
	if errorCode != "" {
		metadata["error_code"] = strings.ToUpper(errorCode)
	}
	if btu > 0 {
		metadata["btu"] = fmt.Sprintf("%d", btu)
	}

	// Try vector search first if Qdrant client is available
	if a.qdrantClient != nil && a.embedder != nil {
		result, err := a.executeVectorSearch(ctx, query, metadata)
		if err == nil && result != nil {
			return result, nil
		}
		// Log error but continue to fallback
		fmt.Printf("[rag_query] vector search failed: %v\n", err)
	}

	// Fallback: use error code database directly

	// Try to find error code match
	if errorCode != "" {
		if ecResult := parser.GetErrorCode(brand, errorCode); ecResult != nil {
			// High confidence for direct error code match
			refined := a.refiner.RefineDirect(
				formatErrorCodeResponse(ecResult),
				0.9,
				metadata,
			)
			return map[string]any{
				"response":   refined.Response,
				"confidence": refined.ConfidencePct,
				"source":     refined.Source,
				"error_code": errorCode,
				"needs_tech": refined.NeedsTech,
				"chunks_used": 1,
			}, nil
		}
	}

	// Fallback: search error codes by keyword
	if matches := parser.SearchErrorCodes(query); len(matches) > 0 {
		text := formatErrorCodeList(matches)
		refined := a.refiner.RefineFromChunks(
			[]rag.ChunkResult{
				{
					Text:   text,
					Metadata: metadata,
				},
			},
			query,
		)
		return map[string]any{
			"response":   refined.Response,
			"confidence": refined.ConfidencePct,
			"source":     refined.Source,
			"needs_tech": refined.NeedsTech,
			"chunks_used": len(matches),
		}, nil
	}

	// No match found
	refined := a.refiner.RefineDirect(
		"Não encontrei informação para: "+query,
		0.2,
		metadata,
	)
	return map[string]any{
		"response":   refined.Response,
		"confidence": refined.ConfidencePct,
		"source":     "",
		"needs_tech": true,
		"chunks_used": 0,
	}, nil
}

// executeVectorSearch performs the vector search flow: embed -> Qdrant -> refine
func (a *RAGQueryAgent) executeVectorSearch(ctx context.Context, query string, metadata map[string]string) (map[string]any, error) {
	// Step 1: Generate embedding via Ollama
	embedding, err := a.embedder.Embed(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("embed query: %w", err)
	}

	// Step 2: Build filters from metadata
	filters := buildFiltersFromMetadata(metadata)

	// Step 3: Search Qdrant
	results, err := a.qdrantClient.Search(ctx, embedding, filters, 10)
	if err != nil {
		return nil, fmt.Errorf("qdrant search: %w", err)
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("no results found")
	}

	// Step 4: Convert to ChunkResults for refinement
	chunks := convertSearchResultsToChunks(results)

	// Step 5: Refine results with confidence scoring
	refined := a.refiner.RefineFromChunks(chunks, query)

	// Step 6: Build response with source citations
	source := buildSourceCitation(results)

	return map[string]any{
		"response":   refined.Response,
		"confidence": refined.ConfidencePct,
		"source":     source,
		"needs_tech": refined.NeedsTech,
		"chunks_used": len(results),
		"results":    results,
	}, nil
}

// buildFiltersFromMetadata builds Qdrant filter conditions from query metadata
func buildFiltersFromMetadata(metadata map[string]string) map[string]string {
	filters := make(map[string]string)

	// Only add non-empty filters
	for key, value := range metadata {
		if value != "" {
			filters[key] = value
		}
	}

	return filters
}

// convertSearchResultsToChunks converts Qdrant SearchResults to rag.ChunkResults
func convertSearchResultsToChunks(results []qdrant.SearchResult) []rag.ChunkResult {
	chunks := make([]rag.ChunkResult, 0, len(results))

	for _, r := range results {
		// Extract text from payload
		text := ""
		if chunkText, ok := r.Payload["chunk_text"].(string); ok {
			text = chunkText
		} else if content, ok := r.Payload["content"].(string); ok {
			text = content
		}

		// Extract metadata from payload
		chunkMeta := make(map[string]string)
		for key, value := range r.Payload {
			if strVal, ok := value.(string); ok {
				chunkMeta[key] = strVal
			}
		}

		// Get content type
		contentType := ""
		if ct, ok := r.Payload["content_type"].(string); ok {
			contentType = ct
		}

		// Get section
		section := ""
		if sec, ok := r.Payload["section"].(string); ok {
			section = sec
		}

		chunks = append(chunks, rag.ChunkResult{
			ID:          r.ID,
			Text:        text,
			ContentType: contentType,
			Section:     section,
			Metadata:    chunkMeta,
		})
	}

	return chunks
}

// buildSourceCitation formats source citation from search results
func buildSourceCitation(results []qdrant.SearchResult) string {
	if len(results) == 0 {
		return ""
	}

	// Use the top result for citation
	top := results[0]

	brand := extractStringFromPayload(top.Payload, "brand")
	model := extractStringFromPayload(top.Payload, "model")
	pageRef := extractStringFromPayload(top.Payload, "page_ref")

	if brand == "" && model == "" {
		return ""
	}

	var citation strings.Builder
	if brand != "" {
		citation.WriteString(strings.ToUpper(brand))
	}
	if model != "" {
		citation.WriteString(" ")
		citation.WriteString(model)
	}
	if pageRef != "" {
		citation.WriteString(" (p.")
		citation.WriteString(pageRef)
		citation.WriteString(")")
	} else {
		// Add chunk index if no page ref
		if idx, ok := top.Payload["chunk_index"].(int64); ok {
			citation.WriteString(" (chunk ")
			citation.WriteString(fmt.Sprintf("%d", idx))
			citation.WriteString(")")
		}
	}

	return citation.String()
}

// extractStringFromPayload safely extracts a string from payload
func extractStringFromPayload(payload map[string]interface{}, key string) string {
	if val, ok := payload[key].(string); ok {
		return val
	}
	return ""
}

// AgentType implements AgentInterface.AgentType
func (a *RAGQueryAgent) AgentType() string {
	return "rag_query"
}

// MaxRetries implements AgentInterface.MaxRetries
func (a *RAGQueryAgent) MaxRetries() int {
	return 2
}

// TimeoutMs implements AgentInterface.TimeoutMs
func (a *RAGQueryAgent) TimeoutMs() int {
	return 15000
}

func formatErrorCodeResponse(ec *parser.ErrorCode) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s (%s) - %s\n\n", ec.Name, ec.Code, ec.Description))
	sb.WriteString("Causas comuns:\n")
	for _, cause := range ec.RootCauses {
		sb.WriteString(fmt.Sprintf("• %s\n", cause))
	}
	if len(ec.DiagnosticSteps) > 0 {
		sb.WriteString("\nPassos diagnósticos:\n")
		for _, step := range ec.DiagnosticSteps {
			sb.WriteString(fmt.Sprintf("• %s\n", step))
		}
	}
	if len(ec.ResetProcedure) > 0 {
		sb.WriteString("\nProcedimento de reset:\n")
		for _, step := range ec.ResetProcedure {
			sb.WriteString(fmt.Sprintf("• %s\n", step))
		}
	}
	return sb.String()
}

func formatErrorCodeList(codes []parser.ErrorCode) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Encontrei %d códigos de erro relacionados:\n\n", len(codes)))
	for _, ec := range codes {
		if ec.Code != "" {
			sb.WriteString(fmt.Sprintf("• [%s] %s - %s\n", ec.Code, ec.Name, ec.Description))
		}
	}
	return sb.String()
}

var _ AgentInterface = (*RAGQueryAgent)(nil)