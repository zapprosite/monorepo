package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Flags and environment configuration
var (
	phone       = flag.String("phone", "", "Phone number to send to (CLI mode)")
	text        = flag.String("text", "", "Message text to send (CLI mode)")
	queueName   = flag.String("queue", "swarm:queue:intake", "Redis queue name")
	redisAddr   = flag.String("redis", "localhost:6379", "Redis address")
	port        = flag.String("port", "9378", "HTTP server port for API mode")
	webhookPath = flag.String("webhook-path", "/webhook", "Webhook endpoint path")
	verifyToken = flag.String("verify-token", "dev-verification-token", "Webhook verification token")
)

// Message represents a WhatsApp message
type Message struct {
	ID        string `json:"id"`
	From      string `json:"from"`
	To        string `json:"to"`
	Text      string `json:"text"`
	Timestamp int64  `json:"timestamp"`
	Type      string `json:"type"`
	Source    string `json:"source"`
	Simulated bool   `json:"simulated"`
}

// SendMessageRequest represents the WhatsApp Cloud API send message request
type SendMessageRequest struct {
	MessagingProduct string `json:"messaging_product"`
	RecipientType    string `json:"recipient_type"`
	To               string `json:"to"`
	Type             string `json:"type"`
	Text             struct {
		PreviewURL bool   `json:"preview_url"`
		Body       string `json:"body"`
	} `json:"text"`
}

// SendMessageResponse represents the WhatsApp Cloud API response
type SendMessageResponse struct {
	MessagingID string `json:"messaging_product"`
	Contacts    []struct {
		WAID string `json:"wa_id"`
	} `json:"contacts"`
	Messages []struct {
		ID string `json:"id"`
	} `json:"messages"`
}

// WebhookVerification represents GET /webhook verification
type WebhookVerification struct {
	Mode      string `json:"hub.mode"`
	Token     string `json:"hub.verify_token"`
	Challenge string `json:"hub.challenge"`
}

// Simulator stores message state in memory
type Simulator struct {
	mu        sync.RWMutex
	messages  []Message
	redis     *redis.Client
	queueName string
}

// NewSimulator creates a new WhatsApp simulator
func NewSimulator(redisAddr, queueName string) *Simulator {
	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	return &Simulator{
		redis:     rdb,
		queueName: queueName,
		messages:  make([]Message, 0),
	}
}

// HealthCheck handles GET /health
func (s *Simulator) HealthCheck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check Redis connectivity
	redisStatus := "connected"
	if err := s.redis.Ping(ctx).Err(); err != nil {
		redisStatus = fmt.Sprintf("disconnected: %v", err)
	}

	status := map[string]interface{}{
		"status":       "ok",
		"simulator":    "whatsapp-dev",
		"redis":        redisStatus,
		"queue":        s.queueName,
		"messages_sent": s.MessageCount(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// WebhookVerification handles GET /webhook for WhatsApp Cloud API verification
func (s *Simulator) WebhookVerification(w http.ResponseWriter, r *http.Request) {
	mode := r.URL.Query().Get("hub.mode")
	token := r.URL.Query().Get("hub.verify_token")
	challenge := r.URL.Query().Get("hub.challenge")

	if mode == "subscribe" && token == *verifyToken {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(challenge))
		log.Printf("[WEBHOOK] Verification successful")
		return
	}

	log.Printf("[WEBHOOK] Verification failed: mode=%s, token=%s", mode, token)
	http.Error(w, "Forbidden", http.StatusForbidden)
}

// WebhookMessage handles POST /webhook for incoming messages from WhatsApp
func (s *Simulator) WebhookMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		log.Printf("[WEBHOOK] Failed to decode payload: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	// Extract messages from WhatsApp Cloud API payload structure
	entry, ok := payload["entry"].([]interface{})
	if !ok {
		log.Printf("[WEBHOOK] Invalid payload structure")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	for _, e := range entry {
		entryMap, ok := e.(map[string]interface{})
		if !ok {
			continue
		}

		changes, ok := entryMap["changes"].([]interface{})
		if !ok {
			continue
		}

		for _, c := range changes {
			change, ok := c.(map[string]interface{})
			if !ok {
				continue
			}

			value, ok := change["value"].(map[string]interface{})
			if !ok {
				continue
			}

			messages, ok := value["messages"].([]interface{})
			if !ok {
				continue
			}

			for _, m := range messages {
				msg, ok := m.(map[string]interface{})
				if !ok {
					continue
				}

				from, _ := msg["from"].(string)
				id, _ := msg["id"].(string)
				_, _ = msg["timestamp"] // timestamp from WhatsApp (unused)
				msgType, _ := msg["type"].(string)

				var text string
				if textObj, ok := msg["text"].(map[string]interface{}); ok {
					text, _ = textObj["body"].(string)
				}

				// Create and store incoming message
				message := Message{
					ID:        id,
					From:      from,
					Timestamp: time.Now().Unix(),
					Type:      msgType,
					Text:      text,
					Source:    "whatsapp-webhook",
					Simulated: true,
				}

				s.AddMessage(message)
				log.Printf("[WEBHOOK] Incoming message: from=%s, type=%s, text=%s", from, msgType, text)

				// Push to Redis queue for swarm processing
				s.enqueueToRedis(ctx, message)
			}
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// SendMessage handles POST /v1/{phone}/messages - Mock WhatsApp Cloud API
func (s *Simulator) SendMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract phone number from path
	path := r.URL.Path
	var toPhone string
	if _, err := fmt.Sscanf(path, "/v1/%s/messages", &toPhone); err != nil {
		// Try alternative parsing
		toPhone = r.URL.Query().Get("to")
		if toPhone == "" {
			toPhone = "unknown"
		}
	}

	var req SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[API] Failed to decode send request: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	// Use To field from request body as priority
	if req.To != "" {
		toPhone = req.To
	}

	// Generate message ID
	messageID := fmt.Sprintf("sim_%d_%s", time.Now().Unix(), toPhone[1:])
	timestamp := time.Now().Unix()

	// Extract message text
	messageText := req.Text.Body
	if messageText == "" {
		messageText = req.Text.Body
	}

	// Create message record
	message := Message{
		ID:        messageID,
		From:      "simulator",
		To:        toPhone,
		Text:      messageText,
		Timestamp: timestamp,
		Type:      "text",
		Source:    "whatsapp-simulator-api",
		Simulated: true,
	}

	s.AddMessage(message)
	log.Printf("[API] Sent message: to=%s, id=%s, text=%s", toPhone, messageID, messageText)

	// Push to Redis queue
	s.enqueueToRedis(ctx, message)

	// Return WhatsApp Cloud API compatible response
	response := SendMessageResponse{
		MessagingID: messageID,
		Contacts: []struct {
			WAID string `json:"wa_id"`
		}{
			{WAID: toPhone},
		},
		Messages: []struct {
			ID string `json:"id"`
		}{
			{ID: messageID},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// SimulateIncoming handles POST /api/simulate/incoming - Simulate an incoming message
func (s *Simulator) SimulateIncoming(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	var req struct {
		From string `json:"from"`
		Text string `json:"text"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	if req.From == "" || req.Text == "" {
		http.Error(w, "from and text are required", http.StatusBadRequest)
		return
	}

	messageID := fmt.Sprintf("sim_%d_%s", time.Now().Unix(), req.From[1:])
	timestamp := time.Now().Unix()

	message := Message{
		ID:        messageID,
		From:      req.From,
		Text:      req.Text,
		Timestamp: timestamp,
		Type:      "text",
		Source:    "whatsapp-simulator",
		Simulated: true,
	}

	s.AddMessage(message)
	log.Printf("[SIMULATE] Incoming: from=%s, text=%s", req.From, req.Text)

	// Push to Redis queue
	s.enqueueToRedis(ctx, message)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "queued",
		"message": message,
	})
}

// ListMessages handles GET /api/messages - List all messages
func (s *Simulator) ListMessages(w http.ResponseWriter, r *http.Request) {
	messages := s.GetMessages()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":    len(messages),
		"messages": messages,
	})
}

// GetMessageCount handles GET /api/messages/count - Get message count
func (s *Simulator) GetMessageCount(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count": s.MessageCount(),
	})
}

// ClearMessages handles DELETE /api/messages - Clear all messages
func (s *Simulator) ClearMessages(w http.ResponseWriter, r *http.Request) {
	s.Clear()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
}

// QueueInfo handles GET /api/queue - Get Redis queue info
func (s *Simulator) QueueInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	length, err := s.redis.LLen(ctx, s.queueName).Result()
	if err != nil {
		log.Printf("[QUEUE] Failed to get queue length: %v", err)
		http.Error(w, "Redis unavailable", http.StatusServiceUnavailable)
		return
	}

	// Get sample messages from queue
	var samples []Message
	items, err := s.redis.LRange(ctx, s.queueName, 0, 9).Result()
	if err == nil {
		for _, item := range items {
			var msg Message
			if err := json.Unmarshal([]byte(item), &msg); err == nil {
				samples = append(samples, msg)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"queue":      s.queueName,
		"length":     length,
		"sample_messages": samples,
	})
}

// enqueueToRedis pushes a message to the Redis intake queue
func (s *Simulator) enqueueToRedis(ctx context.Context, msg Message) {
	// Create the payload matching the integration test structure
	payload := map[string]interface{}{
		"id":         msg.ID,
		"phone":      msg.From,
		"text":       msg.Text,
		"timestamp":  msg.Timestamp,
		"source":     "whatsapp-simulator",
		"simulated":  true,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[REDIS] Failed to marshal payload: %v", err)
		return
	}

	if err := s.redis.LPush(ctx, s.queueName, data).Err(); err != nil {
		log.Printf("[REDIS] Failed to push to queue: %v", err)
	} else {
		log.Printf("[REDIS] Queued: id=%s, phone=%s", msg.ID, msg.From)
	}
}

// Message operations
func (s *Simulator) AddMessage(msg Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.messages = append(s.messages, msg)
}

func (s *Simulator) GetMessages() []Message {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Message, len(s.messages))
	copy(result, s.messages)
	return result
}

func (s *Simulator) MessageCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.messages)
}

func (s *Simulator) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.messages = make([]Message, 0)
}

// CLI mode - send a single message and exit
func runCLI() bool {
	flag.Parse()

	if *phone == "" || *text == "" {
		return false
	}

	fmt.Printf("=== WhatsApp DEV Simulator (CLI Mode) ===\n")
	fmt.Printf("Phone: %s\n", *phone)
	fmt.Printf("Message: %s\n", *text)
	fmt.Printf("Queue: %s\n", *queueName)
	fmt.Printf("Redis: %s\n", *redisAddr)
	fmt.Println()

	ctx := context.Background()
	rdb := redis.NewClient(&redis.Options{
		Addr:     *redisAddr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	// Test Redis connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("Redis not available at %s: %v", *redisAddr, err)
	}

	// Create message payload
	timestamp := time.Now().Unix()
	messageID := fmt.Sprintf("sim_%d_%s", timestamp, (*phone)[1:])

	payload := map[string]interface{}{
		"id":        messageID,
		"phone":     *phone,
		"text":      *text,
		"timestamp": timestamp,
		"source":    "whatsapp-simulator",
		"simulated": true,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Fatalf("Failed to marshal payload: %v", err)
	}

	// Push to Redis queue
	if err := rdb.LPush(ctx, *queueName, data).Err(); err != nil {
		log.Printf("Failed to push to Redis: %v", err)
		fmt.Println("Message created locally (Redis unavailable)")
	} else {
		fmt.Println("Message queued to Redis")
	}

	fmt.Printf("\nWhatsApp Simulated Message\n")
	fmt.Printf("To: %s\n", *phone)
	fmt.Printf("Message ID: %s\n", messageID)
	fmt.Printf("Message: %s\n", *text)

	return true
}

// Server mode - run HTTP API
func runServer() {
	flag.Parse()

	simulator := NewSimulator(*redisAddr, *queueName)

	// Setup HTTP handlers
	mux := http.NewServeMux()

	// Health and status
	mux.HandleFunc("/health", simulator.HealthCheck)

	// WhatsApp Cloud API mock endpoints
	mux.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			simulator.WebhookVerification(w, r)
		} else if r.Method == http.MethodPost {
			simulator.WebhookMessage(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Mock WhatsApp Cloud API send endpoint
	mux.HandleFunc("/v1/", simulator.SendMessage)

	// Development API endpoints
	mux.HandleFunc("/api/messages", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			simulator.ListMessages(w, r)
		case http.MethodDelete:
			simulator.ClearMessages(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/messages/count", simulator.GetMessageCount)
	mux.HandleFunc("/api/simulate/incoming", simulator.SimulateIncoming)
	mux.HandleFunc("/api/queue", simulator.QueueInfo)

	addr := fmt.Sprintf(":%s", *port)

	fmt.Printf("=== WhatsApp DEV Simulator (Server Mode) ===\n")
	fmt.Printf("Port: %s\n", *port)
	fmt.Printf("Redis: %s\n", *redisAddr)
	fmt.Printf("Queue: %s\n", *queueName)
	fmt.Printf("Webhook path: %s\n", *webhookPath)
	fmt.Println()
	fmt.Printf("Endpoints:\n")
	fmt.Printf("  GET  /health                    - Health check\n")
	fmt.Printf("  GET  /webhook                   - WhatsApp webhook verification\n")
	fmt.Printf("  POST /webhook                   - WhatsApp webhook (incoming messages)\n")
	fmt.Printf("  POST /v1/{phone}/messages       - Mock WhatsApp Cloud API send\n")
	fmt.Printf("  GET  /api/messages              - List all messages\n")
	fmt.Printf("  DELETE /api/messages            - Clear all messages\n")
	fmt.Printf("  GET  /api/messages/count        - Get message count\n")
	fmt.Printf("  POST /api/simulate/incoming     - Simulate incoming message\n")
	fmt.Printf("  GET  /api/queue                - Queue info\n")
	fmt.Println()

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	log.Printf("WhatsApp Simulator listening on %s", addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

func main() {
	// Check if running in CLI mode (phone and text flags provided)
	flag.Parse()

	// If phone and text are provided, run in CLI mode
	if *phone != "" && *text != "" {
		if runCLI() {
			return
		}
	}

	// Otherwise run in server mode
	runServer()
}
