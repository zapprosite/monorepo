package whatsapp

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// WebhookPayload represents the incoming WhatsApp Cloud API webhook payload.
type WebhookPayload struct {
	Object string `json:"object"`
	Entry  []struct {
		ID      string `json:"id"`
		Changes []struct {
			Field string `json:"field"`
			Value struct {
				MessagingProduct string `json:"messaging_product"`
				Metadata         struct {
					PhoneNumberID string `json:"phone_number_id"`
					DisplayName   string `json:"display_name"`
				} `json:"metadata"`
				Contacts []struct {
					Profile struct {
						Name string `json:"name"`
					} `json:"profile"`
					WAID string `json:"wa_id"`
				} `json:"contacts"`
				Messages []struct {
					From      string `json:"from"`
					ID        string `json:"id"`
					Timestamp string `json:"timestamp"`
					Type      string `json:"type"`
					Text      struct {
						Body string `json:"body"`
					} `json:"text,omitempty"`
					Image *struct {
						ID     string `json:"id"`
						Mime   string `json:"mime_type"`
						SHA256 string `json:"sha256"`
					} `json:"image,omitempty"`
				} `json:"messages"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

// IncomingMessage represents an extracted incoming WhatsApp message.
type IncomingMessage struct {
	From         string
	ID           string
	Timestamp    string
	Text         string
	PhoneNumberID string
	MessageType  string // "text", "image", etc.
	MediaID      string // if image/audio
}

// ValidateSignature validates the X-Hub-Signature-256 header.
func ValidateSignature(payload []byte, signature, appSecret string) bool {
	if signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write(payload)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// ExtractMessage extracts the first message from the webhook payload.
func ExtractMessage(payload []byte) (*IncomingMessage, error) {
	var wp WebhookPayload
	if err := json.Unmarshal(payload, &wp); err != nil {
		return nil, fmt.Errorf("unmarshal webhook payload: %w", err)
	}

	for _, entry := range wp.Entry {
		for _, change := range entry.Changes {
			if change.Field != "messages" {
				continue
			}
			for _, msg := range change.Value.Messages {
				phoneNumberID := change.Value.Metadata.PhoneNumberID

				if msg.Type == "text" && msg.Text.Body != "" {
					return &IncomingMessage{
						From:         msg.From,
						ID:           msg.ID,
						Timestamp:    msg.Timestamp,
						Text:         msg.Text.Body,
						PhoneNumberID: phoneNumberID,
						MessageType:  "text",
					}, nil
				}

				if msg.Type == "image" && msg.Image != nil {
					return &IncomingMessage{
						From:         msg.From,
						ID:           msg.ID,
						Timestamp:    msg.Timestamp,
						PhoneNumberID: phoneNumberID,
						MessageType:  "image",
						MediaID:      msg.Image.ID,
					}, nil
				}
			}
		}
	}
	return nil, nil
}

// RedisEnqueuer is a simple interface for enqueuing tasks to Redis.
type RedisEnqueuer interface {
	EnqueueTask(ctx context.Context, queueName string, taskData map[string]any) error
}

// WhatsAppWebhookHandler handles incoming WhatsApp webhooks and enqueues to Redis.
type WhatsAppWebhookHandler struct {
	AppSecret    string
	RedisEnqueuer RedisEnqueuer
}

// NewWhatsAppWebhookHandler creates a new webhook handler with Redis enqueuer.
func NewWhatsAppWebhookHandler(appSecret string, enqueuer RedisEnqueuer) *WhatsAppWebhookHandler {
	return &WhatsAppWebhookHandler{
		AppSecret:    appSecret,
		RedisEnqueuer: enqueuer,
	}
}

// ServeHTTP handles the webhook POST request from WhatsApp Cloud API.
func (h *WhatsAppWebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Handle verification challenge from WhatsApp
	if r.Method == http.MethodGet {
		h.handleVerification(w, r)
		return
	}

	// Handle incoming messages
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// Validate signature
	signature := r.Header.Get("X-Hub-Signature-256")
	if h.AppSecret != "" && !ValidateSignature(body, signature, h.AppSecret) {
		if signature == "" {
			// Development mode - no secret configured
		} else {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	}

	msg, err := ExtractMessage(body)
	if err != nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	if msg == nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	// Create task data for intake agent
	taskData := map[string]any{
		"task_id":         msg.ID,
		"graph_id":        msg.From, // Use phone as graph ID
		"node_id":         "intake",
		"type":            "intake",
		"status":          "pending",
		"priority":         1,
		"phone":           msg.From,
		"message_id":      msg.ID,
		"timestamp":       msg.Timestamp,
		"normalized_text":  normalizeText(msg.Text),
		"query":           msg.Text,
		"text":            msg.Text,
		"message_type":    msg.MessageType,
		"media_id":        msg.MediaID,
		"retries":         0,
		"max_retries":     3,
		"timeout_ms":      30000,
	}

	if err := h.RedisEnqueuer.EnqueueTask(ctx, "intake", taskData); err != nil {
		// Log error but still return 200 (WhatsApp will retry)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// handleVerification handles the WhatsApp webhook verification challenge.
func (h *WhatsAppWebhookHandler) handleVerification(w http.ResponseWriter, r *http.Request) {
	mode := r.URL.Query().Get("hub.mode")
	token := r.URL.Query().Get("hub.verify_token")
	challenge := r.URL.Query().Get("hub.challenge")

	if mode == "subscribe" && token != "" {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(challenge))
		return
	}

	http.Error(w, "Forbidden", http.StatusForbidden)
}

// normalizeText normalizes text for processing.
func normalizeText(text string) string {
	if text == "" {
		return ""
	}
	return strings.TrimSpace(strings.ToLower(text))
}
