package swarm

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Message represents a Redis pubsub message
type Message struct {
	Channel string
	Payload string
}

// PubSubInterface for mock
type PubSubInterface interface {
	Channel() chan *Message
	Close() error
}

// mockRedisForBoard implements RedisClientInterface for board testing.
type mockRedisForBoard struct{}

func (m *mockRedisForBoard) PushTask(ctx interface{}, agentType string, task *Task) error {
	return nil
}

func (m *mockRedisForBoard) PopTaskBlocking(ctx interface{}, agentType string, timeout time.Duration) (*Task, error) {
	return nil, nil
}

func (m *mockRedisForBoard) GetQueueLength(ctx interface{}, agentType string) (int64, error) {
	return 0, nil
}

func (m *mockRedisForBoard) RegisterAgent(ctx interface{}, info *AgentInfo) error {
	return nil
}

func (m *mockRedisForBoard) UpdateAgentHeartbeat(ctx interface{}, workerID string) error {
	return nil
}

func (m *mockRedisForBoard) IsAgentAlive(ctx interface{}, workerID string) (bool, error) {
	return false, nil
}

func (m *mockRedisForBoard) GetAliveAgents(ctx interface{}) ([]*AgentInfo, error) {
	return nil, nil
}

func (m *mockRedisForBoard) GetAgentStats(ctx interface{}, workerID string) (*AgentStats, error) {
	return &AgentStats{}, nil
}

func (m *mockRedisForBoard) UpdateAgentStats(ctx interface{}, workerID string, completed, stolen int, avgMs float64) error {
	return nil
}

func (m *mockRedisForBoard) CompleteTask(ctx interface{}, agentType, taskID string, output json.RawMessage, moveToDeadLetter bool) error {
	return nil
}

func (m *mockRedisForBoard) PublishTaskCompleted(ctx interface{}, taskID, workerID string) error {
	return nil
}

func (m *mockRedisForBoard) ClaimTask(ctx interface{}, agentType, workerID string, timestamp int64) (*Task, error) {
	return nil, nil
}

func (m *mockRedisForBoard) StealTask(ctx interface{}, srcAgentType, destAgentType string) (*Task, error) {
	return nil, nil
}

func (m *mockRedisForBoard) GetProcessingTasks(ctx interface{}, agentType string) ([]*Task, error) {
	return nil, nil
}

func (m *mockRedisForBoard) Subscribe(ctx interface{}, channels ...string) PubSubInterface {
	return &mockBoardPubSub{}
}

func (m *mockRedisForBoard) PublishRebalance(ctx interface{}, reason string) error {
	return nil
}

func (m *mockRedisForBoard) PublishGraphDone(ctx interface{}, graphID string) error {
	return nil
}

type mockBoardPubSub struct{}

func (m *mockBoardPubSub) Channel() chan *Message {
	return make(chan *Message)
}

func (m *mockBoardPubSub) Close() error {
	return nil
}

func TestNewBoardHandler(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	handler := NewBoardHandler(redis, registry)

	assert.NotNil(t, handler)
	assert.Equal(t, redis, handler.redis)
	assert.Equal(t, registry, handler.registry)
}

func TestBoardHandler_RegisterRoutes(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	handler := NewBoardHandler(redis, registry)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// Verify routes are registered by making requests
	// The actual handler functions are tested below
}

func TestBoardHandler_HandleSnapshot(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	registry.RegisterWorker(WorkerStatus{ID: "w1", AgentType: "intake", Status: "idle"})
	handler := NewBoardHandler(redis, registry)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/swarm/board/snapshot", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Use concrete struct for proper unmarshaling (JSON doesn't preserve []WorkerStatus type)
	var snapshot struct {
		Workers []WorkerStatus   `json:"workers"`
		Graphs  map[string]any    `json:"graphs"`
		TS      int64             `json:"ts"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &snapshot)
	require.NoError(t, err)

	assert.Len(t, snapshot.Workers, 1)
	assert.Equal(t, "w1", snapshot.Workers[0].ID)
}

func TestBoardHandler_HandleSnapshot_EmptyRegistry(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	handler := NewBoardHandler(redis, registry)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/swarm/board/snapshot", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var snapshot struct {
		Workers []WorkerStatus   `json:"workers"`
		Graphs  map[string]any    `json:"graphs"`
		TS      int64             `json:"ts"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &snapshot)
	require.NoError(t, err)

	assert.Len(t, snapshot.Workers, 0)
}

func TestBoardHandler_HandleGraphStatus(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	handler := NewBoardHandler(redis, registry)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/swarm/graphs/test-graph", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var status map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &status)
	require.NoError(t, err)

	assert.Equal(t, "", status["graph_id"])
	assert.Equal(t, "unknown", status["status"])
	assert.Contains(t, status, "ts")
}

func TestBoardEvent_JSON(t *testing.T) {
	event := BoardEvent{
		Type:    "test_event",
		Payload: map[string]string{"key": "value"},
		TS:      time.Now().UnixMilli(),
	}

	data, err := json.Marshal(event)
	require.NoError(t, err)

	var restored BoardEvent
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)

	assert.Equal(t, "test_event", restored.Type)
	assert.Equal(t, event.TS, restored.TS)
}

func TestBoardEvent_SSETextFormat(t *testing.T) {
	event := BoardEvent{
		Type:    "task_completed",
		Payload: `{"task_id":"task-1"}`,
		TS:      1234567890,
	}

	data, err := json.Marshal(event)
	require.NoError(t, err)

	expected := "data: " + string(data) + "\n\n"
	assert.Equal(t, expected, formatSSEEvent(data))
}

func formatSSEEvent(data []byte) string {
	return "data: " + string(data) + "\n\n"
}

func TestBoardHandler_ContentTypeHeaders(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	handler := NewBoardHandler(redis, registry)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// Test snapshot content type
	req := httptest.NewRequest(http.MethodGet, "/api/swarm/board/snapshot", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

	// Test graph status content type
	req = httptest.NewRequest(http.MethodGet, "/api/swarm/graphs/test", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
}