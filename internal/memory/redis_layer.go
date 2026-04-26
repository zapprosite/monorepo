package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisLayer implements the hot layer using Redis.
type RedisLayer struct {
	client *redis.Client
}

// NewRedisLayer creates a new Redis layer instance.
func NewRedisLayer(client *redis.Client) *RedisLayer {
	return &RedisLayer{client: client}
}

// userKey returns the Redis key prefix for user state.
func userKey(phone, field string) string {
	return fmt.Sprintf("user:%s:%s", phone, field)
}

// graphKey returns the Redis key for graph state.
func graphKey(graphID, field string) string {
	return fmt.Sprintf("state:%s:%s", graphID, field)
}

// SetUserState sets user state fields in Redis.
func (r *RedisLayer) SetUserState(ctx context.Context, phone string, state map[string]string) error {
	pipe := r.client.Pipeline()
	for field, value := range state {
		key := userKey(phone, field)
		pipe.Set(ctx, key, value, 0)
	}
	_, err := pipe.Exec(ctx)
	return err
}

// GetUserState retrieves all user state fields from Redis.
func (r *RedisLayer) GetUserState(ctx context.Context, phone string) (map[string]string, error) {
	fields := []string{
		"status", "requests_remaining", "plan",
		"total_requests", "stripe_customer_id",
	}

	result := make(map[string]string)
	pipe := r.client.Pipeline()

	cmds := make(map[string]*redis.StringCmd)
	for _, field := range fields {
		key := userKey(phone, field)
		cmds[field] = pipe.Get(ctx, key)
	}

	_, _ = pipe.Exec(ctx)

	for field, cmd := range cmds {
		val, err := cmd.Result()
		if err == redis.Nil {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("get user state %s: %w", field, err)
		}
		result[field] = val
	}

	return result, nil
}

// SetGraphState sets graph state fields in Redis using HSET.
func (r *RedisLayer) SetGraphState(ctx context.Context, graphID string, state map[string]interface{}) error {
	return r.SetGraphStateWithTTL(ctx, graphID, state, 24*time.Hour)
}

// SetGraphStateWithTTL sets graph state fields in Redis with a custom TTL.
func (r *RedisLayer) SetGraphStateWithTTL(ctx context.Context, graphID string, state map[string]interface{}, ttl time.Duration) error {
	for field, value := range state {
		key := graphKey(graphID, field)

		switch v := value.(type) {
		case string:
			if err := r.client.Set(ctx, key, v, ttl).Err(); err != nil {
				return fmt.Errorf("set graph state %s: %w", field, err)
			}
		case []any, map[string]any:
			// Handle list and map types by JSON encoding
			data, err := json.Marshal(v)
			if err != nil {
				return fmt.Errorf("marshal graph state %s: %w", field, err)
			}
			if err := r.client.Set(ctx, key, data, ttl).Err(); err != nil {
				return fmt.Errorf("set graph state %s: %w", field, err)
			}
		default:
			if err := r.client.Set(ctx, key, fmt.Sprintf("%v", v), ttl).Err(); err != nil {
				return fmt.Errorf("set graph state %s: %w", field, err)
			}
		}
	}
	return nil
}

// GetGraphState retrieves all graph state fields from Redis.
func (r *RedisLayer) GetGraphState(ctx context.Context, graphID string) (map[string]interface{}, error) {
	fields := []string{
		"input", "intent", "entities", "access_decision",
		"rag_candidates", "ranked_results", "assembled_context", "response_sent",
	}

	result := make(map[string]interface{})
	pipe := r.client.Pipeline()

	cmds := make(map[string]*redis.StringCmd)
	for _, field := range fields {
		key := graphKey(graphID, field)
		cmds[field] = pipe.Get(ctx, key)
	}

	_, _ = pipe.Exec(ctx)

	for field, cmd := range cmds {
		val, err := cmd.Result()
		if err == redis.Nil {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("get graph state %s: %w", field, err)
		}
		result[field] = val
	}

	return result, nil
}

// AppendConversation appends a message to the user's conversation list.
func (r *RedisLayer) AppendConversation(ctx context.Context, phone string, message map[string]string) error {
	key := userKey(phone, "conversation")
	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("marshal conversation: %w", err)
	}
	if err := r.client.RPush(ctx, key, data).Err(); err != nil {
		return fmt.Errorf("append conversation: %w", err)
	}
	// Trim to max 20 messages
	if err := r.client.LTrim(ctx, key, -20, -1).Err(); err != nil {
		return fmt.Errorf("trim conversation: %w", err)
	}
	return nil
}

// GetConversation retrieves the user's conversation history.
func (r *RedisLayer) GetConversation(ctx context.Context, phone string) ([]map[string]string, error) {
	key := userKey(phone, "conversation")
	data, err := r.client.LRange(ctx, key, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("get conversation: %w", err)
	}

	result := make([]map[string]string, 0, len(data))
	for _, item := range data {
		var msg map[string]string
		if err := json.Unmarshal([]byte(item), &msg); err != nil {
			continue
		}
		result = append(result, msg)
	}
	return result, nil
}

// IncrementCounter increments a counter and returns the new value.
func (r *RedisLayer) IncrementCounter(ctx context.Context, phone, counter string) (int64, error) {
	key := userKey(phone, counter)
	return r.client.Incr(ctx, key).Result()
}

// SetWithExpiry sets a key with expiration.
func (r *RedisLayer) SetWithExpiry(ctx context.Context, phone, field, value string, expiry time.Duration) error {
	key := userKey(phone, field)
	return r.client.Set(ctx, key, value, expiry).Err()
}

// MarkDirty adds a user to the dirty set for later SQLite sync.
func (r *RedisLayer) MarkDirty(ctx context.Context, phone string) error {
	return r.client.SAdd(ctx, "dirty:users", phone).Err()
}

// MarkConversationDirty adds a conversation to the dirty set for later SQLite sync.
func (r *RedisLayer) MarkConversationDirty(ctx context.Context, phone string) error {
	return r.client.SAdd(ctx, "dirty:conversations", phone).Err()
}

// MarkBillingEventDirty adds a billing event ID to the dirty set.
func (r *RedisLayer) MarkBillingEventDirty(ctx context.Context, eventID string) error {
	return r.client.SAdd(ctx, "dirty:billing_events", eventID).Err()
}

// MarkAuditLogDirty adds an audit log entry to the dirty set.
func (r *RedisLayer) MarkAuditLogDirty(ctx context.Context, graphID string) error {
	return r.client.SAdd(ctx, "dirty:audit_logs", graphID).Err()
}

// GetDirtyUsers atomically gets and clears dirty users for sync.
func (r *RedisLayer) GetDirtyUsers(ctx context.Context, batchSize int64) ([]string, error) {
	key := "dirty:users"
	// Get all dirty users
	members, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, nil
	}
	// Limit to batch size
	if int64(len(members)) > batchSize {
		members = members[:batchSize]
	}
	// Remove the fetched members atomically using pipeline
	if len(members) > 0 {
	pipe := r.client.Pipeline()
		for _, m := range members {
			pipe.SRem(ctx, key, m)
		}
		_, err = pipe.Exec(ctx)
		if err != nil {
			return nil, err
		}
	}
	return members, nil
}

// GetDirtyConversations atomically gets and clears dirty conversations for sync.
func (r *RedisLayer) GetDirtyConversations(ctx context.Context, batchSize int64) ([]string, error) {
	key := "dirty:conversations"
	members, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, nil
	}
	if int64(len(members)) > batchSize {
		members = members[:batchSize]
	}
	if len(members) > 0 {
		pipe := r.client.Pipeline()
		for _, m := range members {
			pipe.SRem(ctx, key, m)
		}
		_, err = pipe.Exec(ctx)
		if err != nil {
			return nil, err
		}
	}
	return members, nil
}

// GetDirtyBillingEvents atomically gets and clears dirty billing events for sync.
func (r *RedisLayer) GetDirtyBillingEvents(ctx context.Context, batchSize int64) ([]string, error) {
	key := "dirty:billing_events"
	members, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, nil
	}
	if int64(len(members)) > batchSize {
		members = members[:batchSize]
	}
	if len(members) > 0 {
		pipe := r.client.Pipeline()
		for _, m := range members {
			pipe.SRem(ctx, key, m)
		}
		_, err = pipe.Exec(ctx)
		if err != nil {
			return nil, err
		}
	}
	return members, nil
}

// GetDirtyAuditLogs atomically gets and clears dirty audit logs for sync.
func (r *RedisLayer) GetDirtyAuditLogs(ctx context.Context, batchSize int64) ([]string, error) {
	key := "dirty:audit_logs"
	members, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, nil
	}
	if int64(len(members)) > batchSize {
		members = members[:batchSize]
	}
	if len(members) > 0 {
		pipe := r.client.Pipeline()
		for _, m := range members {
			pipe.SRem(ctx, key, m)
		}
		_, err = pipe.Exec(ctx)
		if err != nil {
			return nil, err
		}
	}
	return members, nil
}

// GetInt retrieves an integer value from a key.
func (r *RedisLayer) GetInt(ctx context.Context, phone, field string) (int64, error) {
	key := userKey(phone, field)
	val, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(val, 10, 64)
}

// Close closes the Redis connection.
func (r *RedisLayer) Close() error {
	return r.client.Close()
}

// Client returns the underlying Redis client for health checks.
func (r *RedisLayer) Client() *redis.Client {
	return r.client
}
