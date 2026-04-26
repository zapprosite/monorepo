package indexer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/circuitbreaker"
)

// OllamaEmbedder handles embedding generation via Ollama API
type OllamaEmbedder struct {
	baseURL  string
	model    string
	cb       *circuitbreaker.CircuitBreaker
	client   *http.Client
}

// NewOllamaEmbedder creates a new Ollama embedder
func NewOllamaEmbedder(baseURL string) *OllamaEmbedder {
	return &OllamaEmbedder{
		baseURL: baseURL,
		model:   "nomic-embed-text",
		cb:      circuitbreaker.New(5, 30*time.Second),
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// EmbedRequest is the Ollama embedding request
type EmbedRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

// EmbedResponse is the Ollama embedding response
type EmbedResponse struct {
	Embedding []float32 `json:"embedding"`
}

// Embed generates embeddings for the given text using Ollama
func (e *OllamaEmbedder) Embed(ctx context.Context, text string) ([]float32, error) {
	reqBody := EmbedRequest{
		Model:  e.model,
		Prompt: text,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	var respBody EmbedResponse
	err = e.cb.Call(func() error {
		req, err := http.NewRequestWithContext(ctx, "POST", e.baseURL+"/api/embeddings", bytes.NewBuffer(jsonBody))
		if err != nil {
			return fmt.Errorf("create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := e.client.Do(req)
		if err != nil {
			return fmt.Errorf("do request: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("HTTP %d", resp.StatusCode)
		}

		if err := json.NewDecoder(resp.Body).Decode(&respBody); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("embed: %w", err)
	}

	return respBody.Embedding, nil
}

// EmbedBatch generates embeddings for multiple texts
func (e *OllamaEmbedder) EmbedBatch(ctx context.Context, texts []string) ([][]float32, error) {
	embeddings := make([][]float32, 0, len(texts))

	for _, text := range texts {
		emb, err := e.Embed(ctx, text)
		if err != nil {
			return nil, fmt.Errorf("embed batch at %d: %w", len(embeddings), err)
		}
		embeddings = append(embeddings, emb)
	}

	return embeddings, nil
}

// GetDimension returns the embedding vector dimension
func (e *OllamaEmbedder) GetDimension() int {
	// nomic-embed-text outputs 768D
	return 768
}
