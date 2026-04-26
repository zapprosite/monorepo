package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	queueIntake     = "swarm:queue:intake"
	defaultRedisAddr = "localhost:6379"
)

// WhatsAppSimulatedMessage represents the payload pushed by whatsapp-simulator
type WhatsAppSimulatedMessage struct {
	ID        string `json:"id"`
	Phone     string `json:"phone"`
	Text      string `json:"text"`
	Timestamp int64  `json:"timestamp"`
	Source    string `json:"source"`
	Simulated bool   `json:"simulated"`
}

// getRedisAddr returns Redis address from env or default
func getRedisAddr() string {
	if addr := os.Getenv("REDIS_ADDR"); addr != "" {
		return addr
	}
	return defaultRedisAddr
}

// isDevMode returns true if DEV_MODE=true
func isDevMode() bool {
	return os.Getenv("DEV_MODE") == "true"
}

// isSimulateWhatsApp returns true if SIMULATE_WHATSAPP=true
func isSimulateWhatsApp() bool {
	return os.Getenv("SIMULATE_WHATSAPP") == "true"
}

// createRedisClient creates a Redis client for tests
func createRedisClient(t *testing.T) *redis.Client {
	addr := getRedisAddr()
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := rdb.Ping(ctx).Err()
	if err != nil {
		t.Skipf("Redis not available at %s: %v", addr, err)
	}

	return rdb
}

// pushWhatsAppMessage simulates what whatsapp-simulator does
func pushWhatsAppMessage(t *testing.T, rdb *redis.Client, phone, text string) string {
	ctx := context.Background()
	timestamp := time.Now().Unix()
	messageID := fmt.Sprintf("sim_%d_%s", timestamp, strings.TrimPrefix(phone, "+"))

	payload := WhatsAppSimulatedMessage{
		ID:        messageID,
		Phone:     phone,
		Text:      text,
		Timestamp: timestamp,
		Source:    "whatsapp-simulator",
		Simulated: true,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	err = rdb.LPush(ctx, queueIntake, data).Err()
	require.NoError(t, err, "failed to push message to Redis queue")

	return messageID
}

// getQueueLength returns the current length of the intake queue
func getQueueLength(t *testing.T, rdb *redis.Client) int64 {
	ctx := context.Background()
	length, err := rdb.LLen(ctx, queueIntake).Result()
	require.NoError(t, err)
	return length
}

// TestWhatsAppDEV_E2E_SpringerE8 tests Springer error code E8 flow
func TestWhatsAppDEV_E2E_SpringerE8(t *testing.T) {
	if !isSimulateWhatsApp() {
		t.Skip("SIMULATE_WHATSAPP not set to true")
	}

	rdb := createRedisClient(t)
	ctx := context.Background()

	// Record initial queue length
	initialLen := getQueueLength(t, rdb)

	// Push message simulating whatsapp-simulator
	phone := "+5511999999999"
	text := "Springer erro E8"
	messageID := pushWhatsAppMessage(t, rdb, phone, text)

	t.Logf("Pushed message ID: %s", messageID)
	t.Logf("Message: %s | Phone: %s", text, phone)

	// Verify queue length increased
	newLen := getQueueLength(t, rdb)
	assert.Equal(t, initialLen+1, newLen, "queue length should increase by 1")

	// Verify the message is in the queue
	items, err := rdb.LRange(ctx, queueIntake, 0, -1).Result()
	require.NoError(t, err)

	// Find our message
	var found bool
	var msg WhatsAppSimulatedMessage
	for _, item := range items {
		if err := json.Unmarshal([]byte(item), &msg); err == nil {
			if msg.ID == messageID && msg.Text == text {
				found = true
				break
			}
		}
	}
	assert.True(t, found, "message should be found in queue")

	// Verify message fields
	assert.Equal(t, phone, msg.Phone)
	assert.Equal(t, text, msg.Text)
	assert.Equal(t, "whatsapp-simulator", msg.Source)
	assert.True(t, msg.Simulated)

	// DEV_MODE verification
	if isDevMode() {
		t.Log("DEV_MODE enabled - message will be processed by intake_agent -> classifier -> rag_query")
	}
}

// TestWhatsAppDEV_E2E_LGCH10 tests LG error code CH10 flow
func TestWhatsAppDEV_E2E_LGCH10(t *testing.T) {
	if !isSimulateWhatsApp() {
		t.Skip("SIMULATE_WHATSAPP not set to true")
	}

	rdb := createRedisClient(t)
	ctx := context.Background()

	// Record initial queue length
	initialLen := getQueueLength(t, rdb)

	// Push message simulating whatsapp-simulator
	phone := "+5511999999999"
	text := "LG dual inverter CH10"
	messageID := pushWhatsAppMessage(t, rdb, phone, text)

	t.Logf("Pushed message ID: %s", messageID)
	t.Logf("Message: %s | Phone: %s", text, phone)

	// Verify queue length increased
	newLen := getQueueLength(t, rdb)
	assert.Equal(t, initialLen+1, newLen, "queue length should increase by 1")

	// Verify the message is in the queue
	items, err := rdb.LRange(ctx, queueIntake, 0, -1).Result()
	require.NoError(t, err)

	// Find our message
	var found bool
	var msg WhatsAppSimulatedMessage
	for _, item := range items {
		if err := json.Unmarshal([]byte(item), &msg); err == nil {
			if msg.ID == messageID && msg.Text == text {
				found = true
				break
			}
		}
	}
	assert.True(t, found, "message should be found in queue")

	// Verify message fields
	assert.Equal(t, phone, msg.Phone)
	assert.Equal(t, text, msg.Text)

	t.Log("LG dual inverter CH10 - expect Compressor Error response from RAG")
}

// TestWhatsAppDEV_E2E_SamsungE101 tests Samsung error code E101 flow
func TestWhatsAppDEV_E2E_SamsungE101(t *testing.T) {
	if !isSimulateWhatsApp() {
		t.Skip("SIMULATE_WHATSAPP not set to true")
	}

	rdb := createRedisClient(t)
	ctx := context.Background()

	// Record initial queue length
	initialLen := getQueueLength(t, rdb)

	// Push message simulating whatsapp-simulator
	phone := "+5511999999999"
	text := "Samsung Wind-Free E101"
	messageID := pushWhatsAppMessage(t, rdb, phone, text)

	t.Logf("Pushed message ID: %s", messageID)
	t.Logf("Message: %s | Phone: %s", text, phone)

	// Verify queue length increased
	newLen := getQueueLength(t, rdb)
	assert.Equal(t, initialLen+1, newLen, "queue length should increase by 1")

	// Verify the message is in the queue
	items, err := rdb.LRange(ctx, queueIntake, 0, -1).Result()
	require.NoError(t, err)

	// Find our message
	var found bool
	var msg WhatsAppSimulatedMessage
	for _, item := range items {
		if err := json.Unmarshal([]byte(item), &msg); err == nil {
			if msg.ID == messageID && msg.Text == text {
				found = true
				break
			}
		}
	}
	assert.True(t, found, "message should be found in queue")

	// Verify message fields
	assert.Equal(t, phone, msg.Phone)
	assert.Equal(t, text, msg.Text)

	t.Log("Samsung Wind-Free E101 - expect Indoor Fan Motor Error response from RAG")
}

// TestWhatsAppDEV_E2E_InvalidBrand tests invalid brand xyz123 flow
func TestWhatsAppDEV_E2E_InvalidBrand(t *testing.T) {
	if !isSimulateWhatsApp() {
		t.Skip("SIMULATE_WHATSAPP not set to true")
	}

	rdb := createRedisClient(t)
	ctx := context.Background()

	// Record initial queue length
	initialLen := getQueueLength(t, rdb)

	// Push message simulating whatsapp-simulator
	phone := "+5511999999999"
	text := "invalid brand xyz123"
	messageID := pushWhatsAppMessage(t, rdb, phone, text)

	t.Logf("Pushed message ID: %s", messageID)
	t.Logf("Message: %s | Phone: %s", text, phone)

	// Verify queue length increased
	newLen := getQueueLength(t, rdb)
	assert.Equal(t, initialLen+1, newLen, "queue length should increase by 1")

	// Verify the message is in the queue
	items, err := rdb.LRange(ctx, queueIntake, 0, -1).Result()
	require.NoError(t, err)

	// Find our message
	var found bool
	var msg WhatsAppSimulatedMessage
	for _, item := range items {
		if err := json.Unmarshal([]byte(item), &msg); err == nil {
			if msg.ID == messageID && msg.Text == text {
				found = true
				break
			}
		}
	}
	assert.True(t, found, "message should be found in queue")

	// Verify message fields
	assert.Equal(t, phone, msg.Phone)
	assert.Equal(t, text, msg.Text)

	t.Log("invalid brand xyz123 - expect no-confidence response from RAG (low confidence)")
}

// TestWhatsAppDEV_E2E_QueueIntegrity tests that multiple messages maintain order
func TestWhatsAppDEV_E2E_QueueIntegrity(t *testing.T) {
	if !isSimulateWhatsApp() {
		t.Skip("SIMULATE_WHATSAPP not set to true")
	}

	rdb := createRedisClient(t)
	ctx := context.Background()

	// Record initial queue length
	initialLen := getQueueLength(t, rdb)

	// Push multiple messages
	messages := []struct {
		phone string
		text  string
	}{
		{"+5511999999999", "Springer erro E8"},
		{"+5511999999999", "LG dual inverter CH10"},
		{"+5511999999999", "Samsung Wind-Free E101"},
	}

	var messageIDs []string
	for _, m := range messages {
		id := pushWhatsAppMessage(t, rdb, m.phone, m.text)
		messageIDs = append(messageIDs, id)
	}

	// Verify queue length increased by 3
	newLen := getQueueLength(t, rdb)
	assert.Equal(t, initialLen+3, newLen, "queue length should increase by 3")

	// Get all messages (newest first due to LPUSH)
	items, err := rdb.LRange(ctx, queueIntake, 0, -1).Result()
	require.NoError(t, err)
	assert.Len(t, items, int(newLen), "should have correct number of items")

	// Verify we can find all our messages
	foundCount := 0
	for _, item := range items {
		var msg WhatsAppSimulatedMessage
		if err := json.Unmarshal([]byte(item), &msg); err == nil {
			for _, id := range messageIDs {
				if msg.ID == id {
					foundCount++
					break
				}
			}
		}
	}
	assert.Equal(t, 3, foundCount, "all 3 messages should be found in queue")
}

// TestWhatsAppDEV_E2E_QueueProcessing tests the processing flow with simulated swarm
func TestWhatsAppDEV_E2E_QueueProcessing(t *testing.T) {
	if !isSimulateWhatsApp() {
		t.Skip("SIMULATE_WHATSAPP not set to true")
	}

	if !isDevMode() {
		t.Log("DEV_MODE not set - skipping full processing test")
		t.Skip("DEV_MODE=true required for processing test")
	}

	rdb := createRedisClient(t)
	ctx := context.Background()

	// Push a test message
	phone := "+5511999999999"
	text := "Springer erro E8"
	messageID := pushWhatsAppMessage(t, rdb, phone, text)

	t.Logf("DEV_MODE: Full flow test starting")
	t.Logf("Message ID: %s", messageID)
	t.Logf("Expected flow: intake -> classifier -> rag_query -> response")

	// In DEV_MODE with swarm running, the message would be:
	// 1. intake_agent extracts: normalized_text="Springer erro E8"
	// 2. classifier identifies: intent=technical, entities={brand=Springer, error_code=E8}
	// 3. rag_query returns: High Pressure Protection (E8) with high confidence
	// 4. Response logged to terminal

	// For this test, we verify the message is correctly formed for processing
	items, err := rdb.LRange(ctx, queueIntake, 0, -1).Result()
	require.NoError(t, err)

	var found bool
	for _, item := range items {
		var msg WhatsAppSimulatedMessage
		if err := json.Unmarshal([]byte(item), &msg); err == nil {
			if msg.ID == messageID {
				found = true
				// Verify the message structure is correct for the pipeline
				assert.NotEmpty(t, msg.Text)
				assert.NotEmpty(t, msg.Phone)
				assert.NotZero(t, msg.Timestamp)
				assert.Equal(t, "whatsapp-simulator", msg.Source)
				break
			}
		}
	}
	assert.True(t, found, "message should be found for processing")
}

// TestWhatsAppDEV_E2E_RedisConnection tests Redis connectivity
func TestWhatsAppDEV_E2E_RedisConnection(t *testing.T) {
	addr := getRedisAddr()
	t.Logf("Testing Redis connection to: %s", addr)

	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := rdb.Ping(ctx).Err()
	require.NoError(t, err, "Redis should be reachable")

	// Verify queue exists (or can be created)
	err = rdb.LPush(ctx, queueIntake, "health-check").Err()
	require.NoError(t, err, "should be able to push to intake queue")

	// Clean up
	rdb.LRem(ctx, queueIntake, 1, "health-check")

	t.Log("Redis connection and queue access verified")
}

// TestWhatsAppDEV_E2E_EnvironmentVars tests environment variable configuration
func TestWhatsAppDEV_E2E_EnvironmentVars(t *testing.T) {
	redisAddr := getRedisAddr()
	devMode := isDevMode()
	simulateWhatsApp := isSimulateWhatsApp()

	t.Logf("REDIS_ADDR: %s", redisAddr)
	t.Logf("DEV_MODE: %v", devMode)
	t.Logf("SIMULATE_WHATSAPP: %v", simulateWhatsApp)

	// Basic validation
	assert.NotEmpty(t, redisAddr, "REDIS_ADDR should not be empty")
}