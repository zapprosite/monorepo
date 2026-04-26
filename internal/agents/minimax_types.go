package agents

// MiniMaxMessage represents a message in the MiniMax Anthropic-compatible API.
type MiniMaxMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// MiniMaxRequest represents a request to the MiniMax Messages API.
type MiniMaxRequest struct {
	Model     string           `json:"model"`
	Messages  []MiniMaxMessage `json:"messages"`
	MaxTokens int              `json:"max_tokens,omitempty"`
}

// MiniMaxResponse represents the response from MiniMax Messages API.
type MiniMaxResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}
