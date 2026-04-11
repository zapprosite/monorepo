package agents

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/gemini"
	"github.com/will-zappro/hvacr-swarm/internal/memory"
)

// RAGAgent performs hybrid search with caching.
type RAGAgent struct {
	embedder gemini.EmbedderInterface
	qdrant   *memory.QdrantLayer
	redis    RedisCacheLayer
	queryTTL time.Duration
	embedTTL time.Duration
}

// RedisCacheLayer wraps Redis operations for caching.
type RedisCacheLayer interface {
	GetGraphState(ctx context.Context, graphID string) (map[string]interface{}, error)
	SetGraphState(ctx context.Context, graphID string, state map[string]interface{}) error
	SetGraphStateWithTTL(ctx context.Context, graphID string, state map[string]interface{}, ttl time.Duration) error
}

// NewRAGAgent creates a new RAGAgent.
func NewRAGAgent(embedder gemini.EmbedderInterface, qdrant *memory.QdrantLayer, redis RedisCacheLayer) *RAGAgent {
	return &RAGAgent{
		embedder: embedder,
		qdrant:   qdrant,
		redis:    redis,
		queryTTL: 1 * time.Hour,
		embedTTL: 24 * time.Hour,
	}
}

// RAGConfig holds configuration for the RAG agent.
type RAGConfig struct {
	TopK        int     `json:"top_k"`
	RRFK        int     `json:"rrf_k"` // RRF parameter k (default 60)
	DenseWeight float64 `json:"dense_weight"`
	SparseWeight float64 `json:"sparse_weight"`
}

// DefaultRAGConfig returns the default RAG configuration.
func DefaultRAGConfig() RAGConfig {
	return RAGConfig{
		TopK:        20,
		RRFK:        60,
		DenseWeight: 0.5,
		SparseWeight: 0.5,
	}
}

// RAGInput defines the input schema for RAGAgent.
type RAGInput struct {
	Query   string            `json:"query"`
	GraphID string            `json:"graph_id"`
	Filters map[string]string `json:"filters,omitempty"`
	Config  RAGConfig         `json:"config,omitempty"`
}

// RAGOutput defines the output schema for RAGAgent.
type RAGOutput struct {
	Candidates []memory.SearchResult `json:"candidates"`
	CacheHit   bool                  `json:"cache_hit"`
	QueryHash  string                `json:"query_hash"`
}

// Execute implements AgentInterface.Execute.
func (r *RAGAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	// Parse input
	input, ok := task.Input["query"].(string)
	if !ok {
		return nil, fmt.Errorf("query is required")
	}

	graphID, _ := task.Input["graph_id"].(string)
	if graphID == "" {
		return nil, fmt.Errorf("graph_id is required")
	}

	config := DefaultRAGConfig()
	if cfg, ok := task.Input["config"].(map[string]any); ok {
		if topK, ok := cfg["top_k"].(float64); ok {
			config.TopK = int(topK)
		}
		if rrfK, ok := cfg["rrf_k"].(float64); ok {
			config.RRFK = int(rrfK)
		}
	}

	// Step 1: Cache check
	queryHash := hashQuery(input)

	if r.redis != nil {
		cacheKey := fmt.Sprintf("cache:query:%s", queryHash)
		state, err := r.redis.GetGraphState(ctx, graphID)
		if err == nil {
			if cached, ok := state[cacheKey]; ok {
				if candidatesJSON, ok := cached.(string); ok {
					var candidates []memory.SearchResult
					if json.Unmarshal([]byte(candidatesJSON), &candidates) == nil {
						return map[string]any{
							"rag_candidates": candidates,
							"cache_hit":      true,
							"query_hash":     queryHash,
						}, nil
					}
				}
			}
		}
	}

	// Step 2: Generate embedding (Gemini Embedding 2 - 768D)
	embedding, err := r.embedder.Embed(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("generate embedding: %w", err)
	}

	// Extract filters from input
	filters := extractFilters(task.Input)

	// Step 3: Hybrid search with RRF fusion
	candidates, err := r.hybridSearch(ctx, input, embedding, filters, config)
	if err != nil {
		return nil, fmt.Errorf("hybrid search: %w", err)
	}

	// Step 4: Cache results with TTL
	if r.redis != nil {
		candidatesJSON, _ := json.Marshal(candidates)
		cacheKey := fmt.Sprintf("cache:query:%s", queryHash)
		r.redis.SetGraphStateWithTTL(ctx, graphID, map[string]interface{}{
			cacheKey: string(candidatesJSON),
		}, r.queryTTL)
	}

	return map[string]any{
		"rag_candidates": candidates,
		"cache_hit":      false,
		"query_hash":     queryHash,
	}, nil
}

// hybridSearch performs dense + sparse search with RRF fusion.
func (r *RAGAgent) hybridSearch(ctx context.Context, query string, embedding []float32, filters map[string]string, config RAGConfig) ([]memory.SearchResult, error) {
	// Dense search
	denseResults, err := r.qdrant.HybridSearch(ctx, query, filters, config.TopK)
	if err != nil {
		return nil, fmt.Errorf("dense search: %w", err)
	}

	// Sparse search (BM25-like)
	sparseResults, err := r.qdrant.SearchSparse(ctx, query, filters, config.TopK)
	if err != nil {
		return nil, fmt.Errorf("sparse search: %w", err)
	}

	// RRF fusion
	fused := r.rrfFusion(denseResults, sparseResults, config.RRFK, config.DenseWeight, config.SparseWeight)

	// Limit to topK
	if len(fused) > config.TopK {
		fused = fused[:config.TopK]
	}

	return fused, nil
}

// rrfFusion combines dense and sparse results using Reciprocal Rank Fusion.
// Score = RRF(dense_score) + RRF(sparse_score)
// RRF(k) = 1 / (k + rank)
func (r *RAGAgent) rrfFusion(dense, sparse []memory.SearchResult, k int, denseWeight, sparseWeight float64) []memory.SearchResult {
	// Build score maps
	denseRanks := make(map[string]int)
	for i, res := range dense {
		denseRanks[res.ID] = i + 1
	}

	sparseRanks := make(map[string]int)
	for i, res := range sparse {
		sparseRanks[res.ID] = i + 1
	}

	// Collect all unique IDs
	allIDs := make(map[string]struct{})
	for _, res := range dense {
		allIDs[res.ID] = struct{}{}
	}
	for _, res := range sparse {
		allIDs[res.ID] = struct{}{}
	}

	// Calculate RRF scores
	type fusedResult struct {
		result memory.SearchResult
		score  float64
	}
	fusedMap := make(map[string]fusedResult)

	for id := range allIDs {
		denseRank := denseRanks[id]
		sparseRank := sparseRanks[id]

		var denseScore, sparseScore float64
		if denseRank > 0 {
			denseScore = denseWeight * (1.0 / float64(k+denseRank))
		}
		if sparseRank > 0 {
			sparseScore = sparseWeight * (1.0 / float64(k+sparseRank))
		}

		totalScore := denseScore + sparseScore

		// Find the original result (prefer dense if exists)
		var result memory.SearchResult
		for _, res := range dense {
			if res.ID == id {
				result = res
				break
			}
		}
		if result.ID == "" {
			for _, res := range sparse {
				if res.ID == id {
					result = res
					break
				}
			}
		}

		fusedMap[id] = fusedResult{result: result, score: totalScore}
	}

	// Sort by score descending
	fused := make([]fusedResult, 0, len(fusedMap))
	for _, fr := range fusedMap {
		fused = append(fused, fr)
	}
	sort.Slice(fused, func(i, j int) bool {
		return fused[i].score > fused[j].score
	})

	// Convert back to SearchResult with score
	results := make([]memory.SearchResult, 0, len(fused))
	for _, fr := range fused {
		fr.result.Score = fr.score
		results = append(results, fr.result)
	}

	return results
}

// AgentType implements AgentInterface.AgentType.
func (r *RAGAgent) AgentType() string {
	return "rag"
}

// MaxRetries implements AgentInterface.MaxRetries.
func (r *RAGAgent) MaxRetries() int {
	return 3
}

// TimeoutMs implements AgentInterface.TimeoutMs.
func (r *RAGAgent) TimeoutMs() int {
	return 30000 // 30 seconds
}

// hashQuery computes SHA256 hash of the query for cache keys.
func hashQuery(query string) string {
	h := sha256.Sum256([]byte(query))
	return hex.EncodeToString(h[:])
}

// extractFilters extracts metadata filters from task input.
func extractFilters(input map[string]any) map[string]string {
	filters := make(map[string]string)
	for _, key := range []string{"brand", "model", "btu", "error_code"} {
		if v, ok := input[key].(string); ok && v != "" {
			filters[key] = v
		}
	}
	return filters
}

// Ensure RAGAgent implements AgentInterface.
var _ AgentInterface = (*RAGAgent)(nil)