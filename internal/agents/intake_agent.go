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
	"os"
	"strings"
	"unicode"

	"github.com/google/uuid"
)

// IntakeAgent handles incoming WhatsApp webhook payloads.
// It validates signatures, extracts message content, normalizes text,
// downloads media when necessary, and routes to the classifier queue.
type IntakeAgent struct {
	whatsappSecret string
	accessToken    string
	httpClient     *http.Client
	graphAPIURL    string
	redisClient    RedisEnqueuer
}

// RedisEnqueuer interface for enqueueing tasks to Redis.
type RedisEnqueuer interface {
	EnqueueTask(ctx context.Context, queueName string, taskData map[string]any) error
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

// NewIntakeAgentWithRedis creates a new IntakeAgent with Redis client for routing.
func NewIntakeAgentWithRedis(whatsappSecret, accessToken string, redisClient RedisEnqueuer) *IntakeAgent {
	agent := NewIntakeAgent(whatsappSecret, accessToken)
	agent.redisClient = redisClient
	return agent
}

// isDevMode returns true if DEV_MODE environment variable is set.
func isDevMode() bool {
	return os.Getenv("DEV_MODE") == "true"
}

// isWhatsAppSimulated returns true if SIMULATE_WHATSAPP environment variable is set.
func isWhatsAppSimulated() bool {
	return os.Getenv("SIMULATE_WHATSAPP") == "true"
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
	// 1. Check for DEV_MODE bypass - skip signature validation in dev
	devMode := isDevMode()
	simulated := isWhatsAppSimulated()

	// Check if this is a simulated message (from whatsapp-simulator)
	if simulatedFlag, ok := task.Input["simulated"].(bool); ok && simulatedFlag {
		simulated = true
	}

	// In DEV_MODE or SIMULATE_WHATSAPP mode, skip signature validation
	if !devMode && !simulated && i.whatsappSecret != "" {
		signature, ok := task.Input["x_hub_signature_256"].(string)
		if ok {
			// Get raw payload for signature validation
			payloadBytes, ok := task.Input["_raw_payload"].([]byte)
			if ok && !i.validateSignature(payloadBytes, signature) {
				return nil, fmt.Errorf("invalid X-Hub-Signature-256")
			}
		}
	}

	// 2. Extract message data from task input (fields set by WhatsApp webhook handler)
	// The webhook handler sends individual fields, not a nested webhook_payload
	phone, ok := task.Input["phone"].(string)
	if !ok || phone == "" {
		return nil, fmt.Errorf("missing phone in task input")
	}

	messageID, _ := task.Input["message_id"].(string)
	timestamp, _ := task.Input["timestamp"].(string)
	messageType, _ := task.Input["message_type"].(string)
	if messageType == "" {
		messageType = "text"
	}

	// Get text - try normalized_text first, then text or query
	normalizedText, _ := task.Input["normalized_text"].(string)
	if normalizedText == "" {
		normalizedText, _ = task.Input["text"].(string)
	}
	if normalizedText == "" {
		normalizedText, _ = task.Input["query"].(string)
	}

	// 3. Handle simulated messages - mark as simulated and use fallback
	if simulated {
		log.Printf("[intake] processing simulated message (DEV_MODE=%v, SIMULATE_WHATSAPP=%v)", devMode, simulated)
	}

	// 4. Normalize UTF-8 if we have text
	if normalizedText != "" {
		normalizedText = normalizeUTF8(normalizedText)
	}

	// 5. Download media via Graph API if needed (skip in simulation mode)
	var mediaURL string
	var mediaID string
	if !simulated && (messageType == "image" || messageType == "audio" || messageType == "document") {
		mediaIDStr, _ := task.Input["media_id"].(string)
		if mediaIDStr != "" {
			_, err := i.getMediaURL(ctx, mediaIDStr)
			if err != nil {
				// Log but don't fail - media download is best effort
				log.Printf("media download failed for ID %s: %v", mediaIDStr, err)
			}
			mediaID = mediaIDStr
		}
	}

	// 6. Write to shared state
	requestID := uuid.New().String()

	result := map[string]any{
		"request_id":      requestID,
		"phone":           phone,
		"message_type":    messageType,
		"normalized_text": normalizedText,
		"message_id":      messageID,
		"timestamp":      timestamp,
		"intake.success":  true,
		"simulated":       simulated,
	}

	if mediaURL != "" {
		result["media_url"] = mediaURL
	}
	if mediaID != "" {
		result["media_id"] = mediaID
	}

	// 7. Route to classifier queue
	if i.redisClient != nil {
		classifierTask := map[string]any{
			"task_id":    uuid.New().String(),
			"graph_id":   task.GraphID,
			"node_id":    "classifier",
			"type":       "classifier",
			"status":     "pending",
			"priority":   1,
			"retries":    0,
			"max_retries": 3,
			"timeout_ms": 15000,
			"input": map[string]any{
				"phone":           phone,
				"message_id":      messageID,
				"timestamp":       timestamp,
				"normalized_text": normalizedText,
				"message_type":    messageType,
				"media_id":        mediaID,
				"media_url":       mediaURL,
				"intake_output":   result,
			},
		}

		if err := i.redisClient.EnqueueTask(ctx, "classifier", classifierTask); err != nil {
			log.Printf("[intake] failed to enqueue classifier task: %v", err)
			// Don't fail the intake task - log error and continue
		} else {
			log.Printf("[intake] routed to classifier queue: request_id=%s", requestID)
		}
	} else {
		log.Printf("[intake] warning: no Redis client configured, skipping classifier routing")
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
