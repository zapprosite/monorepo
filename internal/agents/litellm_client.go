package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultLiteLLMModel       = "hermes-auto"
	defaultLiteLLMChatBaseURL = "http://localhost:4018/v1"
	HermesAutoModel           = "hermes-auto"
	HermesLocalCodeModel      = "hermes-local-code"
	HermesVisionModel         = "hermes-vision"
	HermesEmbedModel          = "hermes-embed"
	HermesBrainModel          = "hermes-brain"
)

// LiteLLMMessage represents a chat message sent through LiteLLM's OpenAI-compatible API.
type LiteLLMMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// LiteLLMChatRequest is the OpenAI-compatible chat completion request used by LiteLLM.
type LiteLLMChatRequest struct {
	Model     string           `json:"model"`
	Messages  []LiteLLMMessage `json:"messages"`
	MaxTokens int              `json:"max_tokens,omitempty"`
}

type liteLLMChatResponse struct {
	Choices []struct {
		Message LiteLLMMessage `json:"message"`
	} `json:"choices"`
}

// LiteLLMClientConfig configures the LiteLLM client.
type LiteLLMClientConfig struct {
	APIKey     string
	BaseURL    string
	Model      string
	HTTPClient *http.Client
}

// LiteLLMClient calls the LiteLLM proxy using OpenAI-compatible chat completions.
type LiteLLMClient struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

// NewLiteLLMClient creates a client using repo-standard LiteLLM env vars.
func NewLiteLLMClient(apiKey string) *LiteLLMClient {
	return NewLiteLLMClientWithConfig(LiteLLMClientConfig{
		APIKey: apiKey,
	})
}

// NewLiteLLMClientWithModel creates a client pinned to a LiteLLM model alias.
func NewLiteLLMClientWithModel(apiKey, model string) *LiteLLMClient {
	return NewLiteLLMClientWithConfig(LiteLLMClientConfig{
		APIKey: apiKey,
		Model:  model,
	})
}

// NewLiteLLMClientWithConfig creates a client with explicit settings for tests or custom wiring.
func NewLiteLLMClientWithConfig(config LiteLLMClientConfig) *LiteLLMClient {
	apiKey := firstNonEmpty(
		config.APIKey,
		os.Getenv("LITELLM_API_KEY"),
		os.Getenv("LITELLM_MASTER_KEY"),
	)
	baseURL := firstNonEmpty(
		config.BaseURL,
		os.Getenv("LITELLM_LOCAL_URL"),
		os.Getenv("LITELLM_URL"),
		defaultLiteLLMChatBaseURL,
	)
	model := firstNonEmpty(
		config.Model,
		os.Getenv("LITELLM_DEFAULT_MODEL"),
		defaultLiteLLMModel,
	)
	httpClient := config.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}

	return &LiteLLMClient{
		apiKey:     apiKey,
		baseURL:    strings.TrimRight(baseURL, "/"),
		model:      model,
		httpClient: httpClient,
	}
}

// Configured reports whether the client has credentials to call LiteLLM.
func (c *LiteLLMClient) Configured() bool {
	return c != nil && c.apiKey != ""
}

// Chat sends a single-prompt chat completion request.
func (c *LiteLLMClient) Chat(ctx context.Context, prompt string, maxTokens int) (string, error) {
	if !c.Configured() {
		return "", fmt.Errorf("litellm API key not configured")
	}

	reqBody := LiteLLMChatRequest{
		Model: c.model,
		Messages: []LiteLLMMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens: maxTokens,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	endpoint := c.baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("LiteLLM returned status %d", resp.StatusCode)
	}

	var result liteLLMChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("empty response from LiteLLM")
	}

	return result.Choices[0].Message.Content, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
