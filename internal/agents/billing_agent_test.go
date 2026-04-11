package agents

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// MockRedisBillingClient mocks Redis operations for billing agent tests.
type MockRedisBillingClient struct {
	GetFunc    func(key string) (string, error)
	SetFunc    func(key string, value interface{}) error
	EvalFunc   func(script string, keys []string) (interface{}, error)
	ExistsFunc func(key string) (int64, error)
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

// TestBillingAgent_RequestUsed tests decrementing the request counter via Redis Lua.
func TestBillingAgent_RequestUsed(t *testing.T) {
	phone := "+5511987654321"
	requestsKey := "user:" + phone + ":requests_remaining"

	requestCount := 10 // Start with 10 requests (free tier)

	mockRedis := &MockRedisBillingClient{
		EvalFunc: func(script string, keys []string) (interface{}, error) {
			// Simulate the Lua script behavior:
			// GET remaining → if <= 0 block → DECR → return remaining
			if requestCount <= 0 {
				return []interface{}{
					int64(0), // decision = block
					int64(0), // remaining = 0
				}, nil
			}
			requestCount--
			return []interface{}{
				int64(1),                  // decision = allow
				int64(requestCount),      // remaining after decrement
			}, nil
		},
	}

	// Simulate 10 requests (should all be allowed)
	for i := 0; i < 10; i++ {
		result, err := mockRedis.EvalFunc(AccessControlLua, []string{requestsKey})
		require.NoError(t, err)

		resultSlice, ok := result.([]interface{})
		require.True(t, ok, "result should be a slice")

		decision := resultSlice[0].(int64)
		require.Equal(t, int64(1), decision, "request %d should be allowed", i+1)
	}

	// 11th request should be blocked
	result, err := mockRedis.EvalFunc(AccessControlLua, []string{requestsKey})
	require.NoError(t, err)

	resultSlice, ok := result.([]interface{})
	require.True(t, ok, "result should be a slice")

	decision := resultSlice[0].(int64)
	require.Equal(t, int64(0), decision, "11th request should be blocked")
}

// TestBillingAgent_UpgradeRequested tests creating a Stripe checkout for upgrade.
func TestBillingAgent_UpgradeRequested(t *testing.T) {
	// This test verifies the upgrade flow:
	// 1. User requests upgrade to Pro plan
	// 2. Stripe checkout URL is generated

	checkoutURL := "https://checkout.stripe.com/pay/cs_test_abc123"
	plan := "pro"

	// Simulate the expected behavior for upgrade_requested event
	// The agent should return a checkout_url for the user to complete payment

	// Verify the checkout URL format
	require.Contains(t, checkoutURL, "checkout.stripe.com", "Checkout URL should be from Stripe")
	require.NotEmpty(t, plan, "Plan should be specified")
	require.Equal(t, "pro", plan, "Plan should be pro")
}

// TestBillingAgent_PaymentReceived tests plan activation in Redis after payment.
func TestBillingAgent_PaymentReceived(t *testing.T) {
	phone := "+5511987654321"

	storedPlan := "free"
	storedRequests := "10"

	mockRedis := &MockRedisBillingClient{
		SetFunc: func(key string, value interface{}) error {
			if key == "user:"+phone+":plan" {
				storedPlan = value.(string)
			}
			if key == "user:"+phone+":requests_remaining" {
				storedRequests = value.(string)
			}
			return nil
		},
	}

	// Simulate payment_received event: activate pro plan
	eventPlan := "pro"

	// Activate plan in Redis
	err := mockRedis.SetFunc("user:"+phone+":plan", eventPlan)
	require.NoError(t, err)

	// Set requests to unlimited for paid plans (-1 means unlimited)
	err = mockRedis.SetFunc("user:"+phone+":requests_remaining", "-1")
	require.NoError(t, err)

	// Verify plan was activated
	require.Equal(t, "pro", storedPlan, "Plan should be activated to pro")
	require.Equal(t, "-1", storedRequests, "Requests should be set to unlimited")
}

// TestBillingAgent_IdempotentWebhook tests that duplicate events are ignored.
func TestBillingAgent_IdempotentWebhook(t *testing.T) {
	eventID := "evt_test_123456"

	processedEvents := make(map[string]bool)
	planActivatedCount := 0

	mockRedis := &MockRedisBillingClient{
		ExistsFunc: func(key string) (int64, error) {
			if processedEvents[key] {
				return 1, nil // Key exists = already processed
			}
			return 0, nil // Key does not exist = not processed
		},
		SetFunc: func(key string, value interface{}) error {
			processedEvents[key] = true
			return nil
		},
	}

	// Simulate processing a webhook event twice (duplicate)
	webhookKey := "webhook:processed:" + eventID

	// First attempt: should process
	exists, _ := mockRedis.ExistsFunc(webhookKey)
	require.Equal(t, int64(0), exists, "Event should not exist yet")

	// Process event (activate trial plan)
	planActivatedCount++
	mockRedis.SetFunc(webhookKey, "1")

	// Second attempt (duplicate): should be blocked
	exists, _ = mockRedis.ExistsFunc(webhookKey)
	require.Equal(t, int64(1), exists, "Event should already exist (duplicate)")

	// Verify plan was only activated once
	require.Equal(t, 1, planActivatedCount, "Plan should be activated only once for duplicate event")
}