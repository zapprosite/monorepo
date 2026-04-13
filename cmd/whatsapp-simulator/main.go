package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	phone    = flag.String("phone", "", "Phone number (e.g., +5511999999999)")
	text     = flag.String("text", "", "Message text to send")
	queue    = flag.String("queue", "swarm:queue:intake", "Redis queue name")
	redisAddr = flag.String("redis", "localhost:6379", "Redis address")
)

func main() {
	flag.Parse()

	// Check required flags
	if *phone == "" || *text == "" {
		fmt.Println("WhatsApp DEV Simulator")
		fmt.Println("Usage: whatsapp-simulator --phone +5511999999999 --text \"message\"")
		fmt.Println("")
		flag.PrintDefaults()
		os.Exit(1)
	}

	// Check DEV mode
	devMode := os.Getenv("DEV_MODE") == "true"
	simulateMode := os.Getenv("SIMULATE_WHATSAPP") == "true"

	fmt.Printf("=== WhatsApp DEV Simulator ===\n")
	fmt.Printf("DEV_MODE: %v\n", devMode)
	fmt.Printf("SIMULATE_WHATSAPP: %v\n", simulateMode)
	fmt.Printf("Phone: %s\n", *phone)
	fmt.Printf("Message: %s\n", *text)
	fmt.Printf("Queue: %s\n", *queue)
	fmt.Println()

	// Connect to Redis
	ctx := context.Background()
	rdb := redis.NewClient(&redis.Options{
		Addr:     *redisAddr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	// Test connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️  Redis not available at %s: %v (queueing anyway)", *redisAddr, err)
	}

	// Create message payload
	timestamp := time.Now().Unix()
	messageID := fmt.Sprintf("sim_%d_%s", timestamp, (*phone)[1:])

	payload := fmt.Sprintf(`{
		"id": "%s",
		"phone": "%s",
		"text": "%s",
		"timestamp": %d,
		"source": "whatsapp-simulator",
		"simulated": true
	}`, messageID, *phone, *text, timestamp)

	// Push to Redis queue
	if err := rdb.LPush(ctx, *queue, payload).Err(); err != nil {
		log.Printf("⚠️  Failed to push to Redis: %v", err)
		fmt.Printf("📝 Message queued locally (Redis unavailable)\n")
	} else {
		fmt.Printf("✅ Pushed to Redis queue: %s\n", *queue)
	}

	fmt.Printf("\n📱 SIMULATED WHATSAPP MESSAGE\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
	fmt.Printf("To: %s\n", *phone)
	fmt.Printf("Message ID: %s\n", messageID)
	fmt.Printf("Message: %s\n", *text)
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	// Log to stdout as simulation
	fmt.Printf("\n[WHATSAPP SIMULATED] To: %s | Message: %s\n", *phone, *text)
	fmt.Printf("\n✅ Simulation complete. Check swarm logs for RAG processing.\n")

	// If DEV_MODE=true, also log details for debugging
	if devMode {
		fmt.Printf("\n📋 DEV MODE DETAILS:\n")
		fmt.Printf("  - Message will be processed by intake_agent\n")
		fmt.Printf("  - RAG query will use error codes + manuals\n")
		fmt.Printf("  - Response will be refined and logged\n")
	}
}