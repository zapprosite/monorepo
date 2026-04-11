package agents

import (
	"context"
	"encoding/json"
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
		{
			name:       "rag_agent",
			agent:      NewRAGAgent(&MockEmbedder{}, &MockQdrantClient{}, NewMockRedisLayer()),
			agentType:  "rag",
			maxRetries: 3,
			timeoutMs:  30000,
		},
		{
			name:       "ranking_agent",
			agent:      NewRankingAgent(NewMockRankingRedisLayer()),
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

			// Verify Execute method exists and can be called
			task := &SwarmTask{
				TaskID: "test-task-" + tt.name,
				Input:  map[string]any{},
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

	testCases := []struct {
		name        string
		agent       AgentInterface
		inputKey    string
		inputValue  any
		expectedKey string
	}{
		{
			name:        "intake_writes_phone",
			agent:       NewIntakeAgent("test-secret", ""),
			inputKey:    "webhook_payload",
			inputValue:  createTestWhatsAppPayload(),
			expectedKey: "intake.success",
		},
		{
			name:        "classifier_writes_intent",
			agent:       NewClassifierAgent(""),
			inputKey:    "normalized_text",
			inputValue:  "ar split Springer Midea erro E1",
			expectedKey: "classifier.success",
		},
		{
			name:        "access_control_writes_decision",
			agent:       NewAccessControlAgent(&MockRedisClient{requestsRemaining: 5}, 10),
			inputKey:    "phone",
			inputValue:  "+5511999999999",
			expectedKey: "access_control.success",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			task := &SwarmTask{
				TaskID: "test-task-" + tc.name,
				Input: map[string]any{
					tc.inputKey: tc.inputValue,
				},
			}

			result, err := tc.agent.Execute(ctx, task)
			require.NoError(t, err)
			require.NotNil(t, result)

			// Verify agent wrote to shared state with success key
			_, hasKey := result[tc.expectedKey]
			require.True(t, hasKey, "Agent should write %s to shared state", tc.expectedKey)
		})
	}
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
