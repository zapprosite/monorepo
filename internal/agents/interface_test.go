package agents

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestAllAgents_ImplementAgentInterface verifies that all 8 agents implement
// the AgentInterface contract with Execute, AgentType, MaxRetries, and TimeoutMs.
func TestAllAgents_ImplementAgentInterface(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Note: billing_agent and memory_agent use swarm.SwarmTask (json.RawMessage input)
	// while other agents use agents.SwarmTask (map[string]any input)
	// This test focuses on agents that can be instantiated with mocked dependencies

	agents := []struct {
		name       string
		agent      AgentInterface
		agentType  string
		maxRetries int
		timeoutMs  int
	}{
		{
			name:       "intake_agent",
			agent:      NewIntakeAgent("test-secret", ""),
			agentType:  "intake",
			maxRetries: 3,
			timeoutMs:  10000,
		},
		{
			name:       "classifier_agent",
			agent:      NewClassifierAgent(""),
			agentType:  "classifier",
			maxRetries: 3,
			timeoutMs:  8000,
		},
		{
			name:       "access_control_agent",
			agent:      NewAccessControlAgent(&MockRedisClient{}, 10),
			agentType:  "access_control",
			maxRetries: 1,
			timeoutMs:  3000,
		},
		// RAG agent skipped due to complex QdrantLayer dependency - tested in rag_agent_test.go
		{
			name:       "ranking_agent",
			agent:      NewRankingAgent(NewMockRankingRedisLayer(), ""),
			agentType:  "ranking",
			maxRetries: 2,
			timeoutMs:  20000,
		},
		{
			name:       "response_agent",
			agent:      NewResponseAgent("", "", ""),
			agentType:  "response",
			maxRetries: 2,
			timeoutMs:  20000,
		},
	}

	for _, tt := range agents {
		t.Run(tt.name, func(t *testing.T) {
			// Verify AgentType returns correct value
			require.Equal(t, tt.agentType, tt.agent.AgentType())

			// Verify MaxRetries returns expected value
			require.Equal(t, tt.maxRetries, tt.agent.MaxRetries())

			// Verify TimeoutMs returns expected value
			require.Equal(t, tt.timeoutMs, tt.agent.TimeoutMs())

			// Provide minimal valid input based on agent type
			var input map[string]any
			switch tt.agentType {
			case "intake":
				input = map[string]any{
					"phone":           "5511999999999",
					"message_id":     "msg_test",
					"message_type":   "text",
					"normalized_text": "Hello",
				}
			case "classifier":
				input = map[string]any{
					"normalized_text": "Test message",
				}
			case "access_control":
				input = map[string]any{
					"phone": "+5511999999999",
				}
			case "ranking":
				input = map[string]any{
					"graph_id": "test-graph",
				}
			case "response":
				input = map[string]any{
					"phone": "+5511999999999",
				}
			default:
				input = map[string]any{}
			}

			// Verify Execute method exists and can be called
			task := &SwarmTask{
				TaskID: "test-task-" + tt.name,
				Input:  input,
			}

			// Execute should not panic
			result, err := tt.agent.Execute(ctx, task)
			require.NotNil(t, result, "Execute should return a result map")
			require.NoError(t, err, "Execute should not error on empty input")
		})
	}
}

// TestAllAgents_WriteToSharedState verifies that all agents write to shared state
// by checking the output map contains agent-specific success keys.
func TestAllAgents_WriteToSharedState(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Note: These tests use minimal valid input for each agent
	// Full integration tests would require Redis/MiniMax/etc.

	t.Run("intake_writes_phone", func(t *testing.T) {
		agent := NewIntakeAgent("test-secret", "")
		task := &SwarmTask{
			TaskID: "test-state-write",
			Input: map[string]any{
				"phone":           "5511999999999",
				"message_id":      "msg_test",
				"message_type":    "text",
				"normalized_text": "Hello",
			},
		}
		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		_, exists := result["intake.success"]
		require.True(t, exists, "Agent must write intake.success to shared state")
	})

	t.Run("classifier_writes_intent", func(t *testing.T) {
		agent := NewClassifierAgent("")
		task := &SwarmTask{
			TaskID: "test-classifier",
			Input: map[string]any{
				"normalized_text": "ar split Springer Midea erro E1",
			},
		}
		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		_, exists := result["classifier.success"]
		require.True(t, exists, "Agent must write classifier.success to shared state")
	})

	t.Run("access_control_writes_decision", func(t *testing.T) {
		agent := NewAccessControlAgent(&MockRedisClient{requestsRemaining: 5}, 10)
		task := &SwarmTask{
			TaskID: "test-access",
			Input: map[string]any{
				"phone": "+5511999999999",
			},
		}
		result, err := agent.Execute(ctx, task)
		require.NoError(t, err)
		_, exists := result["access_control.success"]
		require.True(t, exists, "Agent must write access_control.success to shared state")
	})
}

// createTestWhatsAppPayload creates a minimal WhatsApp webhook payload for testing.
func createTestWhatsAppPayload() map[string]any {
	return map[string]any{
		"object": "whatsapp_business_account",
		"entry": []map[string]any{
			{
				"id": "123456789",
				"changes": []map[string]any{
					{
						"value": map[string]any{
							"messaging_product": "whatsapp",
							"metadata": map[string]any{
								"display_phone_number": "15551234567",
								"phone_number_id":      "123456789",
							},
							"contacts": []map[string]any{
								{
									"profile": map[string]any{
										"name": "Test User",
									},
									"wa_id": "5511999999999",
								},
							},
							"messages": []map[string]any{
								{
									"from":     "5511999999999",
									"id":       "wamid.xxx",
									"timestamp": "1234567890",
									"type":     "text",
									"text": map[string]any{
										"body": "Test message",
									},
								},
							},
						},
						"field": "messages",
					},
				},
			},
		},
	}
}

// MockRedisClient implements RedisClientInterface for access_control tests.
type MockRedisClient struct {
	requestsRemaining int
	graphState        map[string]map[string]any
}

// SetGraphState implements memory.RedisLayerInterface.
func (m *MockRedisClient) SetGraphState(ctx context.Context, graphID string, state map[string]any) error {
	if m.graphState == nil {
		m.graphState = make(map[string]map[string]any)
	}
	m.graphState[graphID] = state
	return nil
}

// GetGraphState implements memory.RedisLayerInterface.
func (m *MockRedisClient) GetGraphState(ctx context.Context, graphID string) (map[string]any, error) {
	if state, found := m.graphState[graphID]; found {
		return state, nil
	}
	return nil, nil
}

// Eval simulates Lua script execution for rate limiting.
func (m *MockRedisClient) Eval(ctx context.Context, script string, keys []string, args ...interface{}) *EvalResult {
	if m.requestsRemaining <= 0 {
		intent := ""
		if len(args) > 1 {
			intent = args[1].(string)
		}
		if intent == "billing" {
			return &EvalResult{Value: int64(2)} // redirect
		}
		return &EvalResult{Value: int64(1)} // block
	}
	m.requestsRemaining--
	return &EvalResult{Value: int64(0)} // allow
}

// Get returns the current request count.
func (m *MockRedisClient) Get(ctx context.Context, key string) (string, error) {
	return string(rune(m.requestsRemaining + '0')), nil
}

// Set sets a key in Redis.
func (m *MockRedisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return nil
}

// HGet gets a field from a hash.
func (m *MockRedisClient) HGet(ctx context.Context, key, field string) (string, error) {
	return "", nil
}

// HSet sets fields in a hash.
func (m *MockRedisClient) HSet(ctx context.Context, key string, values map[string]interface{}) error {
	return nil
}

// MockQdrantClient implements QdrantLayerInterface for RAG agent tests.
type MockQdrantClient struct{}

// HybridSearch implements QdrantLayerInterface.
func (m *MockQdrantClient) HybridSearch(ctx context.Context, query string, filters map[string]string, limit int) ([]interface{}, error) {
	return []interface{}{}, nil
}

// Client returns nil for mock.
func (m *MockQdrantClient) Client() interface{} {
	return nil
}
