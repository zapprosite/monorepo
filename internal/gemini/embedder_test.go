package gemini

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewEmbedder(t *testing.T) {
	e := NewEmbedderWithKey("test-api-key")
	assert.NotNil(t, e)
	assert.Equal(t, "test-api-key", e.apiKey)
	assert.Equal(t, "gemini-embedding-2", e.model)
	assert.NotNil(t, e.httpClient)
}

func TestEmbedder_Embed_SingleText(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req BatchEmbedContentsRequest
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(t, err)
		require.Len(t, req.Texts, 1)

		resp := BatchEmbedContentsResponse{
			Embeddings: []Embedding{
				{Values: []float32{0.1, 0.2, 0.3}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	e := &Embedder{
		apiKey:     "test-key",
		model:      "gemini-embedding-2",
		endpoint:   server.URL,
		httpClient: &http.Client{},
	}

	ctx := context.Background()
	result, err := e.Embed(ctx, "hello world")
	require.NoError(t, err)
	require.Len(t, result, 3)
	assert.Equal(t, float32(0.1), result[0])
	assert.Equal(t, float32(0.2), result[1])
	assert.Equal(t, float32(0.3), result[2])
}

func TestEmbedder_Embed_NoAPIKey(t *testing.T) {
	e := &Embedder{
		apiKey:     "",
		model:      "gemini-embedding-2",
		endpoint:   "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-002:batchEmbedContents",
		httpClient: &http.Client{},
	}

	ctx := context.Background()
	_, err := e.Embed(ctx, "test")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "GEMINI_API_KEY not set")
}

func TestEmbedder_BatchEmbed_MultipleTexts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req BatchEmbedContentsRequest
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(t, err)
		require.Len(t, req.Texts, 2)

		resp := BatchEmbedContentsResponse{
			Embeddings: []Embedding{
				{Values: []float32{0.1, 0.2}},
				{Values: []float32{0.3, 0.4}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	e := &Embedder{
		apiKey:     "test-key",
		model:      "gemini-embedding-2",
		endpoint:   server.URL,
		httpClient: &http.Client{},
	}

	ctx := context.Background()
	results, err := e.BatchEmbed(ctx, []string{"hello", "world"})
	require.NoError(t, err)
	require.Len(t, results, 2)
	assert.Len(t, results[0], 2)
	assert.Len(t, results[1], 2)
}

func TestEmbedder_BatchEmbed_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
	}))
	defer server.Close()

	e := &Embedder{
		apiKey:     "test-key",
		model:      "gemini-embedding-2",
		endpoint:   server.URL,
		httpClient: &http.Client{},
	}

	ctx := context.Background()
	_, err := e.BatchEmbed(ctx, []string{"test"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "status 500")
}

func TestEmbedder_BatchEmbed_EmptyResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := BatchEmbedContentsResponse{
			Embeddings: []Embedding{},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	e := &Embedder{
		apiKey:     "test-key",
		model:      "gemini-embedding-2",
		endpoint:   server.URL,
		httpClient: &http.Client{},
	}

	ctx := context.Background()
	_, err := e.Embed(ctx, "test")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no embedding returned")
}

func TestEmbedder_BatchEmbed_JSONDecodeError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("not json"))
	}))
	defer server.Close()

	e := &Embedder{
		apiKey:     "test-key",
		model:      "gemini-embedding-2",
		endpoint:   server.URL,
		httpClient: &http.Client{},
	}

	ctx := context.Background()
	_, err := e.BatchEmbed(ctx, []string{"test"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "decode response")
}

func TestBatchEmbedContentsRequest_JSON(t *testing.T) {
	req := BatchEmbedContentsRequest{
		Model: "gemini-embedding-2",
		Texts: []string{"text1", "text2"},
	}

	data, err := json.Marshal(req)
	require.NoError(t, err)

	var restored BatchEmbedContentsRequest
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)

	assert.Equal(t, "gemini-embedding-2", restored.Model)
	assert.Len(t, restored.Texts, 2)
	assert.Equal(t, "text1", restored.Texts[0])
	assert.Equal(t, "text2", restored.Texts[1])
}

func TestBatchEmbedContentsResponse_JSON(t *testing.T) {
	resp := BatchEmbedContentsResponse{
		Embeddings: []Embedding{
			{Values: []float32{0.1, 0.2, 0.3}},
		},
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	var restored BatchEmbedContentsResponse
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)

	require.Len(t, restored.Embeddings, 1)
	assert.Len(t, restored.Embeddings[0].Values, 3)
}

func TestEmbedding_Struct(t *testing.T) {
	emb := Embedding{
		Values: []float32{1.0, 2.0, 3.0},
	}

	assert.Len(t, emb.Values, 3)
	assert.Equal(t, float32(1.0), emb.Values[0])
}

func TestEmbedder_BatchEmbed_EmptyTexts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req BatchEmbedContentsRequest
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(t, err)

		resp := BatchEmbedContentsResponse{
			Embeddings: []Embedding{},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	e := &Embedder{
		apiKey:     "test-key",
		model:      "gemini-embedding-2",
		endpoint:   server.URL,
		httpClient: &http.Client{},
	}

	ctx := context.Background()
	results, err := e.BatchEmbed(ctx, []string{})
	require.NoError(t, err)
	assert.Len(t, results, 0)
}

func TestNewEmbedderWithKey(t *testing.T) {
	e := NewEmbedderWithKey("explicit-key-123")
	assert.Equal(t, "explicit-key-123", e.apiKey)
	assert.Equal(t, "gemini-embedding-2", e.model)
}

func TestEmbedderInterface_Implied(t *testing.T) {
	var _ EmbedderInterface = (*Embedder)(nil)
}