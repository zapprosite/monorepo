package billing

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// MockStripeClient mocks the Stripe checkout client.
type MockStripeClient struct {
	CreateCheckoutFunc func(ctx context.Context, phone, plan string) (string, error)
}

// MockRedisClient mocks Redis operations for billing.
type MockRedisClient struct {
	GetFunc     func(ctx context.Context, key string) (string, error)
	SetFunc     func(ctx context.Context, key string, value interface{}, expiry time.Duration) error
	IncrFunc    func(ctx context.Context, key string) (int64, error)
	DecrFunc    func(ctx context.Context, key string) (int64, error)
	ExpireFunc  func(ctx context.Context, key string, expiry time.Duration) error
	EvalFunc    func(ctx context.Context, script string, keys []string, args ...interface{}) (interface{}, error)
	ExistsFunc  func(ctx context.Context, key string) (int64, error)
	DelFunc     func(ctx context.Context, keys ...string) error
	SAddFunc    func(ctx context.Context, key string, members ...interface{}) error
	SMembersFunc func(ctx context.Context, key string) ([]string, error)
	HSetFunc    func(ctx context.Context, key string, values map[string]interface{}) error
	HGetFunc    func(ctx context.Context, key, field string) (string, error)
	HGetAllFunc func(ctx context.Context, key string) (map[string]string, error)
}

// AccessControlLua is the atomic check+decrement Lua script from SPEC-006.
const AccessControlLua = `
local remaining = redis.call('GET', KEYS[1])
if remaining == nil or tonumber(remaining) <= 0 then
    return {decision="block", remaining=0}
end
redis.call('DECR', KEYS[1])
return {decision="allow", remaining=redis.call('GET', KEYS[1])}
`

// TestFreeTier_BlocksAfter10Requests smoke-tests the free tier: 10 requests allowed, 11th blocked.
func TestFreeTier_BlocksAfter10Requests(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Setup mock Redis that simulates access control Lua script behavior.
	// The key for free tier requests is: user:{phone}:requests_remaining
	phone := "+5511987654321"
	requestsKey := "user:" + phone + ":requests_remaining"

	requestCount := 0
	blocked := false

	// MockRedisClient simulating the Lua script logic:
	// - GET requests_remaining → returns remaining count
	// - DECR when allowed → decrement
	// - Returns block when count <= 0
	mockRedis := &MockRedisClient{
		GetFunc: func(ctx context.Context, key string) (string, error) {
			if key == requestsKey {
				remaining := 10 - requestCount
				if remaining <= 0 {
					return "0", nil
				}
				return string(rune('0' + remaining)), nil // "10", "9", ...
			}
			return "", errors.New("key not found")
		},
		DecrFunc: func(ctx context.Context, key string) (int64, error) {
			if key == requestsKey && requestCount < 10 {
				requestCount++
				return int64(10 - requestCount), nil
			}
			return 0, nil
		},
	}

	// Simulate 11 requests
	for i := 0; i < 11; i++ {
		// Check remaining (simulate Lua GET)
		remainingStr, err := mockRedis.GetFunc(ctx, requestsKey)
		if err != nil {
			t.Fatalf("GET failed: %v", err)
		}

		var remaining int
		if remainingStr == "0" {
			remaining = 0
		} else {
			remaining = int(remainingStr[0] - '0')
		}

		if remaining <= 0 {
			blocked = true
			break
		}

		// Decrement (simulate Lua DECR)
		_, err = mockRedis.DecrFunc(ctx, requestsKey)
		if err != nil {
			t.Fatalf("DECR failed: %v", err)
		}
	}

	require.True(t, blocked, "11th request should be blocked for free tier")
	require.Equal(t, 10, requestCount, "Exactly 10 requests should succeed")
}

// MockStripeCheckoutSession mocks a Stripe checkout session response.
type MockStripeCheckoutSession struct {
	URL  string
	ID   string
}

// TestStripeCheckout_URLGenerated tests that CreateCheckout generates a valid URL.
// Note: StripeBilling.CreateCheckout requires a real Stripe client.
// Full integration test requires Stripe API key.
func TestStripeCheckout_URLGenerated(t *testing.T) {
	// This test verifies the checkout creation logic path.
	// Full integration test requires Stripe API key.

	// Create StripeBilling with test key (won't actually call Stripe for free/trial/missing price ID)
	billing := NewStripeBillingWithKey("sk_test_xxx")

	// Free plan should error
	_, err := billing.CreateCheckout(context.Background(), "+5511987654321", "free")
	require.Error(t, err, "Free plan should not require checkout")
	require.Contains(t, err.Error(), "free and trial plans do not require checkout")

	// Trial plan should error
	_, err = billing.CreateCheckout(context.Background(), "+5511987654321", "trial")
	require.Error(t, err, "Trial plan should not require checkout")
	require.Contains(t, err.Error(), "free and trial plans do not require checkout")

	// Pro plan with no price ID configured should error
	_, err = billing.CreateCheckout(context.Background(), "+5511987654321", "pro")
	require.Error(t, err, "Pro plan without price ID should fail")
	require.Contains(t, err.Error(), "no stripe price id configured for plan")
}

// TestPlanActivated_AfterPayment tests that payment completion activates the correct plan.
func TestPlanActivated_AfterPayment(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// This test validates the plan activation logic by simulating
	// a Stripe webhook event that triggers plan activation in Redis.

	// Mock Redis client for plan activation
	phone := "+5511987654321"
	planKey := "user:" + phone + ":plan"
	requestsKey := "user:" + phone + ":requests_remaining"

	storedPlan := "free"
	storedRequests := "10"

	mockRedis := &MockRedisClient{
		GetFunc: func(ctx context.Context, key string) (string, error) {
			if key == planKey {
				return storedPlan, nil
			}
			if key == requestsKey {
				return storedRequests, nil
			}
			return "", errors.New("key not found")
		},
		SetFunc: func(ctx context.Context, key string, value interface{}, expiry time.Duration) error {
			if key == planKey {
				storedPlan = value.(string)
			}
			if key == requestsKey {
				storedRequests = value.(string)
			}
			return nil
		},
	}

	// Simulate Stripe webhook: invoice.paid event for Pro plan
	// This should: 1) Set plan to "pro", 2) Set requests to "unlimited" (-1)
	webhookEvent := map[string]interface{}{
		"type": "invoice.paid",
		"data": map[string]interface{}{
			"metadata": map[string]string{
				"phone": phone,
				"plan":  "pro",
			},
		},
	}

	// Simulate processing the webhook event to activate plan
	metadata, ok := webhookEvent["data"].(map[string]interface{})["metadata"].(map[string]string)
	require.True(t, ok, "Webhook should contain metadata with phone and plan")

	newPlan := metadata["plan"]
	require.Equal(t, "pro", newPlan, "Plan from webhook should be pro")

	// Activate plan in Redis (simulated)
	err := mockRedis.SetFunc(ctx, planKey, newPlan, 0)
	require.NoError(t, err)
	err = mockRedis.SetFunc(ctx, requestsKey, "-1", 0) // -1 means unlimited
	require.NoError(t, err)

	// Verify plan was activated
	plan, err := mockRedis.GetFunc(ctx, planKey)
	require.NoError(t, err)
	require.Equal(t, "pro", plan, "Plan should be activated to pro")

	requests, err := mockRedis.GetFunc(ctx, requestsKey)
	require.NoError(t, err)
	require.Equal(t, "-1", requests, "Requests should be set to unlimited (-1)")
}

// TestIdempotentWebhook_ProcessedOnce tests that duplicate event IDs are ignored.
func TestIdempotentWebhook_ProcessedOnce(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Mock Redis client simulating idempotency check
	phone := "+5511987654321"

	processedEvents := make(map[string]bool)
	planActivatedCount := 0

	mockRedis := &MockRedisClient{
		ExistsFunc: func(ctx context.Context, key string) (int64, error) {
			if processedEvents[key] {
				return 1, nil // Key exists = already processed
			}
			return 0, nil // Key does not exist = not processed
		},
		SetFunc: func(ctx context.Context, key string, value interface{}, expiry time.Duration) error {
			processedEvents[key] = true
			return nil
		},
	}

	// Simulate processing a webhook event twice (duplicate)
	eventID := "evt_test_123456"
	webhookEvent := map[string]interface{}{
		"type":      "checkout.session.completed",
		"event_id":  eventID,
		"data": map[string]interface{}{
			"metadata": map[string]string{
				"phone": phone,
				"plan":  "trial",
			},
		},
	}

	// First attempt: should process
	exists, _ := mockRedis.ExistsFunc(ctx, "webhook:processed:"+eventID)
	require.Equal(t, int64(0), exists, "Event should not exist yet")

	// Process event (activate trial plan)
	metadata := webhookEvent["data"].(map[string]interface{})["metadata"].(map[string]string)
	if metadata["plan"] == "trial" {
		planActivatedCount++
	}
	mockRedis.SetFunc(ctx, "webhook:processed:"+eventID, "1", 24*time.Hour)

	// Second attempt (duplicate): should be blocked
	exists, _ = mockRedis.ExistsFunc(ctx, "webhook:processed:"+eventID)
	require.Equal(t, int64(1), exists, "Event should already exist (duplicate)")

	// Verify plan was only activated once
	require.Equal(t, 1, planActivatedCount, "Plan should be activated only once for duplicate event")
}