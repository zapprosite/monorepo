package agents

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/will-zappro/hvacr-swarm/internal/memory"
)

// MockEmbedder implements gemini.EmbedderInterface for testing.
type MockEmbedder struct {
	embeddings   map[string][]float32
	embedFunc    func(ctx context.Context, text string) ([]float32, error)
	batchEmbedFunc func(ctx context.Context, texts []string) ([][]float32, error)
}

func NewMockEmbedder() *MockEmbedder {
	return &MockEmbedder{
		embeddings: make(map[string][]float32),
	}
}

func (m *MockEmbedder) Embed(ctx context.Context, text string) ([]float32, error) {
	if m.embedFunc != nil {
		return m.embedFunc(ctx, text)
	}
	if emb, ok := m.embeddings[text]; ok {
		return emb, nil
	}
	// Return a deterministic 768D embedding
	emb := make([]float32, 768)
	for i := range emb {
		emb[i] = 0.1
	}
	m.embeddings[text] = emb
	return emb, nil
}

func (m *MockEmbedder) BatchEmbed(ctx context.Context, texts []string) ([][]float32, error) {
	if m.batchEmbedFunc != nil {
		return m.batchEmbedFunc(ctx, texts)
	}
	results := make([][]float32, 0, len(texts))
	for _, text := range texts {
		emb, err := m.Embed(ctx, text)
		if err != nil {
			return nil, err
		}
		results = append(results, emb)
	}
	return results, nil
}

// MockRedisLayer implements RedisCacheLayer for testing.
type MockRedisLayer struct {
	graphState map[string]map[string]interface{}
}

func NewMockRedisLayer() *MockRedisLayer {
	return &MockRedisLayer{
		graphState: make(map[string]map[string]interface{}),
	}
}

func (m *MockRedisLayer) GetGraphState(ctx context.Context, graphID string) (map[string]interface{}, error) {
	if state, ok := m.graphState[graphID]; ok {
		return state, nil
	}
	return nil, nil
}

func (m *MockRedisLayer) SetGraphState(ctx context.Context, graphID string, state map[string]interface{}) error {
	m.graphState[graphID] = state
	return nil
}

func (m *MockRedisLayer) SetGraphStateWithTTL(ctx context.Context, graphID string, state map[string]interface{}, ttl time.Duration) error {
	m.graphState[graphID] = state
	return nil
}

// MockQdrantLayer implements QdrantLayer for testing.
type MockQdrantLayer struct {
	denseResults     []memory.SearchResult
	sparseResults    []memory.SearchResult
	hybridSearchFunc func(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error)
	searchSparseFunc func(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error)
}

func NewMockQdrantLayer() *MockQdrantLayer {
	return &MockQdrantLayer{
		denseResults:  []memory.SearchResult{},
		sparseResults: []memory.SearchResult{},
	}
}

func (m *MockQdrantLayer) HybridSearch(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
	if m.hybridSearchFunc != nil {
		return m.hybridSearchFunc(ctx, query, filters, limit)
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > len(m.denseResults) {
		limit = len(m.denseResults)
	}
	return m.denseResults[:limit], nil
}

func (m *MockQdrantLayer) SearchSparse(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
	if m.searchSparseFunc != nil {
		return m.searchSparseFunc(ctx, query, filters, limit)
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > len(m.sparseResults) {
		limit = len(m.sparseResults)
	}
	return m.sparseResults[:limit], nil
}

func (m *MockQdrantLayer) SetDenseResults(results []memory.SearchResult) {
	m.denseResults = results
}

func (m *MockQdrantLayer) SetSparseResults(results []memory.SearchResult) {
	m.sparseResults = results
}

// setupTestRAGAgent creates a RAGAgent with mocks for testing.
func setupTestRAGAgent() (*RAGAgent, *MockEmbedder, *MockQdrantLayer, *MockRedisLayer) {
	embedder := NewMockEmbedder()
	qdrant := NewMockQdrantLayer()
	redis := NewMockRedisLayer()

	agent := &RAGAgent{
		embedder: embedder,
		qdrant:   qdrant,
		redis:    redis,
		queryTTL: 1 * time.Hour,
		embedTTL: 24 * time.Hour,
	}

	return agent, embedder, qdrant, redis
}

func TestRAGAgent_AgentType(t *testing.T) {
	agent, _, _, _ := setupTestRAGAgent()
	assert.Equal(t, "rag", agent.AgentType())
}

func TestRAGAgent_MaxRetries(t *testing.T) {
	agent, _, _, _ := setupTestRAGAgent()
	assert.Equal(t, 3, agent.MaxRetries())
}

func TestRAGAgent_TimeoutMs(t *testing.T) {
	agent, _, _, _ := setupTestRAGAgent()
	assert.Equal(t, 30000, agent.TimeoutMs())
}

func TestRAGAgent_Execute_MissingGraphID(t *testing.T) {
	agent, _, _, _ := setupTestRAGAgent()
	task := &SwarmTask{
		TaskID: "task-1",
		Input:  map[string]any{"query": "test"},
	}

	_, err := agent.Execute(context.Background(), task)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "graph_id is required")
}

func TestRAGAgent_Execute_MissingQuery(t *testing.T) {
	agent, _, _, _ := setupTestRAGAgent()
	task := &SwarmTask{
		TaskID: "task-1",
		Input:  map[string]any{"graph_id": "graph-1"},
	}

	_, err := agent.Execute(context.Background(), task)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "query is required")
}

func TestHashQuery(t *testing.T) {
	hash1 := hashQuery("test query")
	hash2 := hashQuery("test query")
	hash3 := hashQuery("different query")

	assert.Equal(t, hash1, hash2, "Same query should produce same hash")
	assert.NotEqual(t, hash1, hash3, "Different queries should produce different hashes")
	assert.Len(t, hash1, 64, "SHA256 hash should be 64 hex characters")
}

func TestExtractFilters(t *testing.T) {
	input := map[string]any{
		"brand":      "Carrier",
		"model":      "24ACC636",
		"btu":        "24000",
		"error_code": "E1",
		"other":      "value",
	}

	filters := extractFilters(input)

	assert.Equal(t, "Carrier", filters["brand"])
	assert.Equal(t, "24ACC636", filters["model"])
	assert.Equal(t, "24000", filters["btu"])
	assert.Equal(t, "E1", filters["error_code"])
	assert.NotContains(t, filters, "other")
}

func TestExtractFilters_EmptyValues(t *testing.T) {
	input := map[string]any{
		"brand": "",
		"model": "24ACC636",
	}

	filters := extractFilters(input)

	assert.NotContains(t, filters, "brand")
	assert.Equal(t, "24ACC636", filters["model"])
}

func TestDefaultRAGConfig(t *testing.T) {
	config := DefaultRAGConfig()

	assert.Equal(t, 20, config.TopK)
	assert.Equal(t, 60, config.RRFK)
	assert.Equal(t, 0.5, config.DenseWeight)
	assert.Equal(t, 0.5, config.SparseWeight)
}

// rrfFusion is exported for testing - wrapper that calls the unexported method
func testRRFFusion(r *RAGAgent, dense, sparse []memory.SearchResult, k int, denseWeight, sparseWeight float64) []memory.SearchResult {
	return r.rrfFusion(dense, sparse, k, denseWeight, sparseWeight)
}

func TestRRFFusion(t *testing.T) {
	agent := &RAGAgent{}

	dense := []memory.SearchResult{
		{ID: "doc1", Score: 0.9},
		{ID: "doc2", Score: 0.8},
		{ID: "doc3", Score: 0.7},
	}

	sparse := []memory.SearchResult{
		{ID: "doc3", Score: 0.95},
		{ID: "doc4", Score: 0.85},
		{ID: "doc1", Score: 0.75},
	}

	config := DefaultRAGConfig()

	result := testRRFFusion(agent, dense, sparse, config.RRFK, config.DenseWeight, config.SparseWeight)

	// doc1 appears in both with rank 1 in both
	// doc3 appears in both with rank 2 in dense, rank 1 in sparse
	// doc2 only in dense (rank 2)
	// doc4 only in sparse (rank 2)

	assert.Len(t, result, 4)

	// Find doc1 and doc3 positions
	var doc1Idx, doc3Idx int
	for i, r := range result {
		if r.ID == "doc1" {
			doc1Idx = i
		}
		if r.ID == "doc3" {
			doc3Idx = i
		}
	}

	// doc1 should rank higher due to being #1 in both
	assert.Less(t, doc1Idx, doc3Idx, "doc1 should rank higher than doc3")
}

func TestRRFFusion_EmptyInputs(t *testing.T) {
	agent := &RAGAgent{}

	result := agent.rrfFusion([]memory.SearchResult{}, []memory.SearchResult{}, 60, 0.5, 0.5)
	assert.Len(t, result, 0)
}

func TestRRFFusion_OnlyDense(t *testing.T) {
	agent := &RAGAgent{}

	dense := []memory.SearchResult{
		{ID: "doc1", Score: 0.9},
		{ID: "doc2", Score: 0.8},
	}

	result := agent.rrfFusion(dense, []memory.SearchResult{}, 60, 0.5, 0.5)
	assert.Len(t, result, 2)
	assert.Equal(t, "doc1", result[0].ID)
}

func TestRRFFusion_OnlySparse(t *testing.T) {
	agent := &RAGAgent{}

	sparse := []memory.SearchResult{
		{ID: "doc1", Score: 0.9},
		{ID: "doc2", Score: 0.8},
	}

	result := agent.rrfFusion([]memory.SearchResult{}, sparse, 60, 0.5, 0.5)
	assert.Len(t, result, 2)
	assert.Equal(t, "doc1", result[0].ID)
}

func TestRRFFusion_DocInBothShouldRankHigher(t *testing.T) {
	agent := &RAGAgent{}

	// When doc is in both dense and sparse, it should rank higher
	dense := []memory.SearchResult{
		{ID: "doc1", Score: 0.9},
		{ID: "doc2", Score: 0.8},
	}

	sparse := []memory.SearchResult{
		{ID: "doc1", Score: 0.9},
		{ID: "doc3", Score: 0.85},
	}

	result := agent.rrfFusion(dense, sparse, 60, 0.5, 0.5)

	// doc1 should be first because it appears in both lists
	assert.Equal(t, "doc1", result[0].ID)
}

// TestCacheHit_ReturnsImmediately tests that a cache hit returns immediately without calling external services.
func TestCacheHit_ReturnsImmediately(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	embedderCalls := 0
	qdrantCalls := 0

	embedder := &MockEmbedder{
		embedFunc: func(ctx context.Context, text string) ([]float32, error) {
			embedderCalls++
			return make([]float32, 768), nil
		},
	}

	qdrant := &MockQdrantLayer{
		hybridSearchFunc: func(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
			qdrantCalls++
			return []memory.SearchResult{
				{ID: "doc1", Score: 0.95, Payload: map[string]interface{}{"content": "cached result"}},
			}, nil
		},
		searchSparseFunc: func(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
			qdrantCalls++
			return []memory.SearchResult{}, nil
		},
	}

	redis := NewMockRedisLayer()
	agent := &RAGAgent{
		embedder: embedder,
		qdrant:   qdrant,
		redis:    redis,
		queryTTL: 1 * time.Hour,
		embedTTL: 24 * time.Hour,
	}

	// First call - cache miss, should populate cache
	task1 := &SwarmTask{
		TaskID: "task1",
		Input:  map[string]any{"query": "compressor noise", "graph_id": "graph1"},
	}
	result1, err := agent.Execute(ctx, task1)
	require.NoError(t, err)
	require.NotNil(t, result1)
	require.False(t, result1["cache_hit"].(bool), "First call should be cache miss")

	// Verify external services were called
	require.Equal(t, 1, embedderCalls, "Embedder should be called once on cache miss")
	require.Equal(t, 1, qdrantCalls, "Qdrant should be called once on cache miss")

	// Reset counters
	embedderCalls = 0
	qdrantCalls = 0

	// Second call with same query - should hit cache
	task2 := &SwarmTask{
		TaskID: "task2",
		Input:  map[string]any{"query": "compressor noise", "graph_id": "graph1"},
	}
	result2, err := agent.Execute(ctx, task2)
	require.NoError(t, err)
	require.NotNil(t, result2)
	require.True(t, result2["cache_hit"].(bool), "Second call should be cache hit")

	// Verify external services were NOT called again
	require.Equal(t, 0, embedderCalls, "Embedder should NOT be called on cache hit")
	require.Equal(t, 0, qdrantCalls, "Qdrant should NOT be called on cache hit")
}

// TestHybridSearch_DenseSparseFusion tests that hybrid search fuses dense and sparse results using RRF.
func TestHybridSearch_DenseSparseFusion(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	embedder := &MockEmbedder{
		embedFunc: func(ctx context.Context, text string) ([]float32, error) {
			return make([]float32, 768), nil
		},
	}

	qdrant := &MockQdrantLayer{
		// Dense returns doc1 high rank, doc2 low rank
		hybridSearchFunc: func(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
			return []memory.SearchResult{
				{ID: "doc1", Score: 0.9, Payload: map[string]interface{}{"source": "dense"}},
				{ID: "doc2", Score: 0.8, Payload: map[string]interface{}{"source": "dense"}},
			}, nil
		},
		// Sparse returns doc2 high rank, doc3 only
		searchSparseFunc: func(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
			return []memory.SearchResult{
				{ID: "doc2", Score: 0.85, Payload: map[string]interface{}{"source": "sparse"}},
				{ID: "doc3", Score: 0.7, Payload: map[string]interface{}{"source": "sparse"}},
			}, nil
		},
	}

	redis := NewMockRedisLayer()
	agent := &RAGAgent{
		embedder: embedder,
		qdrant:   qdrant,
		redis:    redis,
		queryTTL: 1 * time.Hour,
		embedTTL: 24 * time.Hour,
	}

	task := &SwarmTask{
		TaskID: "task1",
		Input:  map[string]any{"query": "air conditioning error", "graph_id": "graph1"},
	}
	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)
	require.NotNil(t, result)

	candidates := result["rag_candidates"].([]memory.SearchResult)
	require.NotEmpty(t, candidates, "Should return fused results")

	// Verify RRF fusion:
	// doc1: only in dense (rank 1) -> score = 0.5 * 1/(60+1) = 0.0082
	// doc2: in both (dense rank 2, sparse rank 1) -> score = 0.5 * 1/(60+2) + 0.5 * 1/(60+1) = 0.0081 + 0.0082 = 0.0163
	// doc3: only in sparse (rank 2) -> score = 0.5 * 1/(60+2) = 0.0081
	// Expected order: doc2 > doc1 > doc3

	require.Equal(t, "doc2", candidates[0].ID, "doc2 should be first due to appearing in both result sets")

	// Verify doc1 comes before doc3 (doc1 appears in dense, doc3 only in sparse)
	doc1Idx := -1
	doc3Idx := -1
	for i, c := range candidates {
		if c.ID == "doc1" {
			doc1Idx = i
		}
		if c.ID == "doc3" {
			doc3Idx = i
		}
	}
	require.True(t, doc1Idx >= 0, "doc1 should be in results")
	require.True(t, doc3Idx >= 0, "doc3 should be in results")
	require.True(t, doc1Idx < doc3Idx, "doc1 should rank higher than doc3")
}

// TestContextAssembly_Max4000Tokens tests that the hybrid search respects token limits.
func TestContextAssembly_Max4000Tokens(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Create documents with known large content
	largeContent := ""
	for i := 0; i < 50; i++ {
		largeContent += "Lorem ipsum dolor sit amet consectetur adipiscing elit. "
	}

	embedder := &MockEmbedder{
		embedFunc: func(ctx context.Context, text string) ([]float32, error) {
			return make([]float32, 768), nil
		},
	}

	// Generate 10 results, each with ~500 tokens of content
	qdrant := &MockQdrantLayer{
		hybridSearchFunc: func(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
			results := make([]memory.SearchResult, 10)
			for i := 0; i < 10; i++ {
				results[i] = memory.SearchResult{
					ID:      "doc" + string(rune('0'+i)),
					Score:   0.9 - float64(i)*0.05,
					Payload: map[string]interface{}{"content": largeContent},
				}
			}
			return results, nil
		},
		searchSparseFunc: func(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
			return []memory.SearchResult{}, nil
		},
	}

	redis := NewMockRedisLayer()
	agent := &RAGAgent{
		embedder: embedder,
		qdrant:   qdrant,
		redis:    redis,
		queryTTL: 1 * time.Hour,
		embedTTL: 24 * time.Hour,
	}

	task := &SwarmTask{
		TaskID: "task1",
		Input:  map[string]any{"query": "thermostat malfunction", "graph_id": "graph1"},
	}
	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)
	require.NotNil(t, result)

	candidates := result["rag_candidates"].([]memory.SearchResult)
	require.NotEmpty(t, candidates, "Should have at least some candidates")

	// Each document has ~500 tokens (50 sentences * ~10 words * 1.3 tokens)
	// With 10 documents, that's ~5000 tokens total
	// The agent should return up to TopK=20 results
	require.LessOrEqual(t, len(candidates), 20, "Should return at most 20 candidates (TopK)")

	// Calculate approximate total tokens
	approxTokens := 0
	for _, c := range candidates {
		if content, ok := c.Payload["content"].(string); ok {
			approxTokens += len(content) / 4 // ~4 chars per token
		}
	}

	t.Logf("Retrieved %d candidates with approximately %d tokens", len(candidates), approxTokens)
}