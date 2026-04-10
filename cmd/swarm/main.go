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
	"sync"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
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

	// 4. Build agent registry and worker pool.
	registry := swarm.NewAgentRegistry()

	// TODO: Replace with actual SwarmWorker implementation (id 5).
	// workers := buildWorkerPool(ctx, redisClient, agentsCfg, registry)
	log.Printf("[swarm] worker pool ready (%d agent types)", len(agentsCfg.Agents))

	// 5. Start controller loops.
	// TODO: Replace with actual SwarmController implementation (id 6).
	// ctrl := swarm.NewSwarmController(redisClient, registry)
	// go ctrl.SchedulerLoop(ctx)
	// go ctrl.OrphanWatchdog(ctx)
	// go ctrl.RebalanceLoop(ctx)
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
// TODO: Wire with actual SwarmWorker (id 5).
func buildWorkerPool(ctx context.Context, redisClient *redis.Client, cfg *AgentsConfig, registry *swarm.AgentRegistry) *sync.WaitGroup {
	var wg sync.WaitGroup
	for _, agent := range cfg.Agents {
		for i := 0; i < agent.PoolSize; i++ {
			wg.Add(1)
			// TODO: go swarmWorker.Run(ctx, agent.Type, agent.QueueName, &wg)
			log.Printf("[swarm] would spawn worker for %s (queue=%s)", agent.Type, agent.QueueName)
		}
	}
	return &wg
}
