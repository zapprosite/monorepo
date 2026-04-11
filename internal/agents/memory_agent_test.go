package agents

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestMemoryAgent_PersistConversation tests LPUSH + LTRIM 0 19 behavior.
func TestMemoryAgent_PersistConversation(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	t.Run("LPUSH_and_LTRIM_0_19", func(t *testing.T) {
		mockRedis := &MockMemoryRedis{
			lists: make(map[string][]string),
		}
		agent := NewMemoryAgent(mockRedis, "")

		messages := []string{
			"Message 1",
			"Message 2",
			"Message 3",
			"Message 4",
			"Message 5",
		}

		inputJSON, _ := json.Marshal(map[string]any{
			"phone":    "+5511999999999",
			"messages": messages,
		})

		task := &SwarmTask{
			TaskID: "test-memory-persist",
			Input:  inputJSON,
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.NotNil(t, result)

		// Verify LTRIM 0 19 was applied (only 5 messages kept)
		key := "conversation:+5511999999999"
		require.Contains(t, mockRedis.lists, key)

		// Verify LTRIM kept at most 20 items
		list := mockRedis.lists[key]
		require.LessOrEqual(t, len(list), 20, "LTRIM should keep at most 20 items")

		// Verify persisted_count
		require.Equal(t, len(messages), result["memory.persisted"])

		// Verify success
		require.True(t, result["memory.success"].(bool))
	})

	t.Run("maintains_last_20_messages", func(t *testing.T) {
		mockRedis := &MockMemoryRedis{
			lists: make(map[string][]string),
		}
		agent := NewMemoryAgent(mockRedis, "")

		// 25 messages - should only keep 20 after LTRIM
		messages := make([]string, 25)
		for i := 0; i < 25; i++ {
			messages[i] = "Message"
		}

		inputJSON, _ := json.Marshal(map[string]any{
			"phone":    "+5511999999999",
			"messages": messages,
		})

		task := &SwarmTask{
			TaskID: "test-memory-trim",
			Input:  inputJSON,
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)

		// Should only keep 20
		key := "conversation:+5511999999999"
		require.LessOrEqual(t, len(mockRedis.lists[key]), 20)
	})

	t.Run("missing_phone_error", func(t *testing.T) {
		mockRedis := &MockMemoryRedis{}
		agent := NewMemoryAgent(mockRedis, "")

		inputJSON, _ := json.Marshal(map[string]any{
			"messages": []string{"Hello"},
		})

		task := &SwarmTask{
			TaskID: "test-memory-nophone",
			Input:  inputJSON,
		}

		_, err := agent.Execute(ctx, task)
		require.Error(t, err)
	})

	t.Run("empty_messages_ok", func(t *testing.T) {
		mockRedis := &MockMemoryRedis{}
		agent := NewMemoryAgent(mockRedis, "")

		inputJSON, _ := json.Marshal(map[string]any{
			"phone":    "+5511999999999",
			"messages": []string{},
		})

		task := &SwarmTask{
			TaskID: "test-memory-empty",
			Input:  inputJSON,
		}

		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		require.Equal(t, 0, result["memory.persisted"])
	})
}

// TestMemoryAgent_StateWriting verifies memory_agent writes to shared state.
func TestMemoryAgent_StateWriting(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRedis := &MockMemoryRedis{
		lists: make(map[string][]string),
	}
	agent := NewMemoryAgent(mockRedis, "")

	inputJSON, _ := json.Marshal(map[string]any{
		"phone":    "+5511999999999",
		"messages": []string{"Test message"},
	})

	task := &SwarmTask{
		TaskID: "test-memory-state",
		Input:  inputJSON,
	}

	result, err := agent.Execute(ctx, task)
	require.NoError(t, err)

	// Required fields
	requiredKeys := []string{
		"memory.success",
		"memory.persisted",
		"memory.facts_extracted",
		"memory.conversation_len",
	}

	for _, key := range requiredKeys {
		_, exists := result[key]
		require.True(t, exists, "Agent must write %s to shared state", key)
	}
}

// MockMemoryRedis implements MemoryRedisInterface for testing.
type MockMemoryRedis struct {
	lists map[string][]string
}

// LPush adds elements to the head of the list.
func (m *MockMemoryRedis) LPush(ctx context.Context, key string, values ...interface{}) error {
	if m.lists == nil {
		m.lists = make(map[string][]string)
	}
	for _, v := range values {
		m.lists[key] = append([]string{v.(string)}, m.lists[key]...)
	}
	return nil
}

// LTrim trims the list to the specified range.
func (m *MockMemoryRedis) LTrim(ctx context.Context, key string, start, stop int64) error {
	if list, ok := m.lists[key]; ok {
		if stop >= 0 && int(stop) < len(list) {
			m.lists[key] = list[start : stop+1]
		}
	}
	return nil
}

// LRange retrieves elements in the list.
func (m *MockMemoryRedis) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	if list, ok := m.lists[key]; ok {
		return list, nil
	}
	return []string{}, nil
}

// HSet sets hash fields.
func (m *MockMemoryRedis) HSet(ctx context.Context, key string, values map[string]interface{}) error {
	return nil
}

// HGetAll gets all hash fields.
func (m *MockMemoryRedis) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return map[string]string{}, nil
}

// Incr increments a counter.
func (m *MockMemoryRedis) Incr(ctx context.Context, key string) (int64, error) {
	return 0, nil
}

// Expire sets expiry on a key.
func (m *MockMemoryRedis) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return nil
}

// Publish publishes a message to a channel.
func (m *MockMemoryRedis) Publish(ctx context.Context, channel string, message interface{}) error {
	return nil
}

// SAdd adds members to a set.
func (m *MockMemoryRedis) SAdd(ctx context.Context, key string, members ...interface{}) error {
	return nil
}

// SMembers returns all members of a set.
func (m *MockMemoryRedis) SMembers(ctx context.Context, key string) ([]string, error) {
	return []string{}, nil
}
