package billing

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Redis key helpers for billing.
func planKey(phone, field string) string {
	return fmt.Sprintf("user:%s:%s", phone, field)
}

// ActivatePlan sets the user's plan in Redis.
func ActivatePlan(ctx context.Context, rdb *redis.Client, phone, plan string) error {
	key := planKey(phone, "plan")
	return rdb.Set(ctx, key, plan, 0).Err()
}

// GetPlan returns the user's current plan from Redis.
func GetPlan(ctx context.Context, rdb *redis.Client, phone string) (string, error) {
	key := planKey(phone, "plan")
	val, err := rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return string(PlanFree), nil
	}
	return val, err
}

// SetFreeRequests sets the free tier: 10 requests/day.
func SetFreeRequests(ctx context.Context, rdb *redis.Client, phone string) error {
	pipe := rdb.Pipeline()
	pipe.Set(ctx, planKey(phone, "requests_remaining"), 10, 24*time.Hour)
	pipe.Set(ctx, planKey(phone, "requests_window"), "day", 0)
	_, err := pipe.Exec(ctx)
	return err
}

// SetTrialRequests sets the trial tier: 30 requests/7 days.
func SetTrialRequests(ctx context.Context, rdb *redis.Client, phone string) error {
	pipe := rdb.Pipeline()
	pipe.Set(ctx, planKey(phone, "requests_remaining"), 30, 7*24*time.Hour)
	pipe.Set(ctx, planKey(phone, "requests_window"), "7days", 0)
	_, err := pipe.Exec(ctx)
	return err
}

// SetUnlimitedRequests sets unlimited requests for paid plans.
func SetUnlimitedRequests(ctx context.Context, rdb *redis.Client, phone string) error {
	pipe := rdb.Pipeline()
	pipe.Set(ctx, planKey(phone, "requests_remaining"), -1, 0)
	pipe.Set(ctx, planKey(phone, "requests_window"), "month", 0)
	_, err := pipe.Exec(ctx)
	return err
}

// CheckAndDecrement checks remaining requests and decrements atomically.
// Returns (allowed, remaining, error).
func CheckAndDecrement(ctx context.Context, rdb *redis.Client, phone string) (bool, int64, error) {
	key := planKey(phone, "requests_remaining")
	return checkAndDecrementLua(ctx, rdb, key)
}

// checkAndDecrementLua runs the access control Lua script.
func checkAndDecrementLua(ctx context.Context, rdb *redis.Client, key string) (bool, int64, error) {
	script := redis.NewScript(`
		local remaining = redis.call('GET', KEYS[1])
		if remaining == nil or tonumber(remaining) <= 0 then
			return {0, 0}
		end
		redis.call('DECR', KEYS[1])
		return {1, redis.call('GET', KEYS[1])}
	`)

	result, err := script.Run(ctx, rdb, []string{key}).Slice()
	if err != nil {
		return false, 0, err
	}

	allowed := result[0].(int64) == 1
	var remaining int64
	if result[1] != nil {
		if s, ok := result[1].(string); ok {
			fmt.Sscanf(s, "%d", &remaining)
		} else {
			remaining, _ = result[1].(int64)
		}
	}

	return allowed, remaining, nil
}

// GetRequestsRemaining returns the current remaining requests count.
func GetRequestsRemaining(ctx context.Context, rdb *redis.Client, phone string) (int64, error) {
	key := planKey(phone, "requests_remaining")
	val, err := rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return 10, nil // default free tier
	}
	if err != nil {
		return 0, err
	}
	var remaining int64
	fmt.Sscanf(val, "%d", &remaining)
	return remaining, nil
}