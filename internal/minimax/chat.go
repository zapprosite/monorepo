package minimax

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// ChatMessage represents a message in a chat conversation.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest is the request body for chat completions.
type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Temperature float64       `json:"temperature,omitempty"`
	TopP        float64       `json:"top_p,omitempty"`
	Stream      bool          `json:"stream,omitempty"`
	System      string        `json:"system,omitempty"`
}

// ChatResponse is the response from chat completions.
type ChatResponse struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Role     string                 `json:"role"`
	Content  []ChatContentBlock     `json:"content"`
	Model    string                 `json:"model"`
	StopReason string               `json:"stop_reason,omitempty"`
	Usage    *ChatUsage             `json:"usage,omitempty"`
}

// ChatContentBlock represents a content block in the response.
type ChatContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// ChatUsage represents token usage statistics.
type ChatUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// ChatClient handles chat completions with MiniMax.
type ChatClient struct {
	client *Client
	model  string
}

// NewChatClient creates a new MiniMax chat client.
func NewChatClient() *ChatClient {
	return &ChatClient{
		client: NewClient(),
		model:  "MiniMax-M2",
	}
}

// NewChatClientWithKey creates a chat client with an explicit API key.
func NewChatClientWithKey(apiKey string) *ChatClient {
	return &ChatClient{
		client: NewClientWithKey(apiKey),
		model:  "MiniMax-M2",
	}
}

// NewChatClientWithModel creates a chat client with a specific model.
func NewChatClientWithModel(apiKey, model string) *ChatClient {
	return &ChatClient{
		client: NewClientWithKey(apiKey),
		model:  model,
	}
}

// Chat creates a chat completion using the Anthropic-compatible /v1/messages endpoint.
func (c *ChatClient) Chat(ctx context.Context, messages []ChatMessage, opts ...ChatOption) (*ChatResponse, error) {
	if c.client.apiKey == "" {
		return nil, fmt.Errorf("MINIMAX_API_KEY not set")
	}

	req := ChatRequest{
		Model:    c.model,
		Messages: messages,
	}

	for _, opt := range opts {
		opt(&req)
	}

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/v1/messages", c.client.baseURL)
	reqHTTP, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	reqHTTP.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.client.apiKey))
	reqHTTP.Header.Set("Content-Type", "application/json")
	reqHTTP.Header.Set("anthropic-version", "2023-06-01")
	reqHTTP.Header.Set("anthropic-dangerous-direct-browser-access", "true")

	resp, err := c.client.httpClient.Do(reqHTTP)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errResp)
		return nil, fmt.Errorf("API returned status %d: %v", resp.StatusCode, errResp)
	}

	var result ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// ChatOption is a functional option for chat requests.
type ChatOption func(*ChatRequest)

// WithMaxTokens sets the maximum number of tokens to generate.
func WithMaxTokens(maxTokens int) ChatOption {
	return func(r *ChatRequest) {
		r.MaxTokens = maxTokens
	}
}

// WithTemperature sets the sampling temperature.
func WithTemperature(temp float64) ChatOption {
	return func(r *ChatRequest) {
		r.Temperature = temp
	}
}

// WithTopP sets the top-p sampling parameter.
func WithTopP(topP float64) ChatOption {
	return func(r *ChatRequest) {
		r.TopP = topP
	}
}

// WithSystem sets a system prompt.
func WithSystem(system string) ChatOption {
	return func(r *ChatRequest) {
		r.System = system
	}
}

// WithModel sets the model for a specific request.
func WithModel(model string) ChatOption {
	return func(r *ChatRequest) {
		r.Model = model
	}
}

// ChatStreamResponse represents a streamed chat response chunk.
type ChatStreamResponse struct {
	Type string `json:"type"`
	ID   string `json:"id"`

	// For content_block_start
	ContentBlock *ChatContentBlock `json:"content_block,omitempty"`

	// For content_block_delta
	Delta *ChatDelta `json:"delta,omitempty"`

	// For message_start, message_delta, message_stop
	Message *ChatStreamMessage `json:"message,omitempty"`

	// For error
	Error *ChatStreamError `json:"error,omitempty"`
}

// ChatDelta represents a delta/update to a content block.
type ChatDelta struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// ChatStreamMessage represents message-level events in streaming.
type ChatStreamMessage struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Role     string       `json:"role"`
	Content  []ChatContentBlock `json:"content"`
	Model    string       `json:"model"`
	StopReason string     `json:"stop_reason,omitempty"`
	Usage    *ChatUsage   `json:"usage,omitempty"`
}

// ChatStreamError represents an error in streaming.
type ChatStreamError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// ChatStreamEventHandler is a callback for handling stream events.
type ChatStreamEventHandler func(ChatStreamResponse) error

// StreamChat creates a streaming chat completion.
func (c *ChatClient) StreamChat(ctx context.Context, messages []ChatMessage, handler ChatStreamEventHandler, opts ...ChatOption) error {
	if c.client.apiKey == "" {
		return fmt.Errorf("MINIMAX_API_KEY not set")
	}

	req := ChatRequest{
		Model:    c.model,
		Messages: messages,
		Stream:   true,
	}

	for _, opt := range opts {
		opt(&req)
	}

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/v1/messages", c.client.baseURL)
	reqHTTP, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	reqHTTP.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.client.apiKey))
	reqHTTP.Header.Set("Content-Type", "application/json")
	reqHTTP.Header.Set("anthropic-version", "2023-06-01")
	reqHTTP.Header.Set("anthropic-dangerous-direct-browser-access", "true")

	resp, err := c.client.httpClient.Do(reqHTTP)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errResp)
		return fmt.Errorf("API returned status %d: %v", resp.StatusCode, errResp)
	}

	// Handle SSE stream
	decoder := json.NewDecoder(resp.Body)
	for decoder.More() {
		var event ChatStreamResponse
		if err := decoder.Decode(&event); err != nil {
			return fmt.Errorf("decode stream event: %w", err)
		}
		if err := handler(event); err != nil {
			return err
		}
	}

	return nil
}
