package swarm

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestSchedulerTick(t *testing.T) {
	// Setup miniredis
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
	defer rdb.Close()

	redisClient := NewRedisClient(s.Addr())
	registry := NewAgentRegistry()

	controller := NewSwarmController(redisClient, registry)
	if controller == nil {
		t.Fatal("NewSwarmController returned nil")
	}

	// Verify default tick duration
	if controller.schedulerTick != 100*time.Millisecond {
		t.Errorf("expected schedulerTick of 100ms, got %v", controller.schedulerTick)
	}
}

func TestControllerResolveAndEnqueue(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	redisClient := NewRedisClient(s.Addr())
	registry := NewAgentRegistry()

	controller := NewSwarmController(redisClient, registry)

	// Create a graph with ready nodes
	graph := &ExecutionGraph{
		ID: "test-graph",
		Nodes: map[string]*GraphNode{
			"node1": {
				ID:     "node1",
				Status: NodeStatusPending,
				MaxRetries: 3,
				Timeout: Duration{Duration: 30 * time.Second},
			},
		},
	}

	controller.RegisterGraph(graph)

	// resolveAndEnqueue should not panic
	controller.resolveAndEnqueue()
}

func TestControllerRegisterAndGetGraph(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	redisClient := NewRedisClient(s.Addr())
	registry := NewAgentRegistry()

	controller := NewSwarmController(redisClient, registry)

	graph := &ExecutionGraph{ID: "test-graph"}
	controller.RegisterGraph(graph)

	got, ok := controller.GetGraph("test-graph")
	if !ok {
		t.Error("expected to find registered graph")
	}
	if got.ID != "test-graph" {
		t.Errorf("expected graph ID 'test-graph', got %q", got.ID)
	}

	_, ok = controller.GetGraph("nonexistent")
	if ok {
		t.Error("expected not to find nonexistent graph")
	}
}

func TestControllerEnqueueNode(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	redisClient := NewRedisClient(s.Addr())
	registry := NewAgentRegistry()

	controller := NewSwarmController(redisClient, registry)

	node := &GraphNode{
		ID:     "test-node",
		Status: NodeStatusPending,
		MaxRetries: 3,
		Timeout: Duration{Duration: 30 * time.Second},
	}

	err = controller.enqueueNode("test-graph", node)
	if err != nil {
		t.Errorf("enqueueNode failed: %v", err)
	}
}

func TestControllerProcessEvent(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	redisClient := NewRedisClient(s.Addr())
	registry := NewAgentRegistry()

	controller := NewSwarmController(redisClient, registry)

	tests := []struct {
		name        string
		eventType   string
		payload     []byte
		wantErr     bool
		errContains string
	}{
		{
			name:      "task completed",
			eventType: ChannelTaskCompleted,
			payload:   []byte(`{"task_id":"task-1","worker_id":"worker-1"}`),
			wantErr:   false,
		},
		{
			name:      "agent status",
			eventType: ChannelAgentStatus,
			payload:   []byte(`{"worker_id":"worker-1","status":"idle"}`),
			wantErr:   false,
		},
		{
			name:      "graph done",
			eventType: ChannelGraphDone,
			payload:   []byte(`{"graph_id":"graph-1"}`),
			wantErr:   false,
		},
		{
			name:      "rebalance",
			eventType: ChannelRebalance,
			payload:   []byte(`{"reason":"high load"}`),
			wantErr:   false,
		},
		{
			name:        "unknown event",
			eventType:   "unknown",
			payload:     []byte(`{}`),
			wantErr:     true,
			errContains: "unknown event type",
		},
		{
			name:        "invalid payload task completed",
			eventType:   ChannelTaskCompleted,
			payload:     []byte(`{invalid json}`),
			wantErr:     true,
			errContains: "unmarshal",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := controller.ProcessEvent(tt.eventType, tt.payload)
			if (err != nil) != tt.wantErr {
				t.Errorf("ProcessEvent() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.errContains != "" && err != nil {
				if !containsString(err.Error(), tt.errContains) {
					t.Errorf("ProcessEvent() error = %v, want containing %q", err, tt.errContains)
				}
			}
		})
	}
}

func TestControllerHandleGraphEvent(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	redisClient := NewRedisClient(s.Addr())
	registry := NewAgentRegistry()

	controller := NewSwarmController(redisClient, registry)

	graph := &ExecutionGraph{
		ID: "test-graph",
		Nodes: map[string]*GraphNode{
			"node1": {
				ID:     "node1",
				Status: NodeStatusPending,
			},
		},
	}
	controller.RegisterGraph(graph)

	// Update node status
	err = controller.HandleGraphEvent("test-graph", "node1", NodeStatusRunning, nil)
	if err != nil {
		t.Errorf("HandleGraphEvent() failed: %v", err)
	}

	// Test nonexistent graph
	err = controller.HandleGraphEvent("nonexistent", "node1", NodeStatusRunning, nil)
	if err == nil {
		t.Error("expected error for nonexistent graph")
	}
}

func TestControllerStop(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	redisClient := NewRedisClient(s.Addr())
	registry := NewAgentRegistry()

	controller := NewSwarmController(redisClient, registry)

	// Stop should not panic
	controller.Stop()
}

func TestControllerWorkers(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	redisClient := NewRedisClient(s.Addr())

	// Without registry
	controller := NewSwarmController(redisClient, nil)
	workers := controller.Workers()
	if workers != nil {
		t.Error("expected nil workers without registry")
	}

	// With registry
	registry := NewAgentRegistry()
	controller = NewSwarmController(redisClient, registry)
	workers = controller.Workers()
	if workers == nil {
		t.Error("expected non-nil workers with registry")
	}
}

func TestControllerGraphs(t *testing.T) {
	s, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer s.Close()

	redisClient := NewRedisClient(s.Addr())
	registry := NewAgentRegistry()

	controller := NewSwarmController(redisClient, registry)

	graphs := controller.Graphs()
	if graphs == nil {
		t.Error("expected non-nil graphs map")
	}

	controller.RegisterGraph(&ExecutionGraph{ID: "g1"})
	controller.RegisterGraph(&ExecutionGraph{ID: "g2"})

	graphs = controller.Graphs()
	if len(graphs) != 2 {
		t.Errorf("expected 2 graphs, got %d", len(graphs))
	}
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
