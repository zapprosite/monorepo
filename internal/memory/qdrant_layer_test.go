package memory

import (
	"context"
	"testing"

	"github.com/qdrant/go-client/qdrant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockQdrantClient is a test mock implementing qdrant client interface methods we use.
type mockQdrantClient struct {
	queryResp []*qdrant.SearchResult
	queryErr  error
}

func (m *mockQdrantClient) CollectionExists(ctx context.Context, name string) (bool, error) {
	return true, nil
}

func (m *mockQdrantClient) Query(ctx context.Context, req *qdrant.QueryPoints) (*qdrant.QueryPointsResponse, error) {
	if m.queryErr != nil {
		return nil, m.queryErr
	}
	return &qdrant.QueryPointsResponse{
		Results: m.queryResp,
	}, nil
}

func (m *mockQdrantClient) CreateCollection(ctx context.Context, req *qdrant.CreateCollection) error {
	return nil
}

func (m *mockQdrantClient) Upsert(ctx context.Context, req *qdrant.UpsertPoints) (*qdrant.UpsertResponse, error) {
	return &qdrant.UpsertResponse{}, nil
}

func (m *mockQdrantClient) Delete(ctx context.Context, req *qdrant.DeletePoints) (*qdrant.DeleteResponse, error) {
	return &qdrant.DeleteResponse{}, nil
}

func (m *mockQdrantClient) Close() error {
	return nil
}

// TestHybridSearch_ReturnsResults tests hybrid search with dense+sparse vectors via RRF fusion.
func TestHybridSearch_ReturnsResults(t *testing.T) {
	mockResp := []*qdrant.SearchResult{
		{
			Id:      qdrant.NewID("point-1"),
			Score:   0.95,
			Payload: map[string]interface{}{"brand": "Springer", "model": "XC-9000", "btu": "12000"},
			Version: 1,
		},
		{
			Id:      qdrant.NewID("point-2"),
			Score:   0.87,
			Payload: map[string]interface{}{"brand": "Springer", "model": "XC-8000", "btu": "9000"},
			Version: 1,
		},
	}

	client := &mockQdrantClient{queryResp: mockResp}

	layer := &QdrantLayer{
		client:     client,
		collection: "hvacr_knowledge",
	}

	ctx := context.Background()
	results, err := layer.HybridSearch(ctx, "Springer XC-9000", nil, 10)

	require.NoError(t, err)
	require.Len(t, results, 2)
	assert.Equal(t, "point-1", results[0].ID)
	assert.Equal(t, 0.95, results[0].Score)
	assert.Equal(t, "Springer", results[0].Payload["brand"])
	assert.Equal(t, "point-2", results[1].ID)
	assert.Equal(t, 0.87, results[1].Score)
}

// TestSparseAndDenseFusion tests RRF fusion of sparse + dense scores.
func TestSparseAndDenseFusion(t *testing.T) {
	// RRF (Reciprocal Rank Fusion) formula: 1/(k+rank)
	// k is typically 60
	k := 60

	denseResults := []struct {
		id    string
		score float64
	}{
		{"doc-A", 0.9},
		{"doc-B", 0.8},
		{"doc-C", 0.7},
	}

	sparseResults := []struct {
		id    string
		score float64
	}{
		{"doc-B", 0.95},
		{"doc-C", 0.85},
		{"doc-D", 0.75},
	}

	// Build rank maps
	denseRank := make(map[string]int)
	for i, r := range denseResults {
		denseRank[r.id] = i + 1
	}

	sparseRank := make(map[string]int)
	for i, r := range sparseResults {
		sparseRank[r.id] = i + 1
	}

	// All unique docs
	allDocs := []string{"doc-A", "doc-B", "doc-C", "doc-D"}

	// Calculate RRF scores
	rrfScores := make(map[string]float64)
	for _, doc := range allDocs {
		score := 0.0
		if rank, ok := denseRank[doc]; ok {
			score += 1.0 / float64(k+rank)
		}
		if rank, ok := sparseRank[doc]; ok {
			score += 1.0 / float64(k+rank)
		}
		rrfScores[doc] = score
	}

	// doc-B should rank first (top in both)
	assert.Greater(t, rrfScores["doc-B"], rrfScores["doc-A"])
	assert.Greater(t, rrfScores["doc-B"], rrfScores["doc-C"])
	assert.Greater(t, rrfScores["doc-B"], rrfScores["doc-D"])

	// doc-A has only dense, doc-D has only sparse
	// doc-A dense rank 1, doc-D sparse rank 3
	// doc-A = 1/(60+1) = 0.0164
	// doc-D = 1/(60+3) = 0.0159
	assert.Greater(t, rrfScores["doc-A"], rrfScores["doc-D"])

	t.Logf("RRF scores: %v", rrfScores)
}

func TestQdrantLayer_CollectionExists(t *testing.T) {
	client := &mockQdrantClient{}
	layer := &QdrantLayer{
		client:     client,
		collection: "hvacr_knowledge",
	}

	ctx := context.Background()
	exists, err := layer.CollectionExists(ctx, "hvacr_knowledge")
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestQdrantLayer_HybridSearch_WithFilters(t *testing.T) {
	mockResp := []*qdrant.SearchResult{
		{
			Id:      qdrant.NewID("point-1"),
			Score:   0.92,
			Payload: map[string]interface{}{"brand": "Springer", "error_code": "E5"},
			Version: 1,
		},
	}

	client := &mockQdrantClient{queryResp: mockResp}
	layer := &QdrantLayer{
		client:     client,
		collection: "hvacr_knowledge",
	}

	ctx := context.Background()
	filters := map[string]string{"brand": "Springer"}
	results, err := layer.HybridSearch(ctx, "error E5", filters, 5)

	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "point-1", results[0].ID)
	assert.Equal(t, "Springer", results[0].Payload["brand"])
}

func TestQdrantLayer_SearchSparse(t *testing.T) {
	mockResp := []*qdrant.SearchResult{
		{
			Id:      qdrant.NewID("sparse-1"),
			Score:   0.88,
			Payload: map[string]interface{}{"brand": "Springer", "model": "XC-9000"},
			Version: 1,
		},
	}

	client := &mockQdrantClient{queryResp: mockResp}
	layer := &QdrantLayer{
		client:     client,
		collection: "hvacr_knowledge",
	}

	ctx := context.Background()
	results, err := layer.SearchSparse(ctx, "Springer", nil, 10)

	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "sparse-1", results[0].ID)
	assert.Equal(t, "Springer", results[0].Payload["brand"])
}

func TestQdrantLayer_UpsertPoint(t *testing.T) {
	client := &mockQdrantClient{}
	layer := &QdrantLayer{
		client:     client,
		collection: "hvacr_knowledge",
	}

	ctx := context.Background()
	vector := make([]float32, 768)
	for i := range vector {
		vector[i] = 0.1 * float32(i%10)
	}
	payload := map[string]any{
		"brand":      "Springer",
		"model":      "XC-9000",
		"btu":        "12000",
		"error_code": "E5",
	}

	err := layer.UpsertPoint(ctx, "test-point-1", vector, payload)
	require.NoError(t, err)
}

func TestQdrantLayer_DeletePoint(t *testing.T) {
	client := &mockQdrantClient{}
	layer := &QdrantLayer{
		client:     client,
		collection: "hvacr_knowledge",
	}

	ctx := context.Background()
	err := layer.DeletePoint(ctx, "test-point-1")
	require.NoError(t, err)
}
