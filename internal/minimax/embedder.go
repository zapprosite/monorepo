package minimax

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

// Embedder generates embeddings using MiniMax Embedding API.
type Embedder struct {
	apiKey     string
	model      string
	endpoint   string
	httpClient *http.Client
	cb         *circuitbreaker.CircuitBreaker
}

// NewEmbedder creates a new MiniMax Embedder.
func NewEmbedder() *Embedder {
	apiKey := os.Getenv("MINIMAX_API_KEY")
	return &Embedder{
		apiKey:     apiKey,
		model:      "embedding-256",
		endpoint:   "https://api.minimax.io/v1/embeddings",
		httpClient: &http.Client{},
		cb:         circuitbreaker.New(5, 30*time.Second),
	}
}

// NewEmbedderWithKey creates an embedder with an explicit API key.
func NewEmbedderWithKey(apiKey string) *Embedder {
	return &Embedder{
		apiKey:     apiKey,
		model:      "embedding-256",
		endpoint:   "https://api.minimax.io/v1/embeddings",
		httpClient: &http.Client{},
		cb:         circuitbreaker.New(5, 30*time.Second),
	}
}

// EmbedRequest is the request body for embedding.
type EmbedRequest struct {
	Model string  `json:"model"`
	Input string  `json:"input"`
}

// EmbedResponse is the response from embedding.
type EmbedResponse struct {
	Data   []EmbedData `json:"data"`
	Model  string      `json:"model"`
	Usage  EmbedUsage  `json:"usage"`
}

// EmbedData represents an embedding vector.
type EmbedData struct {
	Object    string    `json:"object"`
	Embedding []float32 `json:"embedding"`
	Index     int       `json:"index"`
}

// EmbedUsage represents token usage.
type EmbedUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// Embed generates an embedding for a single text input.
func (e *Embedder) Embed(ctx context.Context, text string) ([]float32, error) {
	if e.apiKey == "" {
		return nil, fmt.Errorf("MINIMAX_API_KEY not set")
	}

	reqBody := EmbedRequest{
		Model: e.model,
		Input: text,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.endpoint, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", e.apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var result EmbedResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(result.Data) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}

	return result.Data[0].Embedding, nil
}

// BatchEmbedRequest is the request body for batch embedding.
type BatchEmbedRequest struct {
	Model  string   `json:"model"`
	Inputs []string `json:"inputs"`
}

// BatchEmbedResponse is the response from batch embedding.
type BatchEmbedResponse struct {
	Data   []EmbedData `json:"data"`
	Model  string      `json:"model"`
	Usage  EmbedUsage  `json:"usage"`
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
		return nil, fmt.Errorf("MINIMAX_API_KEY not set")
	}

	reqBody := BatchEmbedRequest{
		Model:  e.model,
		Inputs: texts,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.endpoint, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", e.apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var result BatchEmbedResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	embeds := make([][]float32, 0, len(result.Data))
	for _, emb := range result.Data {
		embeds = append(embeds, emb.Embedding)
	}

	return embeds, nil
}

// EmbedderInterface defines the interface for embedding providers.
type EmbedderInterface interface {
	Embed(ctx context.Context, text string) ([]float32, error)
	BatchEmbed(ctx context.Context, texts []string) ([][]float32, error)
}

// Ensure Embedder implements EmbedderInterface.
var _ EmbedderInterface = (*Embedder)(nil)
