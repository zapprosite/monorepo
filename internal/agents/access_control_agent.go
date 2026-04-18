package agents

import (
	"context"
	"fmt"
	"log"
	"time"
)

// AccessDecision represents the access control decision.
type AccessDecision string

const (
	AccessAllow    AccessDecision = "allow"
	AccessBlock    AccessDecision = "block"
	AccessRedirect AccessDecision = "redirect"
)

// AccessControlAgent handles rate limiting and access control.
// It uses Redis Lua scripts for atomic check-and-decrement operations.
type AccessControlAgent struct {
	redisClient RedisClientInterface
	maxRequests int
}

// RedisClientInterface defines the Redis operations needed by AccessControlAgent.
type RedisClientInterface interface {
	Eval(ctx context.Context, script string, keys []string, args ...interface{}) *EvalResult
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error
	HGet(ctx context.Context, key, field string) (string, error)
	HSet(ctx context.Context, key string, values map[string]interface{}) error
}

// EvalResult represents the result of an EVAL script.
type EvalResult struct {
	Value interface{}
	Err  error
}

// Int returns the result as int64.
func (e *EvalResult) Int64() (int64, error) {
	if e.Err != nil {
		return 0, e.Err
	}
	switch v := e.Value.(type) {
	case int64:
		return v, nil
	case int:
		return int64(v), nil
	case float64:
		return int64(v), nil
	default:
		return 0, fmt.Errorf("unexpected type: %T", e.Value)
	}
}

// String returns the result as string.
func (e *EvalResult) String() (string, error) {
	if e.Err != nil {
		return "", e.Err
	}
	switch v := e.Value.(type) {
	case string:
		return v, nil
	default:
		return fmt.Sprintf("%v", v), nil
	}
}

// NewAccessControlAgent creates a new AccessControlAgent.
func NewAccessControlAgent(redisClient RedisClientInterface, maxRequests int) *AccessControlAgent {
	return &AccessControlAgent{
		redisClient: redisClient,
		maxRequests: maxRequests,
	}
}

// AgentType returns the agent type identifier.
func (a *AccessControlAgent) AgentType() string {
	return "access_control"
}

// MaxRetries returns the maximum retry attempts.
func (a *AccessControlAgent) MaxRetries() int {
	return 1
}

// TimeoutMs returns the timeout in milliseconds.
func (a *AccessControlAgent) TimeoutMs() int {
	return 3000
}

// Execute checks rate limits and makes access control decisions.
func (a *AccessControlAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	startTime := time.Now()
	defer func() {
		task.TimeoutMs = int(time.Since(startTime).Milliseconds())
	}()

	// 1. Get phone from input
	phone, ok := task.Input["phone"].(string)
	if !ok || phone == "" {
		return nil, fmt.Errorf("missing phone in task input")
	}

	// 2. Get intent from input to check if billing redirect needed
	intent, _ := task.Input["intent"].(string)

	// 3. Atomic check + decrement using Lua script
	decision, remaining, err := a.checkAndDecrement(ctx, phone, intent)
	if err != nil {
		// On Redis error, fail open (allow) but log
		return map[string]any{
			"decision":               string(AccessAllow),
			"requests_remaining":     -1,
			"access_control.success": false,
			"access_control.error":   err.Error(),
		}, nil
	}

	// 4. Build result based on decision
	result := map[string]any{
		"decision":               string(decision),
		"requests_remaining":      remaining,
		"access_control.success": true,
	}

	// Add redirect info if needed
	if decision == AccessRedirect {
		result["redirect_url"] = fmt.Sprintf("/billing?phone=%s", phone)
		result["redirect_reason"] = "billing_intent"
	}

	// Add block info if needed
	if decision == AccessBlock {
		result["block_reason"] = "rate_limit_exceeded"
		result["retry_after_seconds"] = 60
	}

	return result, nil
}

// checkAndDecrement atomically checks and decrements the request counter.
func (a *AccessControlAgent) checkAndDecrement(ctx context.Context, phone, intent string) (AccessDecision, int, error) {
	key := fmt.Sprintf("user:%s:requests_remaining", phone)

	// Lua script for atomic check and decrement
	// Returns: [decision, remaining]
	// decision: 0 = allow, 1 = block, 2 = redirect
	script := `
local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local intent = ARGV[2]

local remaining = redis.call('GET', key)
if remaining == false then
    -- First request, initialize counter
    redis.call('SET', key, max_requests - 1, 'EX', 86400)
    return {0, max_requests - 1}
end

remaining = tonumber(remaining)

if remaining <= 0 then
    -- Check if this is a billing intent that can redirect
    if intent == 'billing' then
        return {2, 0}
    end
    return {1, 0}
end

-- Decrement and allow
local new_remaining = redis.call('DECR', key)
return {0, new_remaining}
`

	result := a.redisClient.Eval(ctx, script, []string{key}, a.maxRequests, intent)

	intResult, err := result.Int64()
	if err != nil {
		return AccessAllow, 0, err
	}

	// Parse result array [decision, remaining]
	// We need to get both values, but go-redis returns only the first
	// So we fetch remaining separately
	remainingStr, err := a.redisClient.Get(ctx, key)
	if err != nil {
		remainingStr = "0"
	}

	var remaining int
	fmt.Sscanf(remainingStr, "%d", &remaining)

	var decision AccessDecision
	switch intResult {
	case 0:
		decision = AccessAllow
	case 1:
		decision = AccessBlock
	case 2:
		decision = AccessRedirect
	default:
		// Reject unexpected values — log for security auditing
		log.Printf("[access_control] unknown decision value: %d, blocking for safety", intResult)
		decision = AccessBlock
	}
	return decision, remaining, nil
}

// checkRateLimit checks if user has remaining requests (non-decrementing).
func (a *AccessControlAgent) checkRateLimit(ctx context.Context, phone string) (int, error) {
	key := fmt.Sprintf("user:%s:requests_remaining", phone)
	remaining, err := a.redisClient.Get(ctx, key)
	if err != nil {
		return a.maxRequests, nil
	}

	var count int
	fmt.Sscanf(remaining, "%d", &count)
	return count, nil
}

// resetRateLimit resets the rate limit for a user (admin function).
func (a *AccessControlAgent) resetRateLimit(ctx context.Context, phone string) error {
	key := fmt.Sprintf("user:%s:requests_remaining", phone)
	return a.redisClient.Set(ctx, key, a.maxRequests, 24*time.Hour)
}

// updateUsageStats updates usage statistics in Redis.
func (a *AccessControlAgent) updateUsageStats(ctx context.Context, phone, intent string) error {
	key := fmt.Sprintf("user:%s:stats", phone)

	// Increment total requests
	stats, err := a.redisClient.HGet(ctx, key, "total_requests")
	if err != nil || stats == "" {
		stats = "0"
	}

	var total int
	fmt.Sscanf(stats, "%d", &total)
	total++

	return a.redisClient.HSet(ctx, key, map[string]interface{}{
		"total_requests": total,
		"last_intent":    intent,
		"last_access":    time.Now().Unix(),
	})
}

// Ensure AccessControlAgent implements AgentInterface
var _ AgentInterface = (*AccessControlAgent)(nil)
