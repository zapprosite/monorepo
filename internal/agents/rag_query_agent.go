package agents

import (
	"context"
	"fmt"
	"strings"

	"github.com/will-zappro/hvacr-swarm/internal/rag"
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
}

// NewRAGQueryAgent creates a new RAG query agent
func NewRAGQueryAgent() *RAGQueryAgent {
	return &RAGQueryAgent{
		chunker: rag.NewChunker(),
		refiner: rag.NewRefiner(),
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

// Execute processes a RAG query
func (a *RAGQueryAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	query, ok := task.Input["query"].(string)
	if !ok {
		return nil, fmt.Errorf("query is required")
	}

	brand, _ := task.Input["brand"].(string)
	model, _ := task.Input["model"].(string)
	errorCode, _ := task.Input["error_code"].(string)

	// Build metadata from input
	metadata := make(map[string]string)
	if brand != "" {
		metadata["brand"] = brand
	}
	if model != "" {
		metadata["model"] = model
	}
	if errorCode != "" {
		metadata["error_code"] = errorCode
	}

	// TODO: Query Qdrant for relevant chunks
	// For now, use error code database directly

	// Try to find error code match
	if errorCode != "" {
		if result := parser.GetErrorCode(brand, errorCode); result != nil {
			// High confidence for direct error code match
			refined := a.refiner.RefineDirect(
				formatErrorCodeResponse(result),
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
		"Noitei encontrar informação para: "+query,
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