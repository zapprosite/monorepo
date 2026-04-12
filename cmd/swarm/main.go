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

	"github.com/qdrant/go-client/qdrant"
	"github.com/redis/go-redis/v9"
	"github.com/will-zappro/hvacr-swarm/internal/agents"
	"github.com/will-zappro/hvacr-swarm/internal/billing"
	"github.com/will-zappro/hvacr-swarm/internal/gemini"
	"github.com/will-zappro/hvacr-swarm/internal/memory"
	"github.com/will-zappro/hvacr-swarm/internal/minimax"
	"github.com/will-zappro/hvacr-swarm/internal/swarm"
	"github.com/will-zappro/hvacr-swarm/internal/whatsapp"
)

// redisClientAdapter wraps *redis.Client to implement agents.RedisClientInterface.
type redisClientAdapter struct {
	rdb *redis.Client
}

func (a *redisClientAdapter) Eval(ctx context.Context, script string, keys []string, args ...interface{}) *agents.EvalResult {
	cmd := a.rdb.Eval(ctx, script, keys, args...)
	return &agents.EvalResult{Value: cmd.Val(), Err: cmd.Err()}
}

func (a *redisClientAdapter) Get(ctx context.Context, key string) (string, error) {
	return a.rdb.Get(ctx, key).Result()
}

func (a *redisClientAdapter) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return a.rdb.Set(ctx, key, value, expiration).Err()
}

func (a *redisClientAdapter) HGet(ctx context.Context, key, field string) (string, error) {
	return a.rdb.HGet(ctx, key, field).Result()
}

func (a *redisClientAdapter) HSet(ctx context.Context, key string, values map[string]interface{}) error {
	return a.rdb.HSet(ctx, key, values).Err()
}

// memoryRedisAdapter implements agents.MemoryRedisInterface for memory agent.
type memoryRedisAdapter struct {
	rdb *redis.Client
}

func (a *memoryRedisAdapter) LPush(ctx context.Context, key string, values ...interface{}) error {
	return a.rdb.LPush(ctx, key, values...).Err()
}

func (a *memoryRedisAdapter) LTrim(ctx context.Context, key string, start, stop int64) error {
	return a.rdb.LTrim(ctx, key, start, stop).Err()
}

func (a *memoryRedisAdapter) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	return a.rdb.LRange(ctx, key, start, stop).Result()
}

func (a *memoryRedisAdapter) HSet(ctx context.Context, key string, values map[string]interface{}) error {
	return a.rdb.HSet(ctx, key, values).Err()
}

func (a *memoryRedisAdapter) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return a.rdb.HGetAll(ctx, key).Result()
}

func (a *memoryRedisAdapter) Incr(ctx context.Context, key string) (int64, error) {
	return a.rdb.Incr(ctx, key).Result()
}

func (a *memoryRedisAdapter) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return a.rdb.Expire(ctx, key, expiration).Err()
}

func (a *memoryRedisAdapter) Publish(ctx context.Context, channel string, message interface{}) error {
	return a.rdb.Publish(ctx, channel, message).Err()
}

func (a *memoryRedisAdapter) SAdd(ctx context.Context, key string, members ...interface{}) error {
	return a.rdb.SAdd(ctx, key, members...).Err()
}

func (a *memoryRedisAdapter) SMembers(ctx context.Context, key string) ([]string, error) {
	return a.rdb.SMembers(ctx, key).Result()
}

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

	// 3. Initialize external service clients.
	geminiAPIKey := os.Getenv("GEMINI_API_KEY")
	minimaxAPIKey := os.Getenv("MINIMAX_API_KEY")
	stripeKey := os.Getenv("STRIPE_SECRET_KEY")

	// Create Redis layer for agent state (implements RedisCacheLayer, etc).
	memoryRedisLayer := memory.NewRedisLayer(redisClient)
	log.Println("[swarm] memory redis layer ready")

	// Create Gemini embedder for RAG agent.
	var geminiEmbedder gemini.EmbedderInterface
	if geminiAPIKey != "" {
		geminiEmbedder = gemini.NewEmbedderWithKey(geminiAPIKey)
		log.Println("[swarm] gemini embedder ready")
	} else {
		log.Printf("[swarm] gemini embedder skipped: GEMINI_API_KEY not set")
	}

	// Create MiniMax embedder for Qdrant layer.
	var minimaxEmbedder *minimax.Embedder
	if minimaxAPIKey != "" {
		minimaxEmbedder = minimax.NewEmbedderWithKey(minimaxAPIKey)
		log.Println("[swarm] minimax embedder ready")
	} else {
		log.Printf("[swarm] minimax embedder skipped: MINIMAX_API_KEY not set")
	}

	// Create Qdrant client and layer.
	var qdrantLayer *memory.QdrantLayer
	if cfg.QdrantAddr != "" {
		qdrantClient, err := qdrant.NewClient(&qdrant.Config{
			Host: cfg.QdrantAddr,
		})
		if err != nil {
			log.Printf("[swarm] qdrant client error: %v", err)
		} else {
			if minimaxEmbedder != nil {
				qdrantLayer = memory.NewQdrantLayerWithEmbedder(qdrantClient, minimaxEmbedder)
			} else {
				qdrantLayer = memory.NewQdrantLayer(qdrantClient)
			}
			log.Printf("[swarm] qdrant client ready (addr=%s)", cfg.QdrantAddr)
		}
	} else {
		log.Printf("[swarm] qdrant skipped: QDRANT_ADDR not set")
	}

	// Create Stripe billing client.
	var stripeBilling *billing.StripeBilling
	if stripeKey != "" {
		stripeBilling = billing.NewStripeBillingWithKey(stripeKey)
		log.Println("[swarm] stripe billing ready")
	} else {
		log.Printf("[swarm] stripe billing skipped: STRIPE_SECRET_KEY not set")
	}

	// 4. Load agents.json config.
	agentsCfg, err := loadAgentsConfig(cfg.AgentsPath)
	if err != nil {
		log.Fatalf("[swarm] load agents config: %v", err)
	}
	log.Printf("[swarm] loaded %d agent types from %s", len(agentsCfg.Agents), cfg.AgentsPath)

	// 4a. Load tasks.json config (optional - for task schema validation).
	tasksCfg, err := loadTasksConfig("configs/tasks.json")
	if err != nil {
		log.Fatalf("[swarm] load tasks config: %v", err)
	}
	if tasksCfg != nil {
		log.Printf("[swarm] loaded task schema version %s", tasksCfg.TaskSchema.Version)
	}

	// 4b. Load queue_schema.json config (optional - for queue schema validation).
	queueCfg, err := loadQueueSchemaConfig("configs/queue_schema.json")
	if err != nil {
		log.Fatalf("[swarm] load queue schema config: %v", err)
	}
	if queueCfg != nil {
		log.Printf("[swarm] loaded queue schema version %s with %d queues", queueCfg.QueueSchema.Version, len(queueCfg.QueueSchema.Queues))
	}

	// 5. Build agent registry and Redis client wrapper.
	registry := swarm.NewAgentRegistry()
	swarmRedis := swarm.NewRedisClientWithClient(redisClient)

	// 6. Create and spawn worker pool.
	var workerStoppers []context.CancelFunc
	workerStoppers = buildWorkerPool(ctx, swarmRedis, agentsCfg, registry, workerStoppers, geminiEmbedder, qdrantLayer, stripeBilling, redisClient, memoryRedisLayer)
	log.Printf("[swarm] worker pool ready (%d agent types, %d workers)", len(agentsCfg.Agents), countWorkers(agentsCfg))

	// 7. Start controller loops.
	ctrl := swarm.NewSwarmController(swarmRedis, registry)
	go ctrl.Run()
	log.Println("[swarm] controllers started (scheduler, watchdog, rebalancer)")

	// 8. Setup HTTP server with board SSE endpoints.
	mux := http.NewServeMux()
	boardHandler := swarm.NewBoardHandler(swarm.NewRedisClientWithClient(redisClient), registry)
	boardHandler.RegisterRoutes(mux)

	// WhatsApp webhook endpoint - receives messages and enqueues to intake agent.
	whatsappWebhook := whatsapp.NewWhatsAppWebhookHandler(
		os.Getenv("WHATSAPP_SECRET"), // App secret for validation
		swarmRedis,
	)
	mux.Handle("POST /webhook/whatsapp", whatsappWebhook)
	mux.Handle("GET /webhook/whatsapp", whatsappWebhook) // Verification challenge

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

// TasksConfig represents the parsed tasks.json file.
type TasksConfig struct {
	TaskSchema TasksSchemaConfig `json:"task_schema"`
}

// TasksSchemaConfig defines the task schema structure.
type TasksSchemaConfig struct {
	Version       string                  `json:"version"`
	Fields       map[string]TaskField    `json:"fields"`
	PriorityRules PriorityRulesConfig     `json:"priority_rules"`
}

// TaskField describes a single task field.
type TaskField struct {
	Type     string   `json:"type"`
	Format   string   `json:"format,omitempty"`
	Required bool     `json:"required,omitempty"`
	Enum     []string `json:"enum,omitempty"`
	Default  any      `json:"default,omitempty"`
	Nullable bool     `json:"nullable,omitempty"`
	Min      int      `json:"min,omitempty"`
	Max      int      `json:"max,omitempty"`
}

// PriorityRulesConfig defines priority rules for task scheduling.
type PriorityRulesConfig struct {
	CriticalAgents PriorityAgentConfig `json:"critical_agents"`
	HighAgents     PriorityAgentConfig `json:"high_agents"`
	LowAgents      PriorityAgentConfig `json:"low_agents"`
	BoostRules     []BoostRule        `json:"boost_rules"`
}

// PriorityAgentConfig defines base priority for agent types.
type PriorityAgentConfig struct {
	Types       []string `json:"types"`
	BasePriority int     `json:"base_priority"`
}

// BoostRule defines a priority boost condition.
type BoostRule struct {
	Condition string `json:"condition"`
	Boost     int    `json:"boost"`
}

// loadTasksConfig reads and parses the tasks.json file.
func loadTasksConfig(path string) (*TasksConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // tasks.json is optional
		}
		return nil, fmt.Errorf("read tasks.json: %w", err)
	}

	var cfg TasksConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse tasks.json: %w", err)
	}
	return &cfg, nil
}

// QueueSchemaConfig represents the parsed queue_schema.json file.
type QueueSchemaConfig struct {
	QueueSchema QueueSchemaDetail `json:"queue_schema"`
}

// QueueSchemaDetail defines the queue schema structure.
type QueueSchemaDetail struct {
	Version      string                  `json:"version"`
	Engine      string                  `json:"engine"`
	Architecture string                 `json:"architecture"`
	Queues       map[string]QueueDef    `json:"queues"`
	WorkStealing WorkStealingConfig     `json:"work_stealing"`
	OrphanDetection OrphanDetectionConfig `json:"orphan_detection"`
}

// QueueDef defines a single queue configuration.
type QueueDef struct {
	Key            string `json:"key"`
	ProcessingKey  string `json:"processing_key"`
	DeadLetterKey  string `json:"dead_letter_key"`
	MaxRetries     int    `json:"max_retries"`
	TimeoutMs      int    `json:"timeout_ms"`
	PriorityClass  string `json:"priority_class"`
	ClaimStrategy  string `json:"claim_strategy"`
}

// WorkStealingConfig defines work-stealing behavior.
type WorkStealingConfig struct {
	Condition string `json:"condition"`
	Operation string `json:"operation"`
	Atomic   bool   `json:"atomic"`
	Tracking string `json:"tracking"`
}

// OrphanDetectionConfig defines orphan task detection.
type OrphanDetectionConfig struct {
	IntervalSeconds    int    `json:"interval_seconds"`
	HeartbeatTTLSeconds int   `json:"heartbeat_ttl_seconds"`
	Action            string `json:"action"`
}

// loadQueueSchemaConfig reads and parses the queue_schema.json file.
func loadQueueSchemaConfig(path string) (*QueueSchemaConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // queue_schema.json is optional
		}
		return nil, fmt.Errorf("read queue_schema.json: %w", err)
	}

	var cfg QueueSchemaConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse queue_schema.json: %w", err)
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
func buildWorkerPool(ctx context.Context, redisClient *swarm.RedisClient, cfg *AgentsConfig, registry *swarm.AgentRegistry, stoppers []context.CancelFunc, geminiEmbedder gemini.EmbedderInterface, qdrantLayer *memory.QdrantLayer, stripeBilling *billing.StripeBilling, rdb *redis.Client, memoryLayer *memory.RedisLayer) []context.CancelFunc {
	for _, agentDef := range cfg.Agents {
		for i := 0; i < agentDef.PoolSize; i++ {
			worker := createWorker(agentDef.Type, redisClient, registry, geminiEmbedder, qdrantLayer, stripeBilling, rdb, memoryLayer)
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
func createWorker(agentType string, redisClient *swarm.RedisClient, registry *swarm.AgentRegistry, geminiEmbedder gemini.EmbedderInterface, qdrantLayer *memory.QdrantLayer, stripeBilling *billing.StripeBilling, rdb *redis.Client, memoryLayer *memory.RedisLayer) *swarm.SwarmWorker {
	var agent agents.AgentInterface

	switch agentType {
	case "intake":
		agent = agents.NewIntakeAgent(os.Getenv("WHATSAPP_SECRET"), os.Getenv("WHATSAPP_TOKEN"))
	case "classifier":
		agent = agents.NewClassifierAgent(os.Getenv("GEMINI_API_KEY"))
	case "access_control":
		// Wrap redis.Client to implement RedisClientInterface for access_control agent.
		redisAdapter := &redisClientAdapter{rdb: rdb}
		agent = agents.NewAccessControlAgent(redisAdapter, 10)
	case "rag":
		// RAG agent needs embedder, qdrant, and redis
		if geminiEmbedder == nil || qdrantLayer == nil || memoryLayer == nil {
			log.Printf("[swarm] rag agent skipped: gemini embedder, qdrant layer, or memory layer not available")
			return nil
		}
		agent = agents.NewRAGAgent(geminiEmbedder, qdrantLayer, memoryLayer)
	case "ranking":
		// Ranking agent needs redis and minimax API key
		if os.Getenv("MINIMAX_API_KEY") == "" {
			log.Printf("[swarm] ranking agent skipped: MINIMAX_API_KEY not set")
			return nil
		}
		agent = agents.NewRankingAgent(memoryLayer, os.Getenv("MINIMAX_API_KEY"))
	case "response":
		if os.Getenv("MINIMAX_API_KEY") != "" && os.Getenv("WHATSAPP_TOKEN") != "" {
			agent = agents.NewResponseAgent(
				os.Getenv("MINIMAX_API_KEY"),
				os.Getenv("WHATSAPP_TOKEN"),
				os.Getenv("WHATSAPP_PHONE_ID"),
			)
		} else if os.Getenv("WHATSAPP_TOKEN") != "" {
			// Fallback to rules-based agent if no AI API key
			log.Printf("[swarm] response agent: using rules-based (no AI API key configured)")
			agent = agents.NewRulesResponseAgent()
		} else {
			log.Printf("[swarm] response agent skipped: WHATSAPP_TOKEN not set")
			return nil
		}
	case "rules":
		// Rules-based response agent - no AI needed, just pattern matching
		agent = agents.NewRulesResponseAgent()
	case "billing":
		// Billing agent needs redis and stripe client
		if stripeBilling == nil {
			log.Printf("[swarm] billing agent skipped: stripe billing not available")
			return nil
		}
		agent = agents.NewBillingAgent(rdb, stripeBilling)
	case "memory", "memory_pre", "memory_post":
		if os.Getenv("GEMINI_API_KEY") == "" {
			log.Printf("[swarm] memory agent skipped: GEMINI_API_KEY not set")
			return nil
		}
		// Use memoryRedisAdapter to implement MemoryRedisInterface.
		memAdapter := &memoryRedisAdapter{rdb: rdb}
		agent = agents.NewMemoryAgent(memAdapter, os.Getenv("GEMINI_API_KEY"))
	default:
		log.Printf("[swarm] unknown agent type: %s", agentType)
		return nil
	}

	if agent == nil {
		return nil
	}

	return swarm.NewSwarmWorker(agent, redisClient, registry)
}
