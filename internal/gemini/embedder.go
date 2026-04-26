package gemini

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/circuitbreaker"
)

// Embedder generates embeddings using Gemini Embedding API.
type Embedder struct {
	apiKey    string
	model     string
	endpoint  string
	httpClient *http.Client
	cb        *circuitbreaker.CircuitBreaker
}

// NewEmbedder creates a new Gemini Embedder.
// The API key can be set via GEMINI_API_KEY environment variable.
func NewEmbedder() *Embedder {
	apiKey := os.Getenv("GEMINI_API_KEY")
	return &Embedder{
		apiKey:    apiKey,
		model:     "gemini-embedding-2", // 768 dimensions
		endpoint:  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-002:batchEmbedContents",
		httpClient: &http.Client{},
		cb:        circuitbreaker.New(5, 30*time.Second),
	}
}

// NewEmbedderWithKey creates an embedder with an explicit API key.
func NewEmbedderWithKey(apiKey string) *Embedder {
	return &Embedder{
		apiKey:    apiKey,
		model:     "gemini-embedding-2",
		endpoint:  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-002:batchEmbedContents",
		httpClient: &http.Client{},
		cb:        circuitbreaker.New(5, 30*time.Second),
	}
}

// Embedding represents a vector embedding.
type Embedding struct {
	Values []float32 `json:"embedding_values"`
}

// BatchEmbedContentsRequest is the request body for batch embedding.
type BatchEmbedContentsRequest struct {
	Model string        `json:"model"`
	Texts []string      `json:"texts"`
}

// BatchEmbedContentsResponse is the response from batch embedding.
type BatchEmbedContentsResponse struct {
	Embeddings []Embedding `json:"embeddings"`
}

// Embed generates an embedding for a single text input.
// Returns a 768-dimensional vector.
func (e *Embedder) Embed(ctx context.Context, text string) ([]float32, error) {
	resp, err := e.BatchEmbed(ctx, []string{text})
	if err != nil {
		return nil, err
	}
	if len(resp) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}
	return resp[0], nil
}

// BatchEmbed generates embeddings for multiple text inputs.
func (e *Embedder) BatchEmbed(ctx context.Context, texts []string) ([][]float32, error) {
	var embeddings [][]float32
	var cbErr error

	cbErr = e.cb.Call(func() error {
		embs, err := e.batchEmbedInternal(ctx, texts)
		if err != nil {
			return err
		}
		embeddings = embs
		return nil
	})
	if cbErr != nil {
		return nil, cbErr
	}
	return embeddings, nil
}

// batchEmbedInternal performs the actual batch embedding request.
func (e *Embedder) batchEmbedInternal(ctx context.Context, texts []string) ([][]float32, error) {
	if e.apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not set")
	}

	reqBody := BatchEmbedContentsRequest{
		Model: e.model,
		Texts: texts,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s?key=%s", e.endpoint, e.apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var batchResult BatchEmbedContentsResponse
	if err := json.NewDecoder(resp.Body).Decode(&batchResult); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	embeddings := make([][]float32, 0, len(batchResult.Embeddings))
	for _, emb := range batchResult.Embeddings {
		embeddings = append(embeddings, emb.Values)
	}

	return embeddings, nil
}

// EmbedderInterface defines the interface for embedding providers.
type EmbedderInterface interface {
	Embed(ctx context.Context, text string) ([]float32, error)
	BatchEmbed(ctx context.Context, texts []string) ([][]float32, error)
}

// Ensure Embedder implements EmbedderInterface.
var _ EmbedderInterface = (*Embedder)(nil)