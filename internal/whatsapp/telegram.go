package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// TelegramBotClient sends messages via the Telegram Bot API.
type TelegramBotClient struct {
	Token   string
	ChatID  string
	BaseURL string
	Client  *http.Client
}

// NewTelegramBotClient creates a new Telegram bot client.
func NewTelegramBotClient(token, chatID string) *TelegramBotClient {
	return &TelegramBotClient{
		Token:   token,
		ChatID:  chatID,
		BaseURL: "https://api.telegram.org/bot" + token,
		Client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// TelegramSendResponse represents the Telegram API response for sendMessage.
type TelegramSendResponse struct {
	OK     bool `json:"ok"`
	Result struct {
		MessageID int    `json:"message_id"`
		Chat     struct {
			ID int64 `json:"id"`
		} `json:"chat"`
		Text string `json:"text"`
		Date int    `json:"date"`
	} `json:"result"`
}

// SendText sends a text message via Telegram.
func (c *TelegramBotClient) SendText(ctx context.Context, to, message string) (*TelegramSendResponse, error) {
	// If 'to' is provided, use it as chat_id, otherwise use default
	chatID := to
	if chatID == "" {
		chatID = c.ChatID
	}

	url := c.BaseURL + "/sendMessage"
	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    message,
		"parse_mode": "Markdown",
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal telegram message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send telegram message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("telegram API error %d: %s", resp.StatusCode, string(body))
	}

	var result TelegramSendResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// SendTextWithParse sends a message with specific parse mode (Markdown or HTML).
func (c *TelegramBotClient) SendTextWithParse(ctx context.Context, to, message, parseMode string) (*TelegramSendResponse, error) {
	chatID := to
	if chatID == "" {
		chatID = c.ChatID
	}

	url := c.BaseURL + "/sendMessage"
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       message,
		"parse_mode": parseMode,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("telegram error %d: %s", resp.StatusCode, string(body))
	}

	var result TelegramSendResponse
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

// IsTelegramSimulated returns true if Telegram dev mode is active.
func IsTelegramSimulated() bool {
	return os.Getenv("TELEGRAM_BOT_TOKEN") != "" && os.Getenv("DEV_MODE") == "true"
}

// TelegramSenderClient interface for response agent.
type TelegramSenderClient interface {
	SendText(ctx context.Context, to, message string) (*TelegramSendResponse, error)
}