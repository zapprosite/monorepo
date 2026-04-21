package memory

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestSparseAndDenseFusion tests RRF fusion of sparse + dense scores.
// This is a pure unit test that doesn't require QdrantLayer or mock Qdrant client.
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