package agents

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestAccessControlAgent_Decision tests the access control decision logic.
func TestAccessControlAgent_Decision(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	t.Run("allows_request_when_remaining", func(t *testing.T) {
		mockRedis := &MockAccessControlRedis{
			requestsRemaining: 5,
		}
		agent := NewAccessControlAgent(mockRedis, 10)

		task := &SwarmTask{
			TaskID: "test-access-allow",
			Input: map[string]any{
				"phone": "+5511999999999",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.NotNil(t, result)

		require.Equal(t, string(AccessAllow), result["decision"])
		require.True(t, result["access_control.success"].(bool))
	})

	t.Run("blocks_request_when_exhausted", func(t *testing.T) {
		mockRedis := &MockAccessControlRedis{
			requestsRemaining: 0,
		}
		agent := NewAccessControlAgent(mockRedis, 10)

		task := &SwarmTask{
			TaskID: "test-access-block",
			Input: map[string]any{
				"phone": "+5511999999999",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		require.Equal(t, string(AccessBlock), result["decision"])
		require.Equal(t, "rate_limit_exceeded", result["block_reason"])
		require.Equal(t, 60, result["retry_after_seconds"])
	})

	t.Run("redirects_billing_intent", func(t *testing.T) {
		mockRedis := &MockAccessControlRedis{
			requestsRemaining: 0,
		}
		agent := NewAccessControlAgent(mockRedis, 10)

		task := &SwarmTask{
			TaskID: "test-access-redirect",
			Input: map[string]any{
				"phone":  "+5511999999999",
				"intent": "billing",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		require.Equal(t, string(AccessRedirect), result["decision"])
		require.Contains(t, result["redirect_url"], "/billing")
		require.Equal(t, "billing_intent", result["redirect_reason"])
	})

	t.Run("decrements_counter", func(t *testing.T) {
		mockRedis := &MockAccessControlRedis{
			requestsRemaining: 5,
		}
		agent := NewAccessControlAgent(mockRedis, 10)

		task := &SwarmTask{
			TaskID: "test-access-decrement",
			Input: map[string]any{
				"phone": "+5511999999999",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		// Counter should be decremented
		remaining := result["requests_remaining"].(int)
		require.Less(t, remaining, 5)
	})

	t.Run("fails_open_on_redis_error", func(t *testing.T) {
		mockRedis := &MockAccessControlRedis{
			shouldError: true,
		}
		agent := NewAccessControlAgent(mockRedis, 10)

		task := &SwarmTask{
			TaskID: "test-access-failopen",
			Input: map[string]any{
				"phone": "+5511999999999",
			},
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		// Should fail open (allow) but mark success as false
		require.Equal(t, string(AccessAllow), result["decision"])
		require.False(t, result["access_control.success"].(bool))
		require.NotEmpty(t, result["access_control.error"])
	})

	t.Run("missing_phone_error", func(t *testing.T) {
		mockRedis := &MockAccessControlRedis{}
		agent := NewAccessControlAgent(mockRedis, 10)

		task := &SwarmTask{
			TaskID: "test-access-nophone",
			Input:  map[string]any{},
		}

		_, err := agent.Execute(ctx, task)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing phone")
	})
}

// TestAccessControlAgent_StateWriting verifies access_control writes to shared state.
func TestAccessControlAgent_StateWriting(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRedis := &MockAccessControlRedis{
		requestsRemaining: 5,
	}
	agent := NewAccessControlAgent(mockRedis, 10)

	task := &SwarmTask{
		TaskID: "test-access-state",
		Input: map[string]any{
			"phone": "+5511999999999",
		},
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	// Required fields
	requiredKeys := []string{
		"decision",
		"requests_remaining",
		"access_control.success",
	}

	for _, key := range requiredKeys {
		_, exists := result[key]
		require.True(t, exists, "Agent must write %s to shared state", key)
	}
}

// MockAccessControlRedis implements RedisClientInterface for access_control tests.
type MockAccessControlRedis struct {
	requestsRemaining int
	shouldError       bool
	stats             map[string]string
}

// SetGraphState implements memory.RedisLayerInterface (for compatibility).
func (m *MockAccessControlRedis) SetGraphState(ctx context.Context, graphID string, state map[string]any) error {
	return nil
}

// GetGraphState implements memory.RedisLayerInterface.
func (m *MockAccessControlRedis) GetGraphState(ctx context.Context, graphID string) (map[string]any, error) {
	return nil, nil
}

// Eval simulates Lua script execution for rate limiting.
func (m *MockAccessControlRedis) Eval(ctx context.Context, script string, keys []string, args ...interface{}) *EvalResult {
	if m.shouldError {
		return &EvalResult{Err: context.DeadlineExceeded}
	}

	if m.requestsRemaining <= 0 {
		intent := args[1].(string)
		if intent == "billing" {
			return &EvalResult{Value: int64(2)} // redirect
		}
		return &EvalResult{Value: int64(1)} // block
	}

	m.requestsRemaining--
	return &EvalResult{Value: int64(0)} // allow
}

// Get returns the current request count.
func (m *MockAccessControlRedis) Get(ctx context.Context, key string) (string, error) {
	if m.shouldError {
		return "", context.DeadlineExceeded
	}
	return string(rune(m.requestsRemaining + '0')), nil
}

// Set sets a key in Redis.
func (m *MockAccessControlRedis) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return nil
}

// HGet gets a field from a hash.
func (m *MockAccessControlRedis) HGet(ctx context.Context, key, field string) (string, error) {
	if m.stats == nil {
		return "", nil
	}
	return m.stats[field], nil
}

// HSet sets fields in a hash.
func (m *MockAccessControlRedis) HSet(ctx context.Context, key string, values map[string]interface{}) error {
	if m.stats == nil {
		m.stats = make(map[string]string)
	}
	for k, v := range values {
		m.stats[k] = v.(string)
	}
	return nil
}
