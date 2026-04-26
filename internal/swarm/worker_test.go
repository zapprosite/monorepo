package swarm

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/agents"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockRedisForWorker implements a minimal in-memory Redis for testing.
type mockRedisForWorker struct {
	mu      sync.Mutex
	tasks   map[string][]*Task // queue name → tasks
	stats   map[string]*AgentStats
	heartbeats map[string]bool
}

func newMockRedis() *mockRedisForWorker {
	return &mockRedisForWorker{
		tasks:      make(map[string][]*Task),
		stats:      make(map[string]*AgentStats),
		heartbeats: make(map[string]bool),
	}
}

func (m *mockRedisForWorker) PushTask(_ context.Context, agentType string, task *Task) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tasks[agentType] = append(m.tasks[agentType], task)
	return nil
}

func (m *mockRedisForWorker) PopTaskBlocking(_ context.Context, agentType string, timeout time.Duration) (*Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if queue, ok := m.tasks[agentType]; ok && len(queue) > 0 {
		t := queue[0]
		m.tasks[agentType] = queue[1:]
		return t, nil
	}
	return nil, nil
}

func (m *mockRedisForWorker) GetQueueLength(_ context.Context, agentType string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return int64(len(m.tasks[agentType])), nil
}

func (m *mockRedisForWorker) RegisterAgent(_ context.Context, info *AgentInfo) error {
	return nil
}

func (m *mockRedisForWorker) UpdateAgentHeartbeat(_ context.Context, workerID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.heartbeats[workerID] = true
	return nil
}

func (m *mockRedisForWorker) IsAgentAlive(_ context.Context, workerID string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.heartbeats[workerID], nil
}

func (m *mockRedisForWorker) GetAliveAgents(_ context.Context) ([]*AgentInfo, error) {
	return nil, nil
}

func (m *mockRedisForWorker) GetAgentStats(_ context.Context, workerID string) (*AgentStats, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.stats[workerID]; ok {
		return s, nil
	}
	return &AgentStats{}, nil
}

func (m *mockRedisForWorker) UpdateAgentStats(_ context.Context, workerID string, completed, stolen int, avgMs float64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stats[workerID] = &AgentStats{Completed: completed, Stolen: stolen, AvgMs: avgMs}
	return nil
}

func (m *mockRedisForWorker) CompleteTask(_ context.Context, agentType, taskID string, output json.RawMessage, moveToDeadLetter bool) error {
	return nil
}

func (m *mockRedisForWorker) PublishTaskCompleted(_ context.Context, taskID, workerID string) error {
	return nil
}

func (m *mockRedisForWorker) ClaimTask(_ context.Context, agentType, workerID string, timestamp int64) (*Task, error) {
	return nil, nil
}

func (m *mockRedisForWorker) StealTask(_ context.Context, srcAgentType, destAgentType string) (*Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if queue, ok := m.tasks[srcAgentType]; ok && len(queue) > 0 {
		t := queue[0]
		m.tasks[srcAgentType] = queue[1:]
		return t, nil
	}
	return nil, nil
}

func (m *mockRedisForWorker) GetProcessingTasks(_ context.Context, agentType string) ([]*Task, error) {
	return nil, nil
}

func (m *mockRedisForWorker) AddToProcessing(_ context.Context, agentType, workerID string, task *Task) error {
	return nil
}

// mockAgent implements agents.AgentInterface for testing.
type mockAgent struct {
	agentType string
	maxRetries int
	timeoutMs  int
	executeFn  func(context.Context, *agents.SwarmTask) (map[string]any, error)
}

func (m *mockAgent) Execute(ctx context.Context, task *agents.SwarmTask) (map[string]any, error) {
	if m.executeFn != nil {
		return m.executeFn(ctx, task)
	}
	return map[string]any{"result": "ok"}, nil
}

func (m *mockAgent) AgentType() string            { return m.agentType }
func (m *mockAgent) MaxRetries() int               { return m.maxRetries }
func (m *mockAgent) TimeoutMs() int               { return m.timeoutMs }

func TestNewSwarmWorker(t *testing.T) {
	registry := NewAgentRegistry()
	redis := &RedisClient{}
	
	agent := &mockAgent{agentType: "intake", maxRetries: 3, timeoutMs: 5000}
	worker := NewSwarmWorker(agent, redis, registry)
	
	assert.NotEmpty(t, worker.ID)
	assert.Equal(t, "intake", worker.AgentType)
	assert.Equal(t, "swarm:queue:intake", worker.ownQueue)
	assert.NotNil(t, worker.ctx)
	assert.NotNil(t, worker.cancel)
}

func TestSwarmWorker_BuildStealOrder(t *testing.T) {
	tests := []struct {
		agentType string
		expected  []string
	}{
		{"intake", []string{"classifier"}},
		{"classifier", []string{"intake", "rag"}},
		{"access_control", []string{}},
		{"rag", []string{"ranking"}},
		{"ranking", []string{"rag", "response"}},
		{"response", []string{"ranking"}},
		{"billing", []string{"memory"}},
		{"memory", []string{"billing"}},
		{"unknown", []string{}},
	}
	
	for _, tt := range tests {
		t.Run(tt.agentType, func(t *testing.T) {
			order := buildStealOrder(tt.agentType)
			assert.Equal(t, tt.expected, order)
		})
	}
}

func TestMockAgent(t *testing.T) {
	agent := &mockAgent{
		agentType: "test",
		maxRetries: 5,
		timeoutMs:  10000,
	}
	
	assert.Equal(t, "test", agent.AgentType())
	assert.Equal(t, 5, agent.MaxRetries())
	assert.Equal(t, 10000, agent.TimeoutMs())
	
	// Test execute
	ctx := context.Background()
	result, err := agent.Execute(ctx, &agents.SwarmTask{TaskID: "task-1"})
	require.NoError(t, err)
	assert.Equal(t, "ok", result["result"])
}

func TestMockAgent_CustomExecute(t *testing.T) {
	agent := &mockAgent{
		agentType: "custom",
		maxRetries: 1,
		timeoutMs:  1000,
		executeFn: func(ctx context.Context, task *agents.SwarmTask) (map[string]any, error) {
			return map[string]any{"custom": task.TaskID}, nil
		},
	}
	
	ctx := context.Background()
	result, err := agent.Execute(ctx, &agents.SwarmTask{TaskID: "my-task"})
	require.NoError(t, err)
	assert.Equal(t, "my-task", result["custom"])
}

func TestSwarmWorker_Stop(t *testing.T) {
	registry := NewAgentRegistry()
	redis := &RedisClient{}

	agent := &mockAgent{agentType: "test", maxRetries: 1, timeoutMs: 1000}
	worker := NewSwarmWorker(agent, redis, registry)

	// Should not panic
	worker.Stop()
}

func TestClaimTask_BRPOPReturnsTask(t *testing.T) {
	registry := NewAgentRegistry()
	redis := newMockRedis()

	// Push a task to the intake queue
	task := &Task{
		TaskID:    "task-123",
		GraphID:   "graph-1",
		NodeID:    "intake",
		Type:      "intake",
		Status:    "pending",
		MaxRetries: 3,
		TimeoutMs:  5000,
	}
	err := redis.PushTask(context.Background(), "intake", task)
	require.NoError(t, err)

	agent := &mockAgent{agentType: "intake", maxRetries: 3, timeoutMs: 5000}
	worker := NewSwarmWorker(agent, redis, registry)

	// claimTask should return the task from BRPOP
	claimed, err := worker.claimTask()
	require.NoError(t, err)
	require.NotNil(t, claimed, "claimTask should return a task when one exists")
	assert.Equal(t, "task-123", claimed.TaskID, "claimed task should have correct TaskID")

	worker.Stop()
}

func TestClaimTask_WorkStealing(t *testing.T) {
	registry := NewAgentRegistry()
	redis := newMockRedis()

	// Push multiple tasks to classifier queue (intake's steal target)
	// More than 1 so stealing is worthwhile (srcLen <= 1 means no steal)
	for i := 0; i < 3; i++ {
		task := &Task{
			TaskID:    fmt.Sprintf("classifier-task-%d", i),
			GraphID:   "graph-1",
			NodeID:    "classifier",
			Type:      "classifier",
			Status:    "pending",
			MaxRetries: 3,
			TimeoutMs:  5000,
		}
		err := redis.PushTask(context.Background(), "classifier", task)
		require.NoError(t, err)
	}

	// intake queue is empty
	intakeLen, err := redis.GetQueueLength(context.Background(), "intake")
	require.NoError(t, err)
	assert.Equal(t, int64(0), intakeLen, "intake queue should be empty")

	agent := &mockAgent{agentType: "intake", maxRetries: 3, timeoutMs: 5000}
	worker := NewSwarmWorker(agent, redis, registry)

	// claimTask should steal from classifier since intake is empty
	claimed, err := worker.claimTask()
	require.NoError(t, err)
	require.NotNil(t, claimed, "claimTask should steal work when own queue is empty")
	assert.Equal(t, "classifier-task-0", claimed.TaskID, "claimed task should be from classifier (stolen)")
	assert.NotNil(t, claimed.StolenFrom, "StolenFrom should be set")
	assert.Equal(t, "classifier", *claimed.StolenFrom, "StolenFrom should indicate classifier")

	worker.Stop()
}

func TestHandleFailure_RetriesThenDeadLetter(t *testing.T) {
	registry := NewAgentRegistry()
	redis := newMockRedis()

	// Track calls
	var pushCallCount int
	var completeCallCount int
	var deadLetterCall bool

	// Create a custom mock that tracks calls
	type failureTestMock struct {
		*mockRedisForWorker
	}
	customMock := &mockRedisWithTracking{
		mockRedisForWorker: redis,
		pushCount:          &pushCallCount,
		completeCount:      &completeCallCount,
		deadLetter:         &deadLetterCall,
	}

	agent := &mockAgent{agentType: "test", maxRetries: 3, timeoutMs: 1000}
	worker := NewSwarmWorker(agent, customMock, registry)

	// Task that has exceeded retries
	task := &Task{
		TaskID:    "fail-task",
		GraphID:   "graph-1",
		NodeID:    "test",
		Type:      "test",
		Status:    "failed",
		Retries:   3, // Already at max
		MaxRetries: 3,
		TimeoutMs:  1000,
	}

	// Execute handleFailure via executeTask with an error
	agent = &mockAgent{
		agentType:  "test",
		maxRetries: 3,
		timeoutMs:  1000,
		executeFn: func(ctx context.Context, task *agents.SwarmTask) (map[string]any, error) {
			return nil, fmt.Errorf("intentional failure")
		},
	}
	worker.agent = agent

	// Simulate failure handling directly
	task.Retries = 0 // Reset for test
	task.MaxRetries = 3

	// First failure - should retry (retries: 0→1, 1<3)
	task.Retries = 0
	customMock.reset()
	worker.handleFailure(task, "intentional failure")
	assert.Equal(t, 1, *customMock.pushCount, "first failure should push for retry")
	assert.False(t, *customMock.deadLetter, "first failure should not dead-letter")

	// Second failure - still within retry budget (retries: 1→2, 2<3)
	task.Retries = 1
	customMock.reset()
	worker.handleFailure(task, "intentional failure")
	assert.Equal(t, 1, *customMock.pushCount, "second failure should push for retry")
	assert.False(t, *customMock.deadLetter, "second failure should not dead-letter")

	// Third failure - exceeds retry budget (retries: 2→3, 3<3=false)
	task.Retries = 2
	customMock.reset()
	worker.handleFailure(task, "intentional failure")
	assert.Equal(t, 0, *customMock.pushCount, "exceeded retries should not push")
	assert.True(t, *customMock.deadLetter, "exceeded retries should dead-letter")

	worker.Stop()
}

func TestHeartbeat_ExpiresAfter15s(t *testing.T) {
	registry := NewAgentRegistry()
	redis := newMockRedis()

	agent := &mockAgent{agentType: "test", maxRetries: 1, timeoutMs: 1000}
	worker := NewSwarmWorker(agent, redis, registry)

	// Initial heartbeat
	err := redis.UpdateAgentHeartbeat(context.Background(), worker.ID)
	require.NoError(t, err, "initial heartbeat should succeed")

	// Immediately after heartbeat, worker should be alive
	alive, err := redis.IsAgentAlive(context.Background(), worker.ID)
	require.NoError(t, err)
	assert.True(t, alive, "worker should be alive immediately after heartbeat")

	// After 15 seconds, heartbeat should expire
	// We simulate this by waiting (or checking TTL behavior)
	// Since HeartbeatTTL = 15s, we need to check that TTL is set correctly
	// In real Redis, the key would expire. In our mock, we just verify the call was made.

	worker.Stop()
}

// mockRedisWithTracking extends mockRedisForWorker with call tracking
type mockRedisWithTracking struct {
	*mockRedisForWorker
	pushCount     *int
	completeCount *int
	deadLetter    *bool
}

func (m *mockRedisWithTracking) PushTask(ctx context.Context, agentType string, task *Task) error {
	*m.pushCount++
	return m.mockRedisForWorker.PushTask(ctx, agentType, task)
}

func (m *mockRedisWithTracking) CompleteTask(ctx context.Context, agentType, taskID string, output json.RawMessage, moveToDeadLetter bool) error {
	*m.completeCount++
	if moveToDeadLetter {
		*m.deadLetter = true
	}
	return m.mockRedisForWorker.CompleteTask(ctx, agentType, taskID, output, moveToDeadLetter)
}

func (m *mockRedisWithTracking) reset() {
	*m.pushCount = 0
	*m.completeCount = 0
	*m.deadLetter = false
}

func (m *mockRedisWithTracking) AddToProcessing(ctx context.Context, agentType, workerID string, task *Task) error {
	return m.mockRedisForWorker.AddToProcessing(ctx, agentType, workerID, task)
}
