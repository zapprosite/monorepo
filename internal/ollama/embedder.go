package ollama

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/circuitbreaker"
)

// Embedder generates embeddings using Ollama's embedding API.
type Embedder struct {
	baseURL   string
	model     string
	httpClient *http.Client
	cb        *circuitbreaker.CircuitBreaker
}

// NewEmbedder creates a new Ollama Embedder with the default settings.
func NewEmbedder() *Embedder {
	return &Embedder{
		baseURL:   "http://10.0.5.1:11434",
		model:     "nomic-embed-text",
		httpClient: &http.Client{Timeout: 30 * time.Second},
		cb:        circuitbreaker.New(5, 30*time.Second),
	}
}

// NewEmbedderWithBaseURL creates an embedder with a custom base URL.
func NewEmbedderWithBaseURL(baseURL, model string) *Embedder {
	return &Embedder{
		baseURL:   baseURL,
		model:     model,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		cb:        circuitbreaker.New(5, 30*time.Second),
	}
}

// EmbedRequest is the request body for Ollama embedding.
type EmbedRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

// EmbedResponse is the response from Ollama embedding.
type EmbedResponse struct {
	Embedding []float32 `json:"embedding"`
}

// Embed generates an embedding for a single text input.
func (e *Embedder) Embed(ctx context.Context, text string) ([]float32, error) {
	reqBody := EmbedRequest{
		Model:  e.model,
		Prompt: text,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/embeddings", e.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	var result EmbedResponse
	var cbErr error

	cbErr = e.cb.Call(func() error {
		resp, err := e.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("execute request: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("API returned status %d", resp.StatusCode)
		}

		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
		return nil
	})

	if cbErr != nil {
		return nil, cbErr
	}

	if len(result.Embedding) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}

	return result.Embedding, nil
}

// BatchEmbedRequest is the request body for batch embedding via Ollama.
type BatchEmbedRequest struct {
	Model   string   `json:"model"`
	Prompts []string `json:"prompts"`
}

// BatchEmbedResponse is the response from batch embedding.
type BatchEmbedResponse struct {
	Embeddings [][]float32 `json:"embeddings"`
}

// BatchEmbed generates embeddings for multiple text inputs.
func (e *Embedder) BatchEmbed(ctx context.Context, texts []string) ([][]float32, error) {
	reqBody := BatchEmbedRequest{
		Model:   e.model,
		Prompts: texts,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/embeddings", e.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	var result BatchEmbedResponse
	var cbErr error

	cbErr = e.cb.Call(func() error {
		resp, err := e.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("execute request: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("API returned status %d", resp.StatusCode)
		}

		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
		return nil
	})

	if cbErr != nil {
		return nil, cbErr
	}

	if len(result.Embeddings) == 0 {
		return nil, fmt.Errorf("no embeddings returned")
	}

	return result.Embeddings, nil
}

// EmbedderInterface defines the interface for embedding providers.
type EmbedderInterface interface {
	Embed(ctx context.Context, text string) ([]float32, error)
	BatchEmbed(ctx context.Context, texts []string) ([][]float32, error)
}

// Ensure Embedder implements EmbedderInterface.
var _ EmbedderInterface = (*Embedder)(nil)
