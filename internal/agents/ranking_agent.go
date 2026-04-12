package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/memory"
)

// RankingAgent re-ranks candidates using MiniMax as judge.
type RankingAgent struct {
	redis        RedisCacheLayer
	minScore     float64
	maxTokens    int
	minimaxAPIKey string
}

// NewRankingAgent creates a new RankingAgent.
func NewRankingAgent(redis RedisCacheLayer, minimaxAPIKey string) *RankingAgent {
	if minimaxAPIKey == "" {
		minimaxAPIKey = os.Getenv("MINIMAX_API_KEY")
	}
	return &RankingAgent{
		redis:        redis,
		minScore:     0.5,
		maxTokens:    4000,
		minimaxAPIKey: minimaxAPIKey,
	}
}

// RankingConfig holds configuration for the ranking agent.
type RankingConfig struct {
	MinScore      float64 `json:"min_score"`
	MaxTokens     int     `json:"max_tokens"`
	TopN          int     `json:"top_n"`
	UseReranker   bool    `json:"use_reranker"`
	RerankerModel string  `json:"reranker_model,omitempty"`
}

// DefaultRankingConfig returns the default ranking configuration.
func DefaultRankingConfig() RankingConfig {
	return RankingConfig{
		MinScore:    0.5,
		MaxTokens:   4000,
		TopN:        5,
		UseReranker: false, // Use MiniMax as judge by default
	}
}

// RankingInput defines the input schema for RankingAgent.
type RankingInput struct {
	GraphID string          `json:"graph_id"`
	Config  RankingConfig   `json:"config,omitempty"`
	Query   string          `json:"query,omitempty"`
}

// RankingOutput defines the output schema for RankingAgent.
type RankingOutput struct {
	RankedResults    []memory.SearchResult `json:"ranked_results"`
	AssembledContext string               `json:"assembled_context"`
	TokenCount       int                  `json:"token_count"`
	FilteredCount    int                  `json:"filtered_count"`
}

// Execute implements AgentInterface.Execute.
func (r *RankingAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	graphID, _ := task.Input["graph_id"].(string)
	if graphID == "" {
		return nil, fmt.Errorf("graph_id is required")
	}

	config := DefaultRankingConfig()
	if cfg, ok := task.Input["config"].(map[string]any); ok {
		if minScore, ok := cfg["min_score"].(float64); ok {
			config.MinScore = minScore
		}
		if topN, ok := cfg["top_n"].(float64); ok {
			config.TopN = int(topN)
		}
	}

	query, _ := task.Input["query"].(string)

	// Step 1: Read candidates from graph state
	candidates, err := r.readCandidates(ctx, task.Input)
	if err != nil {
		// Fallback: try to get from task.Input directly
		candidates = r.extractCandidatesFromInput(task.Input)
	}

	if len(candidates) == 0 {
		return map[string]any{
			"ranked_results":    []memory.SearchResult{},
			"assembled_context": "",
			"token_count":       0,
			"filtered_count":    0,
		}, nil
	}

	// Step 2: Re-rank using cross-encoder or MiniMax
	ranked, err := r.rerankWithMiniMax(ctx, candidates, query, config)
	if err != nil {
		// Fallback to original scores if MiniMax fails
		ranked = candidates
	}

	// Step 3: Filter by minimum score
	filtered := make([]memory.SearchResult, 0, len(ranked))
	for _, c := range ranked {
		if c.Score >= config.MinScore {
			filtered = append(filtered, c)
		}
	}
	filteredCount := len(ranked) - len(filtered)

	// Step 4: Assemble context within token limit
	topN := config.TopN
	if topN > len(filtered) {
		topN = len(filtered)
	}
	topResults := filtered[:topN]

	assembledContext, tokenCount, err := r.assembleContext(topResults, config.MaxTokens)
	if err != nil {
		return nil, fmt.Errorf("assemble context: %w", err)
	}

	// Step 5: Store in graph state
	if r.redis != nil {
		outputJSON, _ := json.Marshal(topResults)
		r.redis.SetGraphState(ctx, graphID, map[string]interface{}{
			"ranked_results":    string(outputJSON),
			"assembled_context": assembledContext,
		})
	}

	return map[string]any{
		"ranked_results":    topResults,
		"assembled_context": assembledContext,
		"token_count":       tokenCount,
		"filtered_count":    filteredCount,
	}, nil
}

// readCandidates reads candidates from graph state via redis.
func (r *RankingAgent) readCandidates(ctx context.Context, input map[string]any) ([]memory.SearchResult, error) {
	if r.redis == nil {
		return nil, fmt.Errorf("redis not available")
	}

	graphID, _ := input["graph_id"].(string)
	if graphID == "" {
		return nil, fmt.Errorf("graph_id required")
	}

	state, err := r.redis.GetGraphState(ctx, graphID)
	if err != nil {
		return nil, err
	}

	if candidatesJSON, ok := state["rag_candidates"]; ok {
		if jsonStr, ok := candidatesJSON.(string); ok {
			var candidates []memory.SearchResult
			if err := json.Unmarshal([]byte(jsonStr), &candidates); err == nil {
				return candidates, nil
			}
		}
	}

	return nil, fmt.Errorf("no candidates found")
}

// extractCandidatesFromInput extracts candidates directly from task input.
func (r *RankingAgent) extractCandidatesFromInput(input map[string]any) []memory.SearchResult {
	candidatesRaw, ok := input["candidates"]
	if !ok {
		return nil
	}

	candidatesSlice, ok := candidatesRaw.([]any)
	if !ok {
		return nil
	}

	candidates := make([]memory.SearchResult, 0, len(candidatesSlice))
	for _, item := range candidatesSlice {
		itemMap, ok := item.(map[string]any)
		if !ok {
			continue
		}

		id, _ := itemMap["id"].(string)
		score, _ := itemMap["score"].(float64)
		payload, _ := itemMap["payload"].(map[string]any)

		candidates = append(candidates, memory.SearchResult{
			ID:      id,
			Score:   score,
			Payload: payload,
		})
	}

	return candidates
}

// rerankWithMiniMax re-ranks candidates using MiniMax as judge.
func (r *RankingAgent) rerankWithMiniMax(ctx context.Context, candidates []memory.SearchResult, query string, config RankingConfig) ([]memory.SearchResult, error) {
	if query == "" {
		query = "relevant document"
	}

	// If no MiniMax API key, fall back to score-based sorting
	if r.minimaxAPIKey == "" {
		sorted := make([]memory.SearchResult, len(candidates))
		copy(sorted, candidates)
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].Score > sorted[j].Score
		})
		return sorted, nil
	}

	// Build context from candidates for MiniMax evaluation
	var candidateDocs strings.Builder
	for i, c := range candidates {
		docContent := ""
		if content, ok := c.Payload["content"].(string); ok {
			docContent = content
		} else {
			docContent = fmt.Sprintf("Document %d", i+1)
		}
		candidateDocs.WriteString(fmt.Sprintf("[%d] %s\n", i+1, docContent))
	}

	// Prompt MiniMax to evaluate relevance
	prompt := fmt.Sprintf(`Evaluar a relevância dos seguintes documentos para a consulta: "%s"

Documentos:
%s

Para cada documento, indique sua relevância como: alta, média, baixa ou irrelevante.
Responda em JSON array com campos: index (1-based), relevance (alta/média/baixa/irrelevante), reason (breve justificativa).`, query, candidateDocs.String())

	resp, err := r.callMiniMax(ctx, prompt)
	if err != nil {
		// Fallback to score-based sorting on error
		sorted := make([]memory.SearchResult, len(candidates))
		copy(sorted, candidates)
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].Score > sorted[j].Score
		})
		return sorted, nil
	}

	// Parse MiniMax's relevance evaluation
	var evaluations []struct {
		Index      int    `json:"index"`
		Relevance string `json:"relevance"`
	}

	if err := json.Unmarshal([]byte(resp), &evaluations); err != nil {
		// Fallback to score-based sorting on parse error
		sorted := make([]memory.SearchResult, len(candidates))
		copy(sorted, candidates)
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].Score > sorted[j].Score
		})
		return sorted, nil
	}

	// Build relevance map
	relevanceMap := make(map[int]string)
	for _, eval := range evaluations {
		relevanceMap[eval.Index] = eval.Relevance
	}

	// Sort by relevance (alta > média > baixa > irrelevante)
	relevanceOrder := map[string]int{
		"alta":       0,
		"média":      1,
		"baixa":      2,
		"irrelevante": 3,
	}

	sorted := make([]memory.SearchResult, len(candidates))
	copy(sorted, candidates)
	sort.Slice(sorted, func(i, j int) bool {
		relI := relevanceMap[i+1]
		relJ := relevanceMap[j+1]
		orderI := relevanceOrder[relI]
		orderJ := relevanceOrder[relJ]
		if orderI != orderJ {
			return orderI < orderJ
		}
		// Same relevance: use original score
		return sorted[i].Score > sorted[j].Score
	})

	return sorted, nil
}

// callMiniMax calls the MiniMax API for text generation.
func (r *RankingAgent) callMiniMax(ctx context.Context, prompt string) (string, error) {
	if r.minimaxAPIKey == "" {
		return "", fmt.Errorf("minimax API key not configured")
	}

	reqBody := MiniMaxRequest{
		Model: "MiniMax-M2",
		Messages: []MiniMaxMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens: 2000,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	endpoint := "https://api.minimax.io/v1/messages"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+r.minimaxAPIKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("anthropic-dangerous-direct-browser-access", "true")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("MiniMax API returned status %d", resp.StatusCode)
	}

	var result MiniMaxResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(result.Content) == 0 || result.Content[0].Text == "" {
		return "", fmt.Errorf("empty response from MiniMax")
	}

	return result.Content[0].Text, nil
}

// assembleContext combines top results into a single context string.
func (r *RankingAgent) assembleContext(results []memory.SearchResult, maxTokens int) (string, int, error) {
	if len(results) == 0 {
		return "", 0, nil
	}

	maxChars := maxTokens * 4 // Approximate: 4 chars per token

	var sb strings.Builder
	for i, res := range results {
		sb.WriteString(fmt.Sprintf("--- Document %d (score: %.2f) ---\n", i+1, res.Score))

		// Extract content from payload
		if content, ok := res.Payload["content"].(string); ok {
			sb.WriteString(content)
		} else {
			// Fallback: serialize payload as JSON
			payloadJSON, _ := json.Marshal(res.Payload)
			sb.WriteString(string(payloadJSON))
		}
		sb.WriteString("\n\n")

		// Check if we're exceeding the token limit
		if sb.Len() > maxChars {
			// Truncate to fit
			truncated := sb.String()[:maxChars]
			// Try to cut at a sentence boundary
			if lastDot := strings.LastIndex(truncated, "."); lastDot > maxChars/2 {
				truncated = truncated[:lastDot+1]
			}
			return truncated, sb.Len() / 4, nil
		}
	}

	return sb.String(), sb.Len() / 4, nil
}

// AgentType implements AgentInterface.AgentType.
func (r *RankingAgent) AgentType() string {
	return "ranking"
}

// MaxRetries implements AgentInterface.MaxRetries.
func (r *RankingAgent) MaxRetries() int {
	return 2
}

// TimeoutMs implements AgentInterface.TimeoutMs.
func (r *RankingAgent) TimeoutMs() int {
	return 20000 // 20 seconds
}

// Ensure RankingAgent implements AgentInterface.
var _ AgentInterface = (*RankingAgent)(nil)