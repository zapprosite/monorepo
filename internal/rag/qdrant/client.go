package qdrant

import (
	"context"
	"fmt"

	"github.com/qdrant/go-client/qdrant"
)

const (
	// CollectionName is the Qdrant collection name for HVAC service manuals
	CollectionName = "hvac_service_manuals"
	// VectorSize is the embedding dimension (MiniMax = 1024D)
	VectorSize = 1024
)

// Client wraps the Qdrant client for HVAC RAG operations
type Client struct {
	client     *qdrant.Client
	collection string
}

// NewClient creates a new Qdrant client for HVAC RAG
func NewClient(addr string) (*Client, error) {
	client, err := qdrant.NewClient(&qdrant.Config{
		Host: addr,
	})
	if err != nil {
		return nil, fmt.Errorf("qdrant client: %w", err)
	}
	return &Client{
		client:     client,
		collection: CollectionName,
	}, nil
}

// CreateCollection creates the hvac_service_manuals collection with proper schema
func (c *Client) CreateCollection(ctx context.Context) error {
	// Check if collection already exists
	exists, err := c.client.CollectionExists(ctx, c.collection)
	if err != nil {
		return fmt.Errorf("check collection exists: %w", err)
	}
	if exists {
		return nil // Already exists
	}

	// Create with vectors config for dense + sparse
	defaultSegmentNumber := uint64(2)
	req := &qdrant.CreateCollection{
		CollectionName: c.collection,
		VectorsConfig: qdrant.NewVectorsConfig(&qdrant.VectorParams{
			Size:     VectorSize,
			Distance: qdrant.Distance_Cosine,
		}),
		OptimizersConfig: &qdrant.OptimizersConfigDiff{
			DefaultSegmentNumber: &defaultSegmentNumber,
		},
	}

	err = c.client.CreateCollection(ctx, req)
	if err != nil {
		return fmt.Errorf("create collection: %w", err)
	}

	return nil
}

// UpsertPoint inserts or updates a point in the collection
func (c *Client) UpsertPoint(ctx context.Context, id string, vector []float32, payload map[string]any) error {
	pt := &qdrant.PointStruct{
		Id:      qdrant.NewID(id),
		Vectors: qdrant.NewVectors(vector...),
		Payload: qdrant.NewValueMap(payload),
	}

	waitUpsert := true
	_, err := c.client.Upsert(ctx, &qdrant.UpsertPoints{
		CollectionName: c.collection,
		Points:        []*qdrant.PointStruct{pt},
		Wait:          &waitUpsert,
	})
	if err != nil {
		return fmt.Errorf("upsert point: %w", err)
	}
	return nil
}

// Search performs vector search with metadata filtering
func (c *Client) Search(ctx context.Context, vector []float32, filters map[string]string, limit int) ([]SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}

	// Build filter conditions
	var mustConditions []*qdrant.Condition
	for key, value := range filters {
		mustConditions = append(mustConditions, qdrant.NewMatch(key, value))
	}

	var flt *qdrant.Filter
	if len(mustConditions) > 0 {
		flt = &qdrant.Filter{Must: mustConditions}
	}

	limit64 := uint64(limit)
	req := &qdrant.QueryPoints{
		CollectionName: c.collection,
		Query:          qdrant.NewQueryDense(vector),
		Limit:          &limit64,
		WithPayload:    qdrant.NewWithPayloadEnable(true),
		Filter:         flt,
	}

	results, err := c.client.Query(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("qdrant query: %w", err)
	}

	return convertToSearchResults(results), nil
}

// SearchResult represents a search result from Qdrant
type SearchResult struct {
	ID      string
	Score   float64
	Payload map[string]interface{}
}

// convertToSearchResults converts Qdrant results to our struct
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
		})
	}
	return searchResults
}

// Close closes the Qdrant client
func (c *Client) Close() error {
	return c.client.Close()
}
