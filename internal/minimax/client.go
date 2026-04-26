package minimax

import (
	"net/http"
	"os"
)

// Client is the base HTTP client for MiniMax API.
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new MiniMax API client.
// The API key can be set via MINIMAX_API_KEY environment variable.
func NewClient() *Client {
	apiKey := os.Getenv("MINIMAX_API_KEY")
	return &Client{
		apiKey:     apiKey,
		baseURL:    "https://api.minimax.io/anthropic",
		httpClient: &http.Client{},
	}
}

// NewClientWithKey creates a client with an explicit API key.
func NewClientWithKey(apiKey string) *Client {
	return &Client{
		apiKey:     apiKey,
		baseURL:    "https://api.minimax.io/anthropic",
		httpClient: &http.Client{},
	}
}

// NewClientWithKeyAndBaseURL creates a client with explicit API key and base URL.
func NewClientWithKeyAndBaseURL(apiKey, baseURL string) *Client {
	return &Client{
		apiKey:     apiKey,
		baseURL:    baseURL,
		httpClient: &http.Client{},
	}
}

// HTTPClient returns the underlying http.Client.
func (c *Client) HTTPClient() *http.Client {
	return c.httpClient
}

// BaseURL returns the base URL for API requests.
func (c *Client) BaseURL() string {
	return c.baseURL
}

// APIKey returns the API key.
func (c *Client) APIKey() string {
	return c.apiKey
}

// Ensure Client implements httpClient interface.
var _ interface {
	HTTPClient() *http.Client
	BaseURL() string
	APIKey() string
} = (*Client)(nil)
