package agents

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLiteLLMClientChatUsesLiteLLMOpenAICompatibleEndpoint(t *testing.T) {
	var captured struct {
		Path          string
		Authorization string
		Body          LiteLLMChatRequest
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured.Path = r.URL.Path
		captured.Authorization = r.Header.Get("Authorization")
		require.NoError(t, json.NewDecoder(r.Body).Decode(&captured.Body))

		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"technical"}}]}`))
		require.NoError(t, err)
	}))
	defer server.Close()

	client := NewLiteLLMClientWithConfig(LiteLLMClientConfig{
		APIKey:  "test-key",
		BaseURL: server.URL + "/v1",
		Model:   "hermes-auto",
	})

	resp, err := client.Chat(context.Background(), "Classifique a intenção", 100)
	require.NoError(t, err)
	require.Equal(t, "technical", resp)
	require.Equal(t, "/v1/chat/completions", captured.Path)
	require.Equal(t, "Bearer test-key", captured.Authorization)
	require.Equal(t, "hermes-auto", captured.Body.Model)
	require.Equal(t, 100, captured.Body.MaxTokens)
	require.Equal(t, "user", captured.Body.Messages[0].Role)
}
