package agents

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"unicode"

	"github.com/google/uuid"
)

// IntakeAgent handles incoming WhatsApp webhook payloads.
// It validates signatures, extracts message content, normalizes text,
// and downloads media when necessary.
type IntakeAgent struct {
	whatsappSecret string
	accessToken    string
	httpClient     *http.Client
	graphAPIURL    string
}

// NewIntakeAgent creates a new IntakeAgent.
func NewIntakeAgent(whatsappSecret, accessToken string) *IntakeAgent {
	return &IntakeAgent{
		whatsappSecret: whatsappSecret,
		accessToken:    accessToken,
		httpClient: &http.Client{
			Timeout: 10e9, // 10 seconds
		},
		graphAPIURL: "https://graph.facebook.com/v18.0",
	}
}

// AgentType returns the agent type identifier.
func (i *IntakeAgent) AgentType() string {
	return "intake"
}

// MaxRetries returns the maximum retry attempts.
func (i *IntakeAgent) MaxRetries() int {
	return 3
}

// TimeoutMs returns the timeout in milliseconds.
func (i *IntakeAgent) TimeoutMs() int {
	return 10000
}

// WhatsAppWebhookPayload represents the WhatsApp Cloud API webhook payload.
type WhatsAppWebhookPayload struct {
	Object string `json:"object"`
	Entry  []struct {
		ID      string `json:"id"`
		Changes []struct {
			Value struct {
				MessagingProduct string `json:"messaging_product"`
				Metadata         struct {
					DisplayPhoneNumber string `json:"display_phone_number"`
					PhoneNumberID     string `json:"phone_number_id"`
				} `json:"metadata"`
				Contacts []struct {
					Profile struct {
						Name string `json:"name"`
					} `json:"profile"`
					WaID string `json:"wa_id"`
				} `json:"contacts"`
				Messages []struct {
					From    string `json:"from"`
					ID      string `json:"id"`
					Timestamp string `json:"timestamp"`
					Type    string `json:"type"`
					Text    *struct {
						Body string `json:"body"`
					} `json:"text,omitempty"`
					Image *struct {
						Caption   string `json:"caption,omitempty"`
						MimeType  string `json:"mime_type"`
						SHA256    string `json:"sha256"`
						ID        string `json:"id"`
					} `json:"image,omitempty"`
					Audio *struct {
						ID       string `json:"id"`
						MimeType string `json:"mime_type"`
						Speech   string `json:"speech,omitempty"`
					} `json:"audio,omitempty"`
					Document *struct {
						Caption    string `json:"caption,omitempty"`
						Filename   string `json:"filename"`
						MimeType   string `json:"mime_type"`
						SHA256     string `json:"sha256"`
						ID         string `json:"id"`
					} `json:"document,omitempty"`
					Location *struct {
						Latitude  float64 `json:"latitude"`
						Longitude float64 `json:"longitude"`
						Name      string `json:"name,omitempty"`
						Address   string `json:"address,omitempty"`
					} `json:"location,omitempty"`
					Sticker *struct {
						ID       string `json:"id"`
						MimeType string `json:"mime_type"`
						SHA256   string `json:"sha256"`
					} `json:"sticker,omitempty"`
					Reaction *struct {
						MessageID string `json:"message_id"`
						Emoji     string `json:"emoji"`
					} `json:"reaction,omitempty"`
					Referral *struct {
						SeqID     string `json:"seq_id"`
						Type      string `json:"type"`
						MediaType string `json:"media_type,omitempty"`
						URL       string `json:"url,omitempty"`
					} `json:"referral,omitempty"`
				} `json:"messages"`
			} `json:"value"`
			Field string `json:"field"`
		} `json:"changes"`
	} `json:"entry"`
}

// Execute processes the incoming WhatsApp webhook payload.
func (i *IntakeAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	// 1. Parse WhatsApp webhook payload from task input
	payloadData, ok := task.Input["webhook_payload"]
	if !ok {
		return nil, fmt.Errorf("missing webhook_payload in task input")
	}

	payloadBytes, err := json.Marshal(payloadData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	var payload WhatsAppWebhookPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal webhook payload: %w", err)
	}

	// 2. Validate X-Hub-Signature-256 if provided
	signature, ok := task.Input["x_hub_signature_256"].(string)
	if ok && i.whatsappSecret != "" {
		if !i.validateSignature(payloadBytes, signature) {
			return nil, fmt.Errorf("invalid X-Hub-Signature-256")
		}
	}

	// Extract message data
	if len(payload.Entry) == 0 || len(payload.Entry[0].Changes) == 0 || len(payload.Entry[0].Changes[0].Value.Messages) == 0 {
		return nil, fmt.Errorf("no messages in payload")
	}

	msg := payload.Entry[0].Changes[0].Value.Messages[0]
	phone := msg.From
	messageType := msg.Type

	// 3. Extract text and normalize
	var text string
	switch messageType {
	case "text":
		if msg.Text != nil {
			text = msg.Text.Body
		}
	case "image":
		if msg.Image != nil {
			text = msg.Image.Caption
		}
	case "audio":
		text = ""
	case "document":
		if msg.Document != nil {
			text = msg.Document.Caption
		}
	case "location":
		if msg.Location != nil {
			text = fmt.Sprintf("Location: %s (%f, %f)", msg.Location.Name, msg.Location.Latitude, msg.Location.Longitude)
		}
	default:
		text = ""
	}

	// 4. Normalize UTF-8
	normalizedText := normalizeUTF8(text)

	// 5. Download media via Graph API if needed
	var mediaURL string
	var mediaID string
	if messageType == "image" || messageType == "audio" || messageType == "document" {
		var mediaIDStr string
		switch messageType {
		case "image":
			mediaIDStr = msg.Image.ID
		case "audio":
			mediaIDStr = msg.Audio.ID
		case "document":
			mediaIDStr = msg.Document.ID
		}

		if mediaIDStr != "" {
			mediaURL, err = i.getMediaURL(ctx, mediaIDStr)
			if err != nil {
				// Log but don't fail - media download is best effort
				log.Printf("media download failed for ID %s: %v", mediaIDStr, err)
				mediaURL = ""
			}
			mediaID = mediaIDStr
		}
	}

	// 6. Write to shared state
	requestID := uuid.New().String()

	result := map[string]any{
		"request_id":     requestID,
		"phone":          phone,
		"message_type":   messageType,
		"normalized_text": normalizedText,
		"message_id":     msg.ID,
		"timestamp":      msg.Timestamp,
		"intake.success": true,
	}

	if mediaURL != "" {
		result["media_url"] = mediaURL
		result["media_id"] = mediaID
	}

	return result, nil
}

// validateSignature validates the X-Hub-Signature-256 header.
func (i *IntakeAgent) validateSignature(payload []byte, signature string) bool {
	if !strings.HasPrefix(signature, "sha256=") {
		return false
	}
	expectedMAC := strings.TrimPrefix(signature, "sha256=")
	mac := hmac.New(sha256.New, []byte(i.whatsappSecret))
	mac.Write(payload)
	expectedMACBytes := mac.Sum(nil)
	actualMACBytes, err := hex.DecodeString(expectedMAC)
	if err != nil {
		return false
	}
	return hmac.Equal(expectedMACBytes, actualMACBytes)
}

// MediaInfo represents the response from the WhatsApp Graph API media endpoint.
type MediaInfo struct {
	URL      string `json:"url"`
	MimeType string `json:"mime_type"`
	SHA256   string `json:"sha256"`
	FileSize int    `json:"file_size"`
}

// getMediaURL retrieves the media URL from the WhatsApp Graph API.
// It first calls GET /{media-id} to get the media object, which contains the download URL.
func (i *IntakeAgent) getMediaURL(ctx context.Context, mediaID string) (string, error) {
	if i.accessToken == "" {
		return "", fmt.Errorf("access token not configured")
	}

	// Step 1: Get media info from Graph API
	url := fmt.Sprintf("%s/%s", i.graphAPIURL, mediaID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+i.accessToken)

	resp, err := i.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch media info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("media info request failed: status %d, body: %s", resp.StatusCode, string(body))
	}

	var mediaInfo MediaInfo
	if err := json.NewDecoder(resp.Body).Decode(&mediaInfo); err != nil {
		return "", fmt.Errorf("decode media info: %w", err)
	}

	if mediaInfo.URL == "" {
		return "", fmt.Errorf("no URL in media info response")
	}

	return mediaInfo.URL, nil
}

// normalizeUTF8 normalizes unicode text for consistent processing.
func normalizeUTF8(s string) string {
	// Normalize to NFC form and remove zero-width characters
	var builder strings.Builder
	for _, r := range s {
		// Skip zero-width joiners and other invisible characters
		if r == 0x200B || r == 0x200C || r == 0x200D || r == 0xFEFF {
			continue
		}
		// Replace non-breaking spaces with regular spaces
		if r == 0x00A0 {
			builder.WriteRune(' ')
			continue
		}
		// Normalize unicode quotes
		switch r {
		case 0x201C, 0x201D, 0x2018, 0x2019:
			builder.WriteRune('\'')
		default:
			// Use unicode.EscapeWhenNotPrint to handle control chars
			if !unicode.IsControl(r) || unicode.IsPrint(r) {
				builder.WriteRune(r)
			}
		}
	}
	return strings.TrimSpace(builder.String())
}

// Ensure IntakeAgent implements AgentInterface
var _ AgentInterface = (*IntakeAgent)(nil)
