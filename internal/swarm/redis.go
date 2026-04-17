package swarm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// Redis key prefixes
const (
	KeyPrefixQueue          = "swarm:queue:"
	KeyPrefixProcessing     = "swarm:queue:%s:processing"
	KeyPrefixDead           = "swarm:queue:%s:dead"
	KeyPrefixHeartbeat      = "swarm:agents:heartbeat:%s"
	KeyPrefixRegistry       = "swarm:agents:registry"
	KeyPrefixStats          = "swarm:agents:stats:%s"
	ChannelTaskCompleted    = "swarm:events:task_completed"
	ChannelAgentStatus      = "swarm:events:agent_status"
	ChannelGraphDone        = "swarm:events:graph_done"
	ChannelRebalance        = "swarm:events:rebalance"
)

// HeartbeatTTL is the TTL for agent heartbeats (15 seconds)
const HeartbeatTTL = 15 * time.Second

// Task represents a task in the swarm queue.
type Task struct {
	TaskID     string          `json:"task_id"`
	GraphID    string          `json:"graph_id"`
	NodeID     string          `json:"node_id"`
	Type       string          `json:"type"`
	Status     string          `json:"status"`
	Priority   int             `json:"priority"`
	WorkerID   *string         `json:"worker_id,omitempty"`
	Input      json.RawMessage `json:"input,omitempty"`
	Output     json.RawMessage `json:"output,omitempty"`
	Retries    int             `json:"retries"`
	MaxRetries int             `json:"max_retries"`
	TimeoutMs  int             `json:"timeout_ms"`
	StolenFrom *string         `json:"stolen_from,omitempty"`
	ClaimedAt  *int64          `json:"claimed_at,omitempty"`
}

// CanRetry returns true if the task can be retried within MaxRetries.
func (t *Task) CanRetry() bool {
	return t.Retries < t.MaxRetries
}

// AgentInfo represents an agent in the registry.
type AgentInfo struct {
	WorkerID   string `json:"worker_id"`
	AgentType  string `json:"agent_type"`
	StartedAt  int64  `json:"started_at"`
	LastSeenAt int64  `json:"last_seen_at"`
	Status     string `json:"status"`
}

// AgentStats holds agent statistics.
type AgentStats struct {
	Completed int     `json:"completed"`
	Stolen    int     `json:"stolen"`
	AvgMs     float64 `json:"avg_ms"`
}

// RedisClient wraps the Redis client with swarm-specific operations.
type RedisClient struct {
	rdb *redis.Client
}

// NewRedisClient creates a new Redis client for the swarm.
func NewRedisClient(addr string) *RedisClient {
	return &RedisClient{
		rdb: redis.NewClient(&redis.Options{
			Addr: addr,
		}),
	}
}

// NewRedisClientWithClient creates a RedisClient from an existing redis.Client.
func NewRedisClientWithClient(rdb *redis.Client) *RedisClient {
	return &RedisClient{rdb: rdb}
}

// Close closes the Redis connection.
func (c *RedisClient) Close() error {
	return c.rdb.Close()
}

// QueueKey returns the queue key for a given agent type.
func QueueKey(agentType string) string {
	return fmt.Sprintf("%s%s", KeyPrefixQueue, agentType)
}

// ProcessingKey returns the processing hash key for a given agent type.
func ProcessingKey(agentType string) string {
	return fmt.Sprintf(KeyPrefixProcessing, agentType)
}

// DeadLetterKey returns the dead-letter queue key for a given agent type.
func DeadLetterKey(agentType string) string {
	return fmt.Sprintf(KeyPrefixDead, agentType)
}

// PushTask adds a task to the queue (LPUSH).
func (c *RedisClient) PushTask(ctx context.Context, agentType string, task *Task) error {
	data, err := json.Marshal(task)
	if err != nil {
		return fmt.Errorf("failed to marshal task: %w", err)
	}
	return c.rdb.LPush(ctx, QueueKey(agentType), data).Err()
}

// EnqueueTask adds a task to the queue from a map (used by webhooks).
func (c *RedisClient) EnqueueTask(ctx context.Context, queueName string, taskData map[string]any) error {
	data, err := json.Marshal(taskData)
	if err != nil {
		return fmt.Errorf("failed to marshal task: %w", err)
	}
	return c.rdb.LPush(ctx, QueueKey(queueName), data).Err()
}

// PopTaskBlocking waits for a task from the queue (BRPOP).
func (c *RedisClient) PopTaskBlocking(ctx context.Context, agentType string, timeout time.Duration) (*Task, error) {
	result, err := c.rdb.BRPop(ctx, timeout, QueueKey(agentType)).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	if len(result) < 2 {
		return nil, nil
	}
	var task Task
	if err := json.Unmarshal([]byte(result[1]), &task); err != nil {
		return nil, fmt.Errorf("failed to unmarshal task: %w", err)
	}
	return &task, nil
}

// StealTask attempts to steal a task from another queue (LMOVE).
func (c *RedisClient) StealTask(ctx context.Context, srcAgentType, destAgentType string) (*Task, error) {
	srcKey := QueueKey(srcAgentType)
	destKey := QueueKey(destAgentType)
	result, err := c.rdb.LMove(ctx, srcKey, destKey, "RIGHT", "LEFT").Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	var task Task
	if err := json.Unmarshal([]byte(result), &task); err != nil {
		return nil, fmt.Errorf("failed to unmarshal stolen task: %w", err)
	}
	return &task, nil
}

// ClaimTask atomically claims a task using the Lua script.
func (c *RedisClient) ClaimTask(ctx context.Context, agentType, workerID string, timestamp int64) (*Task, error) {
	queueKey := QueueKey(agentType)
	processingKey := ProcessingKey(agentType)

	script := redis.NewScript(`
		local task_json = redis.call('RPOP', KEYS[1])
		if task_json then
			local task = cjson.decode(task_json)
			task['status'] = 'running'
			task['worker_id'] = ARGV[1]
			task['claimed_at'] = tonumber(ARGV[2])
			local task_id = task['task_id']
			redis.call('HSET', KEYS[2], task_id, cjson.encode(task))
			-- Return task_id and fields individually to avoid cjson.encode mangling int64
			return task_id .. '|' .. ARGV[1] .. '|' .. ARGV[2]
		end
		return nil
	`)

	result, err := script.Run(ctx, c.rdb, []string{queueKey, processingKey}, workerID, timestamp).Text()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	if result == "" || result == "\n" {
		return nil, nil
	}

	// Parse "task_id|worker_id|timestamp" format to avoid cjson.encode mangling int64
	parts := strings.Split(result, "|")
	if len(parts) != 3 {
		return nil, fmt.Errorf("unexpected claim result format: %q", result)
	}

	ts, _ := strconv.ParseInt(strings.TrimSpace(parts[2]), 10, 64)
	wid := parts[1]
	return &Task{
		TaskID:    parts[0],
		WorkerID:  &wid,
		ClaimedAt: &ts,
		Status:    "running",
	}, nil
}

// CompleteTask removes a task from processing and optionally moves to dead-letter.
func (c *RedisClient) CompleteTask(ctx context.Context, agentType, taskID string, output json.RawMessage, moveToDeadLetter bool) error {
	processingKey := ProcessingKey(agentType)

	taskData, err := c.rdb.HGet(ctx, processingKey, taskID).Result()
	if err != nil {
		return fmt.Errorf("failed to get task from processing: %w", err)
	}

	var task Task
	if err := json.Unmarshal([]byte(taskData), &task); err != nil {
		return fmt.Errorf("failed to unmarshal task: %w", err)
	}
	task.Output = output
	task.Status = "completed"

	if moveToDeadLetter {
		deadKey := DeadLetterKey(agentType)
		data, _ := json.Marshal(task)
		return c.rdb.LPush(ctx, deadKey, data).Err()
	}

	return c.rdb.HDel(ctx, processingKey, taskID).Err()
}

// GetProcessingTasks returns all tasks currently being processed by an agent type.
func (c *RedisClient) GetProcessingTasks(ctx context.Context, agentType string) ([]*Task, error) {
	processingKey := ProcessingKey(agentType)
	result, err := c.rdb.HGetAll(ctx, processingKey).Result()
	if err != nil {
		return nil, err
	}
	tasks := make([]*Task, 0, len(result))
	for _, data := range result {
		var task Task
		if err := json.Unmarshal([]byte(data), &task); err != nil {
			continue
		}
		tasks = append(tasks, &task)
	}
	return tasks, nil
}

// HeartbeatKey returns the heartbeat key for a worker.
func HeartbeatKey(workerID string) string {
	return fmt.Sprintf(KeyPrefixHeartbeat, workerID)
}

// StatsKey returns the stats key for a worker.
func StatsKey(workerID string) string {
	return fmt.Sprintf(KeyPrefixStats, workerID)
}

// RegisterAgent registers a new agent in the registry.
func (c *RedisClient) RegisterAgent(ctx context.Context, info *AgentInfo) error {
	data, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("failed to marshal agent info: %w", err)
	}
	return c.rdb.HSetNX(ctx, KeyPrefixRegistry, info.WorkerID, data).Err()
}

// UpdateAgentHeartbeat updates the agent heartbeat using the Lua script.
func (c *RedisClient) UpdateAgentHeartbeat(ctx context.Context, workerID string) error {
	script := redis.NewScript(`
		redis.call('SETEX', KEYS[1], ARGV[1], 'alive')
		return 1
	`)
	return script.Run(ctx, c.rdb, []string{HeartbeatKey(workerID)}, int(HeartbeatTTL.Seconds())).Err()
}

// IsAgentAlive checks if an agent has a valid heartbeat.
func (c *RedisClient) IsAgentAlive(ctx context.Context, workerID string) (bool, error) {
	result, err := c.rdb.Get(ctx, HeartbeatKey(workerID)).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return result == "alive", nil
}

// GetAliveAgents returns all agents with valid heartbeats.
func (c *RedisClient) GetAliveAgents(ctx context.Context) ([]*AgentInfo, error) {
	result, err := c.rdb.HGetAll(ctx, KeyPrefixRegistry).Result()
	if err != nil {
		return nil, err
	}
	agents := make([]*AgentInfo, 0, len(result))
	for workerID, data := range result {
		alive, _ := c.IsAgentAlive(ctx, workerID)
		if !alive {
			continue
		}
		var info AgentInfo
		if err := json.Unmarshal([]byte(data), &info); err != nil {
			continue
		}
		agents = append(agents, &info)
	}
	return agents, nil
}

// UpdateAgentStats updates agent statistics.
func (c *RedisClient) UpdateAgentStats(ctx context.Context, workerID string, completed, stolen int, avgMs float64) error {
	statsKey := StatsKey(workerID)
	return c.rdb.HSet(ctx, statsKey, map[string]interface{}{
		"completed": completed,
		"stolen":    stolen,
		"avg_ms":    avgMs,
	}).Err()
}

// GetAgentStats returns statistics for an agent.
func (c *RedisClient) GetAgentStats(ctx context.Context, workerID string) (*AgentStats, error) {
	result, err := c.rdb.HGetAll(ctx, StatsKey(workerID)).Result()
	if err != nil {
		return nil, err
	}
	stats := &AgentStats{}
	if v, ok := result["completed"]; ok {
		fmt.Sscanf(v, "%d", &stats.Completed)
	}
	if v, ok := result["stolen"]; ok {
		fmt.Sscanf(v, "%d", &stats.Stolen)
	}
	if v, ok := result["avg_ms"]; ok {
		fmt.Sscanf(v, "%f", &stats.AvgMs)
	}
	return stats, nil
}

// PublishTaskCompleted publishes a task completed event.
func (c *RedisClient) PublishTaskCompleted(ctx context.Context, taskID, workerID string) error {
	payload, _ := json.Marshal(map[string]string{
		"task_id":   taskID,
		"worker_id": workerID,
	})
	return c.rdb.Publish(ctx, ChannelTaskCompleted, payload).Err()
}

// PublishAgentStatus publishes an agent status event.
func (c *RedisClient) PublishAgentStatus(ctx context.Context, workerID, status string) error {
	payload, _ := json.Marshal(map[string]string{
		"worker_id": workerID,
		"status":    status,
	})
	return c.rdb.Publish(ctx, ChannelAgentStatus, payload).Err()
}

// PublishGraphDone publishes a graph completed event.
func (c *RedisClient) PublishGraphDone(ctx context.Context, graphID string) error {
	payload, _ := json.Marshal(map[string]string{
		"graph_id": graphID,
	})
	return c.rdb.Publish(ctx, ChannelGraphDone, payload).Err()
}

// PublishRebalance publishes a rebalance event.
func (c *RedisClient) PublishRebalance(ctx context.Context, reason string) error {
	payload, _ := json.Marshal(map[string]string{
		"reason": reason,
	})
	return c.rdb.Publish(ctx, ChannelRebalance, payload).Err()
}

// Subscribe returns a Pub/Sub subscription for the given channels.
func (c *RedisClient) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return c.rdb.Subscribe(ctx, channels...)
}

// GetQueueLength returns the length of a queue.
func (c *RedisClient) GetQueueLength(ctx context.Context, agentType string) (int64, error) {
	return c.rdb.LLen(ctx, QueueKey(agentType)).Result()
}

// GetDeadLetterLength returns the length of a dead-letter queue.
func (c *RedisClient) GetDeadLetterLength(ctx context.Context, agentType string) (int64, error) {
	return c.rdb.LLen(ctx, DeadLetterKey(agentType)).Result()
}

// Ping checks the Redis connection.
func (c *RedisClient) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}
