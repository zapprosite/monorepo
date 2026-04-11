package swarm

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockRedisForController implements RedisClientInterface for controller testing.
type mockRedisForController struct {
	mu          sync.Mutex
	tasks       map[string][]*Task
	aliveAgents map[string]*AgentInfo
}

func newMockRedisForController() *mockRedisForController {
	return &mockRedisForController{
		tasks:       make(map[string][]*Task),
		aliveAgents: make(map[string]*AgentInfo),
	}
}

func (m *mockRedisForController) PushTask(_ context.Context, agentType string, task *Task) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tasks[agentType] = append(m.tasks[agentType], task)
	return nil
}

func (m *mockRedisForController) PopTaskBlocking(_ context.Context, agentType string, timeout time.Duration) (*Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if queue, ok := m.tasks[agentType]; ok && len(queue) > 0 {
		t := queue[0]
		m.tasks[agentType] = queue[1:]
		return t, nil
	}
	return nil, nil
}

func (m *mockRedisForController) GetQueueLength(_ context.Context, agentType string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return int64(len(m.tasks[agentType])), nil
}

func (m *mockRedisForController) RegisterAgent(_ context.Context, info *AgentInfo) error {
	return nil
}

func (m *mockRedisForController) UpdateAgentHeartbeat(_ context.Context, workerID string) error {
	return nil
}

func (m *mockRedisForController) IsAgentAlive(_ context.Context, workerID string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.aliveAgents[workerID]
	return ok, nil
}

func (m *mockRedisForController) GetAliveAgents(_ context.Context) ([]*AgentInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []*AgentInfo
	for _, info := range m.aliveAgents {
		result = append(result, info)
	}
	return result, nil
}

func (m *mockRedisForController) GetAgentStats(_ context.Context, workerID string) (*AgentStats, error) {
	return &AgentStats{}, nil
}

func (m *mockRedisForController) UpdateAgentStats(_ context.Context, workerID string, completed, stolen int, avgMs float64) error {
	return nil
}

func (m *mockRedisForController) CompleteTask(_ context.Context, agentType, taskID string, output json.RawMessage, moveToDeadLetter bool) error {
	return nil
}

func (m *mockRedisForController) PublishTaskCompleted(_ context.Context, taskID, workerID string) error {
	return nil
}

func (m *mockRedisForController) ClaimTask(_ context.Context, agentType, workerID string, timestamp int64) (*Task, error) {
	return nil, nil
}

func (m *mockRedisForController) StealTask(_ context.Context, srcAgentType, destAgentType string) (*Task, error) {
	return nil, nil
}

func (m *mockRedisForController) GetProcessingTasks(_ context.Context, agentType string) ([]*Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.tasks[agentType], nil
}

func (m *mockRedisForController) Subscribe(_ context.Context, channels ...string) PubSubInterface {
	return &mockPubSub{}
}

func (m *mockRedisForController) PublishRebalance(_ context.Context, reason string) error {
	return nil
}

func (m *mockRedisForController) PublishGraphDone(_ context.Context, graphID string) error {
	return nil
}

// mockPubSub implements PubSubInterface for testing.
type mockPubSub struct{}

func (m *mockPubSub) Channel() chan *Message {
	return make(chan *Message)
}

func (m *mockPubSub) Close() error {
	return nil
}

// Ensure interfaces are satisfied
var _ RedisClientInterface = (*mockRedisForController)(nil)
var _ PubSubInterface = (*mockPubSub)(nil)

func TestNewSwarmController(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	assert.NotEmpty(t, ctrl.ID)
	assert.Equal(t, redis, ctrl.redis)
	assert.Equal(t, registry, ctrl.registry)
	assert.NotNil(t, ctrl.ctx)
	assert.NotNil(t, ctrl.cancel)
	assert.Equal(t, 10*time.Millisecond, ctrl.schedulerTick)
	assert.Equal(t, 10*time.Second, ctrl.orphanTick)
}

func TestSwarmController_RegisterGraph(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	g := NewExecutionGraph("test-graph")
	ctrl.RegisterGraph(g)

	got, ok := ctrl.GetGraph("test-graph")
	require.True(t, ok, "graph should be registered")
	assert.Equal(t, "test-graph", got.ID)
}

func TestSwarmController_GetGraph_NotFound(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	_, ok := ctrl.GetGraph("nonexistent")
	assert.False(t, ok)
}

func TestSwarmController_EnqueueNode(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	mock := newMockRedisForController()
	ctrl.redis = mock

	g := NewExecutionGraph("graph-1")
	node := &GraphNode{ID: "intake", AgentType: "intake", Status: NodeStatusPending}
	g.AddNode(node)
	ctrl.RegisterGraph(g)

	err := ctrl.enqueueNode("graph-1", node)
	require.NoError(t, err)

	mock.mu.Lock()
	tasks := mock.tasks["intake"]
	mock.mu.Unlock()
	require.Len(t, tasks, 1, "should have 1 task in intake queue")
	assert.Equal(t, "graph-1-intake", tasks[0].TaskID)
	assert.Equal(t, "intake", tasks[0].Type)
}

func TestSwarmController_EnqueueNode_SetsCorrectTaskFields(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	mock := newMockRedisForController()
	ctrl.redis = mock

	g := NewExecutionGraph("graph-x")
	node := &GraphNode{
		ID:         "classifier",
		AgentType:  "classifier",
		Status:     NodeStatusPending,
		MaxRetries: 5,
		Timeout:    Duration{10 * time.Second},
	}
	g.AddNode(node)
	ctrl.RegisterGraph(g)

	err := ctrl.enqueueNode("graph-x", node)
	require.NoError(t, err)

	mock.mu.Lock()
	task := mock.tasks["classifier"][0]
	mock.mu.Unlock()

	assert.Equal(t, "graph-x-classifier", task.TaskID)
	assert.Equal(t, "graph-x", task.GraphID)
	assert.Equal(t, "classifier", task.NodeID)
	assert.Equal(t, "classifier", task.Type)
	assert.Equal(t, "pending", task.Status)
	assert.Equal(t, 5, task.MaxRetries)
	assert.Equal(t, int64(10000), task.TimeoutMs)
}

func TestSwarmController_ResolveAndEnqueue(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	mock := newMockRedisForController()
	ctrl.redis = mock

	// Build graph: a completed -> b ready
	g := NewExecutionGraph("graph-1")
	g.AddNode(&GraphNode{ID: "a", AgentType: "intake", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "b", AgentType: "classifier", Status: NodeStatusPending, DependsOn: []string{"a"}})
	ctrl.RegisterGraph(g)

	// resolveAndEnqueue should enqueue node "b"
	ctrl.resolveAndEnqueue()

	mock.mu.Lock()
	tasks := mock.tasks["classifier"]
	mock.mu.Unlock()
	require.Len(t, tasks, 1, "classifier should have 1 task enqueued")
	assert.Equal(t, "b", tasks[0].NodeID)
}

func TestSwarmController_RedistributeWorkerTasks(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	mock := newMockRedisForController()
	ctrl.redis = mock

	// Add a task to the processing queue
	task := &Task{
		TaskID:  "task-1",
		GraphID: "graph-1",
		NodeID:  "intake",
		Type:    "intake",
		Status:  "processing",
	}
	mock.mu.Lock()
	mock.tasks["intake"] = []*Task{task}
	mock.mu.Unlock()

	// redistribute should set status back to pending and re-enqueue
	ctrl.redistributeWorkerTasks("intake")

	mock.mu.Lock()
	tasks := mock.tasks["intake"]
	mock.mu.Unlock()
	require.Len(t, tasks, 1, "task should be re-enqueued")
	assert.Equal(t, "pending", tasks[0].Status)
}

func TestSwarmController_ProcessEvent_TaskCompleted(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	payload := []byte(`{"task_id":"task-123","worker_id":"worker-1"}`)
	err := ctrl.ProcessEvent(ChannelTaskCompleted, payload)
	require.NoError(t, err)
}

func TestSwarmController_ProcessEvent_AgentStatus(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	payload := []byte(`{"worker_id":"worker-1","status":"idle"}`)
	err := ctrl.ProcessEvent(ChannelAgentStatus, payload)
	require.NoError(t, err)
}

func TestSwarmController_ProcessEvent_GraphDone(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	g := NewExecutionGraph("graph-done")
	ctrl.RegisterGraph(g)

	payload := []byte(`{"graph_id":"graph-done"}`)
	err := ctrl.ProcessEvent(ChannelGraphDone, payload)
	require.NoError(t, err)

	_, ok := ctrl.GetGraph("graph-done")
	assert.False(t, ok, "graph should be removed after graph_done event")
}

func TestSwarmController_ProcessEvent_Rebalance(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	payload := []byte(`{"reason":"high load"}`)
	err := ctrl.ProcessEvent(ChannelRebalance, payload)
	require.NoError(t, err)
}

func TestSwarmController_ProcessEvent_UnknownEvent(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	err := ctrl.ProcessEvent("unknown_event", []byte(`{}`))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown event type")
}

func TestSwarmController_HandleGraphEvent(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	mock := newMockRedisForController()
	ctrl.redis = mock

	g := NewExecutionGraph("graph-evt")
	g.AddNode(&GraphNode{ID: "node-1", AgentType: "intake", Status: NodeStatusPending})
	ctrl.RegisterGraph(g)

	err := ctrl.HandleGraphEvent("graph-evt", "node-1", NodeStatusRunning, nil)
	require.NoError(t, err)

	node, _ := g.Node("node-1")
	assert.Equal(t, NodeStatusRunning, node.Status)
}

func TestSwarmController_HandleGraphEvent_CompleteWithOutput(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	mock := newMockRedisForController()
	ctrl.redis = mock

	g := NewExecutionGraph("graph-evt")
	g.AddNode(&GraphNode{ID: "node-1", AgentType: "intake", Status: NodeStatusPending})
	ctrl.RegisterGraph(g)

	output := map[string]any{"result": "success"}
	err := ctrl.HandleGraphEvent("graph-evt", "node-1", NodeStatusCompleted, output)
	require.NoError(t, err)

	node, _ := g.Node("node-1")
	assert.Equal(t, NodeStatusCompleted, node.Status)

	state, ok := g.GetState("node-1.output")
	require.True(t, ok)
	assert.Contains(t, string(state), "success")
}

func TestSwarmController_HandleGraphEvent_GraphNotFound(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	err := ctrl.HandleGraphEvent("nonexistent", "node-1", NodeStatusRunning, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestSwarmController_Workers(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	// Empty registry
	workers := ctrl.Workers()
	assert.Nil(t, workers)

	// Add worker to registry
	registry.RegisterWorker(&WorkerStatus{ID: "w1", AgentType: "intake"})
	workers = ctrl.Workers()
	require.Len(t, workers, 1)
	assert.Equal(t, "w1", workers[0].ID)
}

func TestSwarmController_Graphs(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	g1 := NewExecutionGraph("graph-1")
	g2 := NewExecutionGraph("graph-2")
	ctrl.RegisterGraph(g1)
	ctrl.RegisterGraph(g2)

	graphs := ctrl.Graphs()
	require.Len(t, graphs, 2)
	assert.Contains(t, graphs, "graph-1")
	assert.Contains(t, graphs, "graph-2")
}

func TestSwarmController_OnTaskCompleted_InvalidJSON(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	err := ctrl.onTaskCompleted([]byte(`{invalid`))
	assert.Error(t, err)
}

func TestSwarmController_OnAgentStatus_InvalidJSON(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	err := ctrl.onAgentStatus([]byte(`{invalid`))
	assert.Error(t, err)
}

func TestSwarmController_OnGraphDone_InvalidJSON(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	err := ctrl.onGraphDone([]byte(`{invalid`))
	assert.Error(t, err)
}

func TestSwarmController_OnRebalance_InvalidJSON(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	err := ctrl.onRebalance([]byte(`{invalid`))
	assert.Error(t, err)
}

func TestSwarmController_Stop(t *testing.T) {
	redis := &RedisClient{}
	registry := NewAgentRegistry()
	ctrl := NewSwarmController(redis, registry)

	// Stop should not panic
	ctrl.Stop()
}