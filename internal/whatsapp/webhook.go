package whatsapp

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
}

// ValidateSignature validates the X-Hub-Signature-256 header.
// Returns true if the signature matches the expected HMAC-SHA256 of the payload.
func ValidateSignature(payload []byte, signature, appSecret string) bool {
	if signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write(payload)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// ExtractMessage extracts the first text message from the webhook payload.
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
				if msg.Type == "text" && msg.Text.Body != "" {
					return &IncomingMessage{
						From:         msg.From,
						ID:           msg.ID,
						Timestamp:    msg.Timestamp,
						Text:         msg.Text.Body,
						PhoneNumberID: change.Value.Metadata.PhoneNumberID,
					}, nil
				}
			}
		}
	}
	return nil, nil
}

// WebhookHandler handles incoming WhatsApp webhooks.
type WebhookHandler struct {
	AppSecret string
}

// NewWebhookHandler creates a new WebhookHandler.
func NewWebhookHandler(appSecret string) *WebhookHandler {
	return &WebhookHandler{AppSecret: appSecret}
}

// ServeHTTP handles the webhook POST request.
func (h *WebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	signature := r.Header.Get("X-Hub-Signature-256")
	if !ValidateSignature(body, signature, h.AppSecret) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	msg, err := ExtractMessage(body)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	_ = msg // msg would be passed to the intake agent in production

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
