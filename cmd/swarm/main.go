// main.go - Swarm bootstrap: config, Redis, workers, controllers, HTTP server.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/will-zappro/hvacr-swarm/internal/agents"
	"github.com/will-zappro/hvacr-swarm/internal/swarm"
)

// Config holds the swarm configuration from environment variables.
type Config struct {
	RedisAddr  string
	QdrantAddr string
	HTTPPort   string
	AgentsPath string
	WorkerCount int
}

// AgentsConfig represents the parsed agents.json file.
type AgentsConfig struct {
	Agents []AgentDef `json:"agents"`
}

// AgentDef defines an agent type and its pool size.
type AgentDef struct {
	Type      string `json:"type"`
	PoolSize  int    `json:"pool_size"`
	QueueName string `json:"queue"`
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Load configuration from environment.
	cfg := loadConfig()
	log.Printf("[swarm] config loaded: redis=%s http=%s", cfg.RedisAddr, cfg.HTTPPort)

	// 2. Connect to Redis.
	redisClient := redis.NewClient(&redis.Options{
		Addr:         cfg.RedisAddr,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     20,
	})
	defer redisClient.Close()

	// Verify Redis connection.
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("[swarm] redis ping failed: %v", err)
	}
	log.Println("[swarm] redis connected")

	// 3. Load agents.json config.
	agentsCfg, err := loadAgentsConfig(cfg.AgentsPath)
	if err != nil {
		log.Fatalf("[swarm] load agents config: %v", err)
	}
	log.Printf("[swarm] loaded %d agent types from %s", len(agentsCfg.Agents), cfg.AgentsPath)

	// 4. Build agent registry and Redis client wrapper.
	registry := swarm.NewAgentRegistry()
	swarmRedis := swarm.NewRedisClientWithClient(redisClient)

	// 5. Create and spawn worker pool.
	var workerStoppers []context.CancelFunc
	workerStoppers = buildWorkerPool(ctx, swarmRedis, agentsCfg, registry, workerStoppers)
	log.Printf("[swarm] worker pool ready (%d agent types, %d workers)", len(agentsCfg.Agents), countWorkers(agentsCfg))

	// 6. Start controller loops.
	ctrl := swarm.NewSwarmController(swarmRedis, registry)
	go ctrl.Run()
	log.Println("[swarm] controllers started (scheduler, watchdog, rebalancer)")

	// 6. Setup HTTP server with board SSE endpoints.
	mux := http.NewServeMux()
	boardHandler := swarm.NewBoardHandler(swarm.NewRedisClientWithClient(redisClient), registry)
	boardHandler.RegisterRoutes(mux)

	// Health check endpoint.
	mux.HandleFunc("GET /health", healthHandler)

	srv := &http.Server{
		Addr:         cfg.HTTPPort,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 0, // SSE streaming; no timeout.
		IdleTimeout:  120 * time.Second,
	}

	// Start HTTP server in goroutine.
	go func() {
		log.Printf("[swarm] http server listening on %s", cfg.HTTPPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[swarm] http server error: %v", err)
		}
	}()

	// Graceful shutdown using signal.NotifyContext.
	quitCtx, quitCancel := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer quitCancel()

	// Wait for shutdown signal.
	<-quitCtx.Done()
	log.Println("[swarm] shutdown signal received, draining tasks...")

	// Cancel parent context to stop all goroutines.
	cancel()

	// Graceful HTTP shutdown with 10s timeout.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[swarm] http shutdown error: %v", err)
	}

	log.Println("[swarm] stopped")
}

// loadConfig reads configuration from environment variables.
func loadConfig() Config {
	return Config{
		RedisAddr:  getEnv("REDIS_ADDR", "localhost:6379"),
		QdrantAddr: getEnv("QDRANT_ADDR", "localhost:6334"),
		HTTPPort:   getEnv("SWARM_HTTP_PORT", ":8080"),
		AgentsPath: getEnv("SWARM_AGENTS_PATH", "config/agents.json"),
		WorkerCount: 10, // default; per-agent pool_size comes from agents.json
	}
}

// loadAgentsConfig reads and parses the agents.json file.
func loadAgentsConfig(path string) (*AgentsConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		// Return empty config if file does not exist.
		if os.IsNotExist(err) {
			return &AgentsConfig{Agents: []AgentDef{
				{Type: "intake", PoolSize: 2, QueueName: "swarm:queue:intake"},
				{Type: "classifier", PoolSize: 2, QueueName: "swarm:queue:classifier"},
				{Type: "access_control", PoolSize: 1, QueueName: "swarm:queue:access_control"},
				{Type: "rag", PoolSize: 3, QueueName: "swarm:queue:rag"},
				{Type: "billing", PoolSize: 1, QueueName: "swarm:queue:billing"},
				{Type: "memory_pre", PoolSize: 1, QueueName: "swarm:queue:memory_pre"},
				{Type: "ranking", PoolSize: 2, QueueName: "swarm:queue:ranking"},
				{Type: "response", PoolSize: 2, QueueName: "swarm:queue:response"},
				{Type: "memory_post", PoolSize: 1, QueueName: "swarm:queue:memory_post"},
			}}, nil
		}
		return nil, fmt.Errorf("read agents.json: %w", err)
	}

	var cfg AgentsConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse agents.json: %w", err)
	}
	return &cfg, nil
}

// healthHandler returns JSON {"status": "ok"} for load balancer health checks.
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// getEnv returns the value of an environment variable or a default.
func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// buildWorkerPool spawns goroutine workers for each agent type.
func buildWorkerPool(ctx context.Context, redisClient *swarm.RedisClient, cfg *AgentsConfig, registry *swarm.AgentRegistry, stoppers []context.CancelFunc) []context.CancelFunc {
	for _, agentDef := range cfg.Agents {
		for i := 0; i < agentDef.PoolSize; i++ {
			worker := createWorker(agentDef.Type, redisClient, registry)
			if worker != nil {
				go func(w *swarm.SwarmWorker) {
					if err := w.Run(); err != nil {
						log.Printf("[swarm] worker error: %v", err)
					}
				}(worker)
				log.Printf("[swarm] spawned worker for %s (queue=%s)", agentDef.Type, agentDef.QueueName)
			} else {
				log.Printf("[swarm] skipped worker for %s: agent not initialized", agentDef.Type)
			}
		}
	}
	_ = stoppers // TODO: track worker cancel funcs for graceful shutdown
	return stoppers
}

// countWorkers returns the total number of workers from agent pool sizes.
func countWorkers(cfg *AgentsConfig) int {
	total := 0
	for _, a := range cfg.Agents {
		total += a.PoolSize
	}
	return total
}

// createWorker creates a SwarmWorker for the given agent type.
func createWorker(agentType string, redisClient *swarm.RedisClient, registry *swarm.AgentRegistry) *swarm.SwarmWorker {
	var agent agents.AgentInterface

	switch agentType {
	case "intake":
		agent = agents.NewIntakeAgent(os.Getenv("WHATSAPP_SECRET"), os.Getenv("WHATSAPP_TOKEN"))
	case "classifier":
		agent = agents.NewClassifierAgent(os.Getenv("GEMINI_API_KEY"))
	case "access_control":
		agent = agents.NewAccessControlAgent(nil, 10) // TODO: pass real Redis client
	case "rag":
		// RAG agent needs embedder and qdrant - skip if not configured
		if os.Getenv("GEMINI_API_KEY") == "" {
			log.Printf("[swarm] rag agent skipped: GEMINI_API_KEY not set")
			return nil
		}
		// agent = agents.NewRAGAgent(...) // TODO: wire when embedder/qdrant ready
		return nil
	case "ranking":
		// agent = agents.NewRankingAgent(...) // TODO: wire when ready
		return nil
	case "response":
		if os.Getenv("GEMINI_API_KEY") == "" || os.Getenv("WHATSAPP_TOKEN") == "" {
			log.Printf("[swarm] response agent skipped: GEMINI_API_KEY or WHATSAPP_TOKEN not set")
			return nil
		}
		agent = agents.NewResponseAgent(
			os.Getenv("GEMINI_API_KEY"),
			os.Getenv("WHATSAPP_TOKEN"),
			os.Getenv("WHATSAPP_PHONE_ID"),
		)
	case "billing":
		// agent = agents.NewBillingAgent(...) // TODO: wire when stripe ready
		return nil
	case "memory", "memory_pre", "memory_post":
		if os.Getenv("GEMINI_API_KEY") == "" {
			log.Printf("[swarm] memory agent skipped: GEMINI_API_KEY not set")
			return nil
		}
		agent = agents.NewMemoryAgent(nil, os.Getenv("GEMINI_API_KEY")) // TODO: pass real Redis client
	default:
		log.Printf("[swarm] unknown agent type: %s", agentType)
		return nil
	}

	if agent == nil {
		return nil
	}

	return swarm.NewSwarmWorker(agent, redisClient, registry)
}
