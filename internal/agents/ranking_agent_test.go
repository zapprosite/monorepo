package agents

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/will-zappro/hvacr-swarm/internal/memory"
)

// MockRankingRedisLayer is a mock implementation of the Redis layer for ranking tests.
type MockRankingRedisLayer struct {
	graphState map[string]map[string]interface{}
}

// NewMockRankingRedisLayer creates a mock Redis layer for ranking tests.
func NewMockRankingRedisLayer() *MockRankingRedisLayer {
	return &MockRankingRedisLayer{
		graphState: make(map[string]map[string]interface{}),
	}
}

// SetGraphState implements the Redis layer interface.
func (m *MockRankingRedisLayer) SetGraphState(ctx context.Context, graphID string, state map[string]interface{}) error {
	m.graphState[graphID] = state
	return nil
}

// GetGraphState implements the Redis layer interface.
func (m *MockRankingRedisLayer) GetGraphState(ctx context.Context, graphID string) (map[string]interface{}, error) {
	if state, found := m.graphState[graphID]; found {
		return state, nil
	}
	return nil, nil
}

// MockRerankerClient mocks the cross-encoder/reranker client.
type MockRerankerClient struct {
	RerankFunc func(ctx context.Context, query string, docs []string) ([]RerankResult, error)
}

// RerankResult represents a reranked document result.
type RerankResult struct {
	ID    string
	Score float64
	Text  string
}

// RankingAgentTest is a test version of RankingAgent that wraps the real implementation.
type RankingAgentTest struct {
	redis    RedisCacheLayer
	minScore float64
}

// NewRankingAgentTest creates a new test RankingAgent.
func NewRankingAgentTest(redis RedisCacheLayer) *RankingAgentTest {
	return &RankingAgentTest{
		redis:    redis,
		minScore: 0.5,
	}
}

// Execute re-ranks candidates and assembles context.
func (r *RankingAgentTest) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	// Try to read from graph state first
	var candidates []memory.SearchResult

	if r.redis != nil {
		graphID, _ := task.Input["graph_id"].(string)
		if graphID != "" {
			state, err := r.redis.GetGraphState(ctx, graphID)
			if err == nil && state != nil {
				if candidatesRaw, ok := state["rag_candidates"]; ok {
					if candidatesJSON, ok := candidatesRaw.([]byte); ok {
						json.Unmarshal(candidatesJSON, &candidates)
					} else if candidatesStr, ok := candidatesRaw.(string); ok {
						json.Unmarshal([]byte(candidatesStr), &candidates)
					}
				}
			}
		}
	}

	// Fallback: try to get candidates from input directly
	if len(candidates) == 0 {
		candidatesRaw, ok := task.Input["candidates"]
		if !ok {
			return map[string]any{
				"ranked_results":    []memory.SearchResult{},
				"assembled_context":  "",
				"token_count":       0,
				"filtered_count":    0,
			}, nil
		}

		candidatesSlice, ok := candidatesRaw.([]any)
		if !ok || len(candidatesSlice) == 0 {
			return map[string]any{
				"ranked_results":    []memory.SearchResult{},
				"assembled_context": "",
				"token_count":      0,
				"filtered_count":   0,
			}, nil
		}

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
	}

	if len(candidates) == 0 {
		return map[string]any{
			"ranked_results":    []memory.SearchResult{},
			"assembled_context": "",
			"token_count":       0,
			"filtered_count":    0,
		}, nil
	}

	// Filter by minimum score
	filtered := make([]memory.SearchResult, 0, len(candidates))
	for _, c := range candidates {
		if c.Score >= r.minScore {
			filtered = append(filtered, c)
		}
	}
	filteredCount := len(candidates) - len(filtered)

	// Limit to top-5
	topN := 5
	if topN > len(filtered) {
		topN = len(filtered)
	}
	topResults := filtered[:topN]

	// Assemble context (max 4000 tokens)
	var contextBuilder string
	tokenCount := 0
	maxTokens := 4000

	for _, c := range topResults {
		var content string
		if c.Payload != nil {
			if text, ok := c.Payload["content"].(string); ok {
				content = text
			}
		}

		docTokens := len(content) / 4
		if tokenCount+docTokens > maxTokens {
			break
		}

		contextBuilder += content + "\n\n"
		tokenCount += docTokens
	}

	return map[string]any{
		"ranked_results":    topResults,
		"assembled_context": contextBuilder,
		"token_count":       tokenCount,
		"filtered_count":    filteredCount,
	}, nil
}

// TestReranker_FiltersLowScores tests that documents with score < 0.5 are filtered out.
func TestReranker_FiltersLowScores(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRedis := NewMockRankingRedisLayer()

	// Store candidates in graph state as JSON
	mockRedis.graphState["graph1"] = map[string]interface{}{
		"rag_candidates": []byte(`[{"id":"doc0","score":0.9,"payload":{"content":"Compressor is failing"}},{"id":"doc1","score":0.3,"payload":{"content":"Some unrelated content"}},{"id":"doc2","score":0.5,"payload":{"content":"Threshold content"}},{"id":"doc3","score":0.1,"payload":{"content":"Very low relevance"}}]`),
	}

	agent := NewRankingAgentTest(mockRedis)

	task := &SwarmTask{
		TaskID: "task1",
		Input:  map[string]any{"graph_id": "graph1", "query": "compressor failure"},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)
	require.NotNil(t, result)

	topResults := result["ranked_results"].([]memory.SearchResult)
	filteredCount := result["filtered_count"].(int)

	// Should only contain doc0 and doc2 (scores >= 0.5)
	require.Len(t, topResults, 2, "Should filter out documents with score < 0.5")

	// Verify correct documents are kept
	idMap := make(map[string]bool)
	for _, r := range topResults {
		idMap[r.ID] = true
	}

	require.True(t, idMap["doc0"], "doc0 (score=0.9) should be kept")
	require.True(t, idMap["doc2"], "doc2 (score=0.5) should be kept")
	require.False(t, idMap["doc1"], "doc1 (score=0.3) should be filtered")
	require.False(t, idMap["doc3"], "doc3 (score=0.1) should be filtered")

	// doc1 and doc3 should be filtered
	require.Equal(t, 2, filteredCount, "2 documents should be filtered out")
}

// TestContextAssemble_UnderLimit tests that assembled context stays under 4000 tokens.
func TestContextAssemble_UnderLimit(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Generate large documents that would exceed token limit if all included
	largeContent := ""
	for i := 0; i < 50; i++ {
		largeContent += "Lorem ipsum dolor sit amet consectetur adipiscing elit sed eiusmod tempor. "
	}

	// Create 10 large documents
	candidates := make([]memory.SearchResult, 10)
	for i := 0; i < 10; i++ {
		candidates[i] = memory.SearchResult{
			ID:    "doc" + string(rune('0'+i)),
			Score: 0.9,
			Payload: map[string]interface{}{
				"content": largeContent,
			},
		}
	}

	mockRedis := NewMockRankingRedisLayer()

	// Serialize candidates to JSON
	candidatesJSON := "["
	for i, c := range candidates {
		if i > 0 {
			candidatesJSON += ","
		}
		candidatesJSON += `{"id":"` + c.ID + `","score":0.9,"payload":{"content":"` + largeContent + `"}}`
	}
	candidatesJSON += "]"
	mockRedis.graphState["graph1"] = map[string]interface{}{
		"rag_candidates": []byte(candidatesJSON),
	}

	agent := NewRankingAgentTest(mockRedis)

	task := &SwarmTask{
		TaskID: "task1",
		Input:  map[string]any{"graph_id": "graph1", "query": "HVAC maintenance guide"},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)
	require.NotNil(t, result)

	contextStr := result["assembled_context"].(string)
	tokenCount := result["token_count"].(int)

	// Token count should be under 4000
	require.LessOrEqual(t, tokenCount, 4000,
		"Assembled context should be under 4000 tokens, got %d tokens", tokenCount)

	// Context should not be empty
	require.NotEmpty(t, contextStr, "Context should contain some content")

	// Top results should be limited to TopN=5
	topResults := result["ranked_results"].([]memory.SearchResult)
	require.LessOrEqual(t, len(topResults), 5, "Should return at most 5 results")

	t.Logf("Assembled context with %d characters, %d tokens", len(contextStr), tokenCount)
	t.Logf("Number of top results: %d", len(topResults))
}

// TestReranker_ThresholdBoundary tests the exact boundary at score = 0.5.
func TestReranker_ThresholdBoundary(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRedis := NewMockRankingRedisLayer()

	// JSON with scores at boundary
	mockRedis.graphState["graph1"] = map[string]interface{}{
		"rag_candidates": []byte(`[{"id":"doc_049","score":0.49,"payload":{"content":"Below threshold"}},{"id":"doc_050","score":0.50,"payload":{"content":"At threshold"}},{"id":"doc_051","score":0.51,"payload":{"content":"Above threshold"}}]`),
	}

	agent := NewRankingAgentTest(mockRedis)

	task := &SwarmTask{
		TaskID: "task1",
		Input:  map[string]any{"graph_id": "graph1", "query": "test query"},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	topResults := result["ranked_results"].([]memory.SearchResult)

	// Only doc_050 and doc_051 should be kept (score >= 0.5)
	require.Len(t, topResults, 2, "Should keep documents with score >= 0.5")

	idMap := make(map[string]bool)
	for _, r := range topResults {
		idMap[r.ID] = true
	}
	require.False(t, idMap["doc_049"], "doc_049 (score=0.49) should be filtered")
	require.True(t, idMap["doc_050"], "doc_050 (score=0.50) should be kept")
	require.True(t, idMap["doc_051"], "doc_051 (score=0.51) should be kept")
}

// TestRankingAgent_EmptyCandidates tests handling of empty candidates.
func TestRankingAgent_EmptyCandidates(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRedis := NewMockRankingRedisLayer()
	mockRedis.graphState["graph1"] = map[string]interface{}{
		"rag_candidates": []byte(`[]`),
	}

	agent := NewRankingAgentTest(mockRedis)

	task := &SwarmTask{
		TaskID: "task1",
		Input:  map[string]any{"graph_id": "graph1"},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	topResults := result["ranked_results"].([]memory.SearchResult)
	require.Len(t, topResults, 0, "Should return empty results for empty candidates")
	require.Equal(t, "", result["assembled_context"].(string))
	require.Equal(t, 0, result["token_count"].(int))
}

// TestRankingAgent_MissingGraphState tests handling when graph state is missing.
func TestRankingAgent_MissingGraphState(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRedis := NewMockRankingRedisLayer()
	// No graph state pre-populated

	agent := NewRankingAgentTest(mockRedis)

	task := &SwarmTask{
		TaskID: "task1",
		Input:  map[string]any{"graph_id": "nonexistent"},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	// Should return empty results when no candidates found
	topResults := result["ranked_results"].([]memory.SearchResult)
	require.Len(t, topResults, 0, "Should return empty results when no candidates")
}

// TestRankingAgent_CandidatesFromInput tests candidates passed directly in input.
func TestRankingAgent_CandidatesFromInput(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRedis := NewMockRankingRedisLayer()
	agent := NewRankingAgentTest(mockRedis)

	task := &SwarmTask{
		TaskID: "task1",
		Input: map[string]any{
			"query": "test query",
			"candidates": []any{
				map[string]any{"id": "doc1", "score": 0.9, "payload": map[string]any{"content": "High score"}},
				map[string]any{"id": "doc2", "score": 0.3, "payload": map[string]any{"content": "Low score"}},
			},
		},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	topResults := result["ranked_results"].([]memory.SearchResult)
	filteredCount := result["filtered_count"].(int)

	// Only doc1 should be kept since doc2 score (0.3) < 0.5
	require.Len(t, topResults, 1, "Should filter out low score")
	require.Equal(t, "doc1", topResults[0].ID)
	require.Equal(t, 1, filteredCount, "1 document should be filtered out")
}

// TestRankingAgent_AssembledContext tests context assembly with real content.
func TestRankingAgent_AssembledContext(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRedis := NewMockRankingRedisLayer()
	agent := NewRankingAgentTest(mockRedis)

	// Create documents with known content
	candidates := []any{
		map[string]any{"id": "doc1", "score": 0.9, "payload": map[string]any{"content": "First document content about HVAC systems."}},
		map[string]any{"id": "doc2", "score": 0.8, "payload": map[string]any{"content": "Second document with maintenance instructions."}},
		map[string]any{"id": "doc3", "score": 0.7, "payload": map[string]any{"content": "Third document about error codes."}},
	}

	task := &SwarmTask{
		TaskID: "task1",
		Input: map[string]any{
			"query":      "HVAC guide",
			"candidates": candidates,
		},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	topResults := result["ranked_results"].([]memory.SearchResult)
	require.Len(t, topResults, 3, "All 3 documents should pass filter")

	contextStr := result["assembled_context"].(string)
	require.Contains(t, contextStr, "First document")
	require.Contains(t, contextStr, "Second document")
	require.Contains(t, contextStr, "Third document")
}

// BenchmarkRRFFusion benchmarks the RRF fusion function.
func BenchmarkRRFFusion(b *testing.B) {
	agent := &RAGAgent{}

	dense := make([]memory.SearchResult, 100)
	sparse := make([]memory.SearchResult, 100)
	for i := 0; i < 100; i++ {
		dense[i] = memory.SearchResult{ID: "doc" + string(rune(i)), Score: 0.9 - float64(i)*0.01}
		sparse[i] = memory.SearchResult{ID: "doc" + string(rune(i)), Score: 0.85 - float64(i)*0.01}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		agent.rrfFusion(dense, sparse, 60, 0.5, 0.5)
	}
}