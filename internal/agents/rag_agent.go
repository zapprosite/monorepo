package agents

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/memory"
)

// QdrantSearcher defines the Qdrant operations needed by RAGAgent.
type QdrantSearcher interface {
	HybridSearch(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error)
	SearchSparse(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error)
}

// EmbedderInterface defines the interface for embedding providers (compatible with both Gemini and Ollama).
type EmbedderInterface interface {
	Embed(ctx context.Context, text string) ([]float32, error)
	BatchEmbed(ctx context.Context, texts []string) ([][]float32, error)
}

// RAGAgent performs hybrid search with caching.
type RAGAgent struct {
	embedder    EmbedderInterface
	qdrant      QdrantSearcher
	redis       RedisCacheLayer
	redisClient RedisEnqueuer
	queryTTL    time.Duration
	embedTTL    time.Duration
}

// RedisCacheLayer wraps Redis operations for caching.
type RedisCacheLayer interface {
	GetGraphState(ctx context.Context, graphID string) (map[string]interface{}, error)
	SetGraphState(ctx context.Context, graphID string, state map[string]interface{}) error
	SetGraphStateWithTTL(ctx context.Context, graphID string, state map[string]interface{}, ttl time.Duration) error
}

// NewRAGAgent creates a new RAGAgent.
func NewRAGAgent(embedder EmbedderInterface, qdrant QdrantSearcher, redis RedisCacheLayer) *RAGAgent {
	return &RAGAgent{
		embedder: embedder,
		qdrant:   qdrant,
		redis:    redis,
		queryTTL: 1 * time.Hour,
		embedTTL: 24 * time.Hour,
	}
}

// NewRAGAgentWithRedis creates a RAGAgent with Redis client for routing to ranking.
func NewRAGAgentWithRedis(embedder EmbedderInterface, qdrant QdrantSearcher, redis RedisCacheLayer, redisClient RedisEnqueuer) *RAGAgent {
	agent := NewRAGAgent(embedder, qdrant, redis)
	agent.redisClient = redisClient
	return agent
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

	// Step 5: Route to ranking queue
	if r.redisClient != nil {
		phone, _ := task.Input["phone"].(string)
		intent, _ := task.Input["intent"].(string)
		normalizedText, _ := task.Input["normalized_text"].(string)
		chatID, _ := task.Input["chat_id"]

		rankingTask := map[string]any{
			"task_id":     task.TaskID,
			"graph_id":    graphID,
			"node_id":     "ranking",
			"type":        "ranking",
			"status":      "pending",
			"priority":    1,
			"retries":     0,
			"max_retries": 3,
			"timeout_ms":  20000,
			"input": map[string]any{
				"query":           input,
				"graph_id":        graphID,
				"intent":          intent,
				"normalized_text": normalizedText,
				"phone":           phone,
				"chat_id":         chatID,
				"rag_candidates":  candidates,
				"cache_hit":       false,
			},
		}

		if err := r.redisClient.EnqueueTask(ctx, "ranking", rankingTask); err != nil {
			log.Printf("[rag] failed to enqueue ranking task: %v", err)
		} else {
			log.Printf("[rag] routed to ranking queue: graph_id=%s, candidates=%d", graphID, len(candidates))
		}
	}

	return map[string]any{
		"rag_candidates": candidates,
		"cache_hit":      false,
		"query_hash":     queryHash,
	}, nil
}

// hybridSearch performs dense + sparse search with RRF fusion.
func (r *RAGAgent) hybridSearch(ctx context.Context, query string, embedding []float32, filters map[string]string, config RAGConfig) ([]memory.SearchResult, error) {
	var denseResults []memory.SearchResult
	var sparseResults []memory.SearchResult

	// Dense search with retry
	denseResults, err := r.denseSearchWithRetry(ctx, query, filters, config.TopK)
	if err != nil {
		// If it's a "not found" or "unavailable" error, log and continue with empty results
		if isQdrantUnavailableError(err) {
			log.Printf("[rag] Qdrant dense search unavailable (collection not found or service down), continuing with empty candidates: %v", err)
			denseResults = []memory.SearchResult{}
		} else {
			return nil, fmt.Errorf("dense search: %w", err)
		}
	}

	// Sparse search with retry
	sparseResults, err = r.sparseSearchWithRetry(ctx, query, filters, config.TopK)
	if err != nil {
		// If it's a "not found" or "unavailable" error, log and continue with empty results
		if isQdrantUnavailableError(err) {
			log.Printf("[rag] Qdrant sparse search unavailable (collection not found or service down), continuing with empty candidates: %v", err)
			sparseResults = []memory.SearchResult{}
		} else {
			return nil, fmt.Errorf("sparse search: %w", err)
		}
	}

	// RRF fusion
	fused := r.rrfFusion(denseResults, sparseResults, config.RRFK, config.DenseWeight, config.SparseWeight)

	// Limit to topK
	if len(fused) > config.TopK {
		fused = fused[:config.TopK]
	}

	return fused, nil
}

// denseSearchWithRetry performs dense search with retry logic.
// Retries up to 3 times for transient errors, returns immediately for "unavailable" errors.
func (r *RAGAgent) denseSearchWithRetry(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		results, err := r.qdrant.HybridSearch(ctx, query, filters, limit)
		if err == nil {
			return results, nil
		}

		// If it's an unavailable/not-found error, don't retry - return immediately
		if isQdrantUnavailableError(err) {
			return nil, err
		}

		lastErr = err
		log.Printf("[rag] dense search attempt %d/3 failed: %v", attempt, err)

		if attempt < 3 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt) * 500 * time.Millisecond):
				// Exponential backoff: 500ms, 1s, 1.5s
			}
		}
	}
	return nil, lastErr
}

// sparseSearchWithRetry performs sparse search with retry logic.
// Retries up to 3 times for transient errors, returns immediately for "unavailable" errors.
func (r *RAGAgent) sparseSearchWithRetry(ctx context.Context, query string, filters map[string]string, limit int) ([]memory.SearchResult, error) {
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		results, err := r.qdrant.SearchSparse(ctx, query, filters, limit)
		if err == nil {
			return results, nil
		}

		// If it's an unavailable/not-found error, don't retry - return immediately
		if isQdrantUnavailableError(err) {
			return nil, err
		}

		lastErr = err
		log.Printf("[rag] sparse search attempt %d/3 failed: %v", attempt, err)

		if attempt < 3 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt) * 500 * time.Millisecond):
				// Exponential backoff: 500ms, 1s, 1.5s
			}
		}
	}
	return nil, lastErr
}

// isQdrantUnavailableError checks if the error indicates Qdrant collection not found or service unavailable.
// These errors should trigger graceful fallback to empty candidates rather than dead-lettering.
func isQdrantUnavailableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// Check for common Qdrant error patterns indicating collection not found or unavailable
	unavailablePatterns := []string{
		"collection not found",
		"collection doesn't exist",
		"status: 404",
		"status 404",
		"not found",
		"grpc: error code NotFound",
		"error code: NotFound",
		"service unavailable",
		"unavailable",
		"connection refused",
		"context deadline exceeded",
		"no such host",
		"invalid argument",
		"Wrong input",
		"Conversion between sparse and regular vectors failed",
	}
	for _, pattern := range unavailablePatterns {
		if strings.Contains(strings.ToLower(errStr), strings.ToLower(pattern)) {
			return true
		}
	}
	return false
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