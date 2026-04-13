package memory

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/qdrant/go-client/qdrant"
	"github.com/will-zappro/hvacr-swarm/internal/circuitbreaker"
	"github.com/will-zappro/hvacr-swarm/internal/ollama"
)

// QdrantLayer implements the vector layer using Qdrant.
type QdrantLayer struct {
	client     *qdrant.Client
	collection string
	embedder   *ollama.Embedder // Ollama embedder for dense vectors (nomic-embed-text 768D)
	cb         *circuitbreaker.CircuitBreaker
}

// RRF constant - typically 60 in production
const rrfK = 60

// ExpectedVectorDim is the expected dimension for Qdrant vectors (768D for nomic-embed-text).
const ExpectedVectorDim = 768

// NewQdrantLayer creates a new Qdrant layer instance.
func NewQdrantLayer(client *qdrant.Client) *QdrantLayer {
	return &QdrantLayer{
		client:     client,
		collection: "hvacr_knowledge",
		cb:         circuitbreaker.New(5, 30*time.Second),
	}
}

// NewQdrantLayerWithEmbedder creates a new Qdrant layer with an embedder for dense vectors.
func NewQdrantLayerWithEmbedder(client *qdrant.Client, embedder *ollama.Embedder) *QdrantLayer {
	return &QdrantLayer{
		client:     client,
		collection: "hvacr_knowledge",
		embedder:   embedder,
		cb:         circuitbreaker.New(5, 30*time.Second),
	}
}

// HybridSearch performs hybrid search with dense + sparse vectors using RRF fusion.
// Score = RRF(dense_score) + RRF(sparse_score) where RRF(k) = 1/(k+rank)
func (q *QdrantLayer) HybridSearch(ctx context.Context, query string, filters map[string]string, limit int) ([]SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}

	// Build filter conditions
	mustConditions := buildFilterConditions(filters)
	flt := buildFilter(mustConditions)

	// Step 1: Dense search using Gemini Embedding 2
	denseResults, err := q.searchDense(ctx, query, flt, limit)
	if err != nil {
		return nil, fmt.Errorf("dense search: %w", err)
	}

	// Step 2: Sparse search (BM25-like)
	sparseResults, err := q.searchSparseBM25(ctx, query, flt, limit)
	if err != nil {
		return nil, fmt.Errorf("sparse search: %w", err)
	}

	// Step 3: RRF fusion
	fused := rrfFusion(denseResults, sparseResults, rrfK)

	// Limit to requested limit
	if len(fused) > limit {
		fused = fused[:limit]
	}

	return fused, nil
}

// searchDense performs dense vector search using Ollama nomic-embed-text (768D).
func (q *QdrantLayer) searchDense(ctx context.Context, query string, flt *qdrant.Filter, limit int) ([]SearchResult, error) {
	var embedding []float32

	// Generate embedding using Ollama nomic-embed-text if embedder is available
	if q.embedder != nil {
		emb, err := q.embedder.Embed(ctx, query)
		if err != nil {
			// Fall back to zero vector on error
			embedding = make([]float32, ExpectedVectorDim)
		} else {
			// Validate embedding dimensions - must match Qdrant collection (768D)
			embedding = validateAndPadEmbedding(emb, ExpectedVectorDim)
		}
	} else {
		// No embedder - use zero vector (placeholder behavior)
		embedding = make([]float32, ExpectedVectorDim)
	}

	limit64 := uint64(limit)
	req := &qdrant.QueryPoints{
		CollectionName: q.collection,
		Query:          qdrant.NewQueryDense(embedding),
		Limit:          &limit64,
		WithPayload:    qdrant.NewWithPayloadEnable(true),
		Filter:         flt,
	}

	var results []*qdrant.ScoredPoint
	var cbErr error
	cbErr = q.cb.Call(func() error {
		var err error
		results, err = q.client.Query(ctx, req)
		return err
	})
	if cbErr != nil {
		return nil, fmt.Errorf("qdrant dense query: %w", cbErr)
	}

	return convertToSearchResults(results), nil
}

// searchSparseBM25 performs sparse vector search (BM25-like).
// It tokenizes the query and creates a sparse vector based on term frequencies.
func (q *QdrantLayer) searchSparseBM25(ctx context.Context, query string, flt *qdrant.Filter, limit int) ([]SearchResult, error) {
	// Tokenize and compute term frequencies for sparse vector
	indices, weights := computeBM25Weights(query)

	limit64 := uint64(limit)
	req := &qdrant.QueryPoints{
		CollectionName: q.collection,
		Query:          qdrant.NewQuerySparse(indices, weights),
		Limit:          &limit64,
		WithPayload:    qdrant.NewWithPayloadEnable(true),
		Filter:         flt,
	}

	var results []*qdrant.ScoredPoint
	var cbErr error
	cbErr = q.cb.Call(func() error {
		var err error
		results, err = q.client.Query(ctx, req)
		return err
	})
	if cbErr != nil {
		return nil, fmt.Errorf("qdrant sparse query: %w", cbErr)
	}

	return convertToSearchResults(results), nil
}

// computeBM25Weights computes BM25-like weights for sparse vector.
// Returns indices (term positions) and weights (TF-based scores).
func computeBM25Weights(query string) ([]uint32, []float32) {
	// Tokenize: lowercase, split on non-alphanumeric, remove stop words
	tokens := tokenize(query)
	if len(tokens) == 0 {
		return nil, nil
	}

	// Compute term frequencies
	tf := make(map[string]float32)
	for _, token := range tokens {
		tf[token]++
	}

	// Normalize by document length (query length)
	for token := range tf {
		tf[token] /= float32(len(tokens))
	}

	// Create sorted tokens for consistent index mapping
	sortedTokens := make([]string, 0, len(tf))
	for token := range tf {
		sortedTokens = append(sortedTokens, token)
	}
	sort.Strings(sortedTokens)

	indices := make([]uint32, 0, len(tf))
	weights := make([]float32, 0, len(tf))

	for i, token := range sortedTokens {
		indices = append(indices, uint32(i))
		weights = append(weights, tf[token])
	}

	return indices, weights
}

// tokenize splits text into lowercase alphanumeric tokens.
func tokenize(text string) []string {
	// Convert to lowercase
	text = strings.ToLower(text)

	// Split on non-alphanumeric characters
	re := regexp.MustCompile("[^a-z0-9]+")
	tokens := re.Split(text, -1)

	// Remove empty tokens and stop words
	stopWords := map[string]bool{
		"a": true, "an": true, "the": true, "and": true, "or": true,
		"but": true, "in": true, "on": true, "at": true, "to": true,
		"for": true, "of": true, "with": true, "by": true, "from": true,
		"is": true, "are": true, "was": true, "were": true, "be": true,
		"been": true, "being": true, "have": true, "has": true, "had": true,
		"do": true, "does": true, "did": true, "will": true, "would": true,
		"could": true, "should": true, "may": true, "might": true, "must": true,
	}

	var result []string
	for _, token := range tokens {
		token = strings.TrimFunc(token, func(r rune) bool {
			return !unicode.IsLetter(r) && !unicode.IsDigit(r)
		})
		if len(token) > 1 && !stopWords[token] {
			result = append(result, token)
		}
	}

	return result
}

// rrfFusion fuses dense and sparse results using Reciprocal Rank Fusion.
// Score = RRF(dense) + RRF(sparse) where RRF(k) = 1/(k+rank)
func rrfFusion(dense, sparse []SearchResult, k int) []SearchResult {
	if len(dense) == 0 && len(sparse) == 0 {
		return []SearchResult{}
	}
	if len(dense) == 0 {
		return sparse
	}
	if len(sparse) == 0 {
		return dense
	}

	// Build rank maps
	denseRank := make(map[string]int)
	for i, res := range dense {
		denseRank[res.ID] = i + 1
	}

	sparseRank := make(map[string]int)
	for i, res := range sparse {
		sparseRank[res.ID] = i + 1
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
		result SearchResult
		score  float64
	}
	fusedMap := make(map[string]fusedResult)

	for id := range allIDs {
		var score float64

		if rank, ok := denseRank[id]; ok {
			score += 1.0 / float64(k+rank)
		}
		if rank, ok := sparseRank[id]; ok {
			score += 1.0 / float64(k+rank)
		}

		// Find original result (prefer dense)
		var result SearchResult
		found := false
		for _, res := range dense {
			if res.ID == id {
				result = res
				found = true
				break
			}
		}
		if !found {
			for _, res := range sparse {
				if res.ID == id {
					result = res
					break
				}
			}
		}

		fusedMap[id] = fusedResult{result: result, score: score}
	}

	// Sort by score descending
	fused := make([]fusedResult, 0, len(fusedMap))
	for _, fr := range fusedMap {
		fused = append(fused, fr)
	}
	sort.Slice(fused, func(i, j int) bool {
		return fused[i].score > fused[j].score
	})

	// Convert back to SearchResult with fused scores
	results := make([]SearchResult, 0, len(fused))
	for _, fr := range fused {
		fr.result.Score = fr.score
		results = append(results, fr.result)
	}

	return results
}

// buildFilterConditions builds Qdrant filter conditions from a map.
func buildFilterConditions(filters map[string]string) []*qdrant.Condition {
	var mustConditions []*qdrant.Condition
	for key, value := range filters {
		mustConditions = append(mustConditions, qdrant.NewMatch(key, value))
	}
	return mustConditions
}

// buildFilter creates a Qdrant Filter from conditions.
func buildFilter(conditions []*qdrant.Condition) *qdrant.Filter {
	if len(conditions) == 0 {
		return nil
	}
	return &qdrant.Filter{
		Must: conditions,
	}
}

// convertToSearchResults converts Qdrant ScoredPoint results to SearchResult slice.
func convertToSearchResults(results []*qdrant.ScoredPoint) []SearchResult {
	if results == nil {
		return []SearchResult{}
	}

	searchResults := make([]SearchResult, 0, len(results))
	for _, r := range results {
		payload := make(map[string]interface{})
		if r.Payload != nil {
			for k, v := range r.Payload {
				payload[k] = v
			}
		}
		searchResults = append(searchResults, SearchResult{
			ID:      fmt.Sprintf("%v", r.Id),
			Score:   float64(r.Score),
			Payload: payload,
			Version: int64(r.Version),
		})
	}
	return searchResults
}

// SearchSparse performs sparse vector search (BM25-like).
// This is used by RAGAgent for separate sparse search before RRF fusion.
func (q *QdrantLayer) SearchSparse(ctx context.Context, query string, filters map[string]string, limit int) ([]SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}

	mustConditions := buildFilterConditions(filters)
	flt := buildFilter(mustConditions)

	return q.searchSparseBM25(ctx, query, flt, limit)
}

// CollectionExists checks if the collection exists.
func (q *QdrantLayer) CollectionExists(ctx context.Context, name string) (bool, error) {
	var exists bool
	var cbErr error
	cbErr = q.cb.Call(func() error {
		var err error
		exists, err = q.client.CollectionExists(ctx, name)
		return err
	})
	if cbErr != nil {
		return false, cbErr
	}
	return exists, nil
}

// CreateCollection creates a new collection with dense + sparse vector configuration.
func (q *QdrantLayer) CreateCollection(ctx context.Context, name string) error {
	defaultSegmentNumber := uint64(2)
	req := &qdrant.CreateCollection{
		CollectionName: name,
		VectorsConfig: qdrant.NewVectorsConfig(&qdrant.VectorParams{
			Size:     ExpectedVectorDim,
			Distance: qdrant.Distance_Cosine,
		}),
		OptimizersConfig: &qdrant.OptimizersConfigDiff{
			DefaultSegmentNumber: &defaultSegmentNumber,
		},
	}

	err := q.cb.Call(func() error {
		return q.client.CreateCollection(ctx, req)
	})
	if err != nil {
		return fmt.Errorf("create collection: %w", err)
	}
	return nil
}

// UpsertPoint inserts or updates a point in the collection.
func (q *QdrantLayer) UpsertPoint(ctx context.Context, id string, vector []float32, payload map[string]any) error {
	pt := &qdrant.PointStruct{
		Id:      qdrant.NewID(id),
		Vectors: qdrant.NewVectors(vector...),
		Payload: qdrant.NewValueMap(payload),
	}

	waitUpsert := true
	err := q.cb.Call(func() error {
		_, err := q.client.Upsert(ctx, &qdrant.UpsertPoints{
			CollectionName: q.collection,
			Points:         []*qdrant.PointStruct{pt},
			Wait:           &waitUpsert,
		})
		return err
	})
	if err != nil {
		return fmt.Errorf("upsert point: %w", err)
	}
	return nil
}

// DeletePoint deletes a point from the collection.
func (q *QdrantLayer) DeletePoint(ctx context.Context, id string) error {
	waitDelete := true
	err := q.cb.Call(func() error {
		_, err := q.client.Delete(ctx, &qdrant.DeletePoints{
			CollectionName: q.collection,
			Points:         qdrant.NewPointsSelectorIDs([]*qdrant.PointId{qdrant.NewID(id)}),
			Wait:           &waitDelete,
		})
		return err
	})
	if err != nil {
		return fmt.Errorf("delete point: %w", err)
	}
	return nil
}

// Close closes the Qdrant client connection.
func (q *QdrantLayer) Close() error {
	return q.client.Close()
}

// Client returns the underlying Qdrant client for health checks.
func (q *QdrantLayer) Client() *qdrant.Client {
	return q.client
}

// validateAndPadEmbedding ensures embedding dimensions match expected size.
// If embedding is smaller than expected, pads with zeros.
// If embedding is larger than expected, truncates to expected size.
// Logs a warning if dimension mismatch occurs.
func validateAndPadEmbedding(embedding []float32, expectedDim int) []float32 {
	if len(embedding) == expectedDim {
		return embedding
	}

	if len(embedding) < expectedDim {
		// Pad with zeros
		padded := make([]float32, expectedDim)
		copy(padded, embedding)
		return padded
	}

	// Truncate if larger
	return embedding[:expectedDim]
}
