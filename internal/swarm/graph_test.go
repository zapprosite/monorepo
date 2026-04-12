package swarm

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewExecutionGraph(t *testing.T) {
	g := NewExecutionGraph("test-graph")
	if g.ID != "test-graph" {
		t.Errorf("ID = %s, want test-graph", g.ID)
	}
	if g.Nodes == nil {
		t.Error("Nodes is nil")
	}
	if g.Edges == nil {
		t.Error("Edges is nil")
	}
	if g.State == nil {
		t.Error("State is nil")
	}
}

func TestExecutionGraph_AddNode(t *testing.T) {
	g := NewExecutionGraph("test")
	node := &GraphNode{ID: "node-1", AgentType: "intake", Status: NodeStatusPending}

	if err := g.AddNode(node); err != nil {
		t.Fatalf("AddNode failed: %v", err)
	}

	if n, ok := g.Node("node-1"); !ok || n.ID != "node-1" {
		t.Error("Node not added correctly")
	}
}

func TestExecutionGraph_AddNode_Duplicate(t *testing.T) {
	g := NewExecutionGraph("test")
	node := &GraphNode{ID: "node-1", AgentType: "intake"}
	g.AddNode(node)

	err := g.AddNode(&GraphNode{ID: "node-1", AgentType: "intake"})
	if err == nil {
		t.Error("Expected error for duplicate node")
	}
}

func TestExecutionGraph_AddNode_EmptyID(t *testing.T) {
	g := NewExecutionGraph("test")
	err := g.AddNode(&GraphNode{ID: "", AgentType: "intake"})
	if err == nil {
		t.Error("Expected error for empty node ID")
	}
}

func TestExecutionGraph_AddEdge(t *testing.T) {
	g := NewExecutionGraph("test")
	g.AddNode(&GraphNode{ID: "source", AgentType: "a"})
	g.AddNode(&GraphNode{ID: "target", AgentType: "b"})

	err := g.AddEdge("source", "target")
	if err != nil {
		t.Fatalf("AddEdge failed: %v", err)
	}

	node, _ := g.Node("target")
	if len(node.DependsOn) != 1 || node.DependsOn[0] != "source" {
		t.Errorf("DependsOn = %v, want [source]", node.DependsOn)
	}
}

func TestExecutionGraph_AddEdge_NonExistentNode(t *testing.T) {
	g := NewExecutionGraph("test")
	g.AddNode(&GraphNode{ID: "source", AgentType: "a"})

	err := g.AddEdge("source", "missing")
	if err == nil {
		t.Error("Expected error for non-existent target node")
	}
}

func TestExecutionGraph_resolveReady(t *testing.T) {
	g := NewExecutionGraph("test")

	// Build graph: a -> b -> c
	g.AddNode(&GraphNode{ID: "a", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "b", Status: NodeStatusPending, DependsOn: []string{"a"}})
	g.AddNode(&GraphNode{ID: "c", Status: NodeStatusPending, DependsOn: []string{"b"}})

	ready := g.resolveReady()
	if len(ready) != 1 {
		t.Fatalf("len(ready) = %d, want 1", len(ready))
	}
	if ready[0].ID != "b" {
		t.Errorf("ready[0].ID = %s, want b", ready[0].ID)
	}

	// Complete b and check again
	g.SetNodeStatus("b", NodeStatusCompleted)
	ready = g.resolveReady()
	if len(ready) != 1 {
		t.Fatalf("len(ready) = %d, want 1", len(ready))
	}
	if ready[0].ID != "c" {
		t.Errorf("ready[0].ID = %s, want c", ready[0].ID)
	}
}

func TestExecutionGraph_resolveReady_AllDepsCompleted(t *testing.T) {
	g := NewExecutionGraph("test")

	// Node with multiple deps all completed
	g.AddNode(&GraphNode{ID: "a", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "b", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{
		ID:        "c",
		Status:    NodeStatusPending,
		DependsOn: []string{"a", "b"},
	})

	ready := g.resolveReady()
	if len(ready) != 1 {
		t.Fatalf("len(ready) = %d, want 1", len(ready))
	}
	if ready[0].ID != "c" {
		t.Errorf("ready[0].ID = %s, want c", ready[0].ID)
	}
}

func TestExecutionGraph_resolveReady_SkippedDep(t *testing.T) {
	g := NewExecutionGraph("test")

	// a is skipped, so b should still be ready
	g.AddNode(&GraphNode{ID: "a", Status: NodeStatusSkipped})
	g.AddNode(&GraphNode{ID: "b", Status: NodeStatusPending, DependsOn: []string{"a"}})

	ready := g.resolveReady()
	if len(ready) != 1 {
		t.Fatalf("len(ready) = %d, want 1", len(ready))
	}
	if ready[0].ID != "b" {
		t.Errorf("ready[0].ID = %s, want b", ready[0].ID)
	}
}

func TestExecutionGraph_IsComplete(t *testing.T) {
	g := NewExecutionGraph("test")
	g.AddNode(&GraphNode{ID: "a", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "b", Status: NodeStatusCompleted})

	if !g.IsComplete() {
		t.Error("IsComplete() = false, want true")
	}

	g.AddNode(&GraphNode{ID: "c", Status: NodeStatusPending})
	if g.IsComplete() {
		t.Error("IsComplete() = true, want false")
	}
}

func TestExecutionGraph_IsComplete_RunningNotComplete(t *testing.T) {
	g := NewExecutionGraph("test")
	g.AddNode(&GraphNode{ID: "a", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "b", Status: NodeStatusRunning})

	if g.IsComplete() {
		t.Error("IsComplete() = true, want false")
	}
}

func TestExecutionGraph_SetNodeStatus(t *testing.T) {
	g := NewExecutionGraph("test")
	g.AddNode(&GraphNode{ID: "node-1", Status: NodeStatusPending})

	err := g.SetNodeStatus("node-1", NodeStatusRunning)
	if err != nil {
		t.Fatalf("SetNodeStatus failed: %v", err)
	}

	node, _ := g.Node("node-1")
	if node.Status != NodeStatusRunning {
		t.Errorf("Status = %s, want running", node.Status)
	}
}

func TestExecutionGraph_SetNodeStatus_NonExistent(t *testing.T) {
	g := NewExecutionGraph("test")
	err := g.SetNodeStatus("missing", NodeStatusRunning)
	if err == nil {
		t.Error("Expected error for non-existent node")
	}
}

func TestExecutionGraph_State(t *testing.T) {
	g := NewExecutionGraph("test")
	g.SetState("key1", json.RawMessage(`"value1"`))

	v, ok := g.GetState("key1")
	if !ok {
		t.Error("GetState returned false")
	}
	if string(v) != `"value1"` {
		t.Errorf("GetState returned %s, want \"value1\"", string(v))
	}
}

func TestExecutionGraph_NodeCount(t *testing.T) {
	g := NewExecutionGraph("test")
	g.AddNode(&GraphNode{ID: "a", AgentType: "x"})
	g.AddNode(&GraphNode{ID: "b", AgentType: "y"})

	if n := g.NodeCount(); n != 2 {
		t.Errorf("NodeCount() = %d, want 2", n)
	}
}

func TestExecutionGraph_CompletedCount(t *testing.T) {
	g := NewExecutionGraph("test")
	g.AddNode(&GraphNode{ID: "a", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "b", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "c", Status: NodeStatusFailed})

	if n := g.CompletedCount(); n != 2 {
		t.Errorf("CompletedCount() = %d, want 2", n)
	}
}

func TestDuration_JSON(t *testing.T) {
	d := Duration{5 * time.Second}
	data, err := json.Marshal(d)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	var restored Duration
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	if restored.Duration != 5*time.Second {
		t.Errorf("Duration = %v, want 5s", restored.Duration)
	}
}

func TestGraphNode_ConcurrentStatusUpdate(t *testing.T) {
	node := &GraphNode{ID: "test", Status: NodeStatusPending}
	var wg sync.WaitGroup

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			node.mu.Lock()
			node.Status = NodeStatusRunning
			node.mu.Unlock()
		}()
	}
	wg.Wait()

	if node.Status != NodeStatusRunning {
		t.Errorf("Status = %s, want running", node.Status)
	}
}

func TestExecutionGraph_AddConditionalSkip(t *testing.T) {
	g := NewExecutionGraph("test")
	g.AddNode(&GraphNode{ID: "gate", AgentType: "access_control", Status: NodeStatusPending})
	g.AddNode(&GraphNode{ID: "rag", AgentType: "rag", Status: NodeStatusPending})
	g.AddNode(&GraphNode{ID: "ranking", AgentType: "ranking", Status: NodeStatusPending})

	err := g.AddConditionalSkip("gate", "decision", "block", []string{"rag", "ranking"})
	if err != nil {
		t.Fatalf("AddConditionalSkip failed: %v", err)
	}

	// Verify skip targets stored in state
	v, ok := g.GetState("skip_gate")
	if !ok {
		t.Error("skip_gate not found in state")
	}
	var targets []string
	if err := json.Unmarshal(v, &targets); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}
	if len(targets) != 2 || targets[0] != "rag" || targets[1] != "ranking" {
		t.Errorf("targets = %v, want [rag, ranking]", targets)
	}
}

func TestResolveReady_NoDependencies(t *testing.T) {
	g := NewExecutionGraph("test")

	// Node with no dependencies should be immediately ready
	g.AddNode(&GraphNode{ID: "intake", AgentType: "intake", Status: NodeStatusPending})

	ready := g.resolveReady()
	require.Len(t, ready, 1, "expected 1 ready node")
	assert.Equal(t, "intake", ready[0].ID, "intake should be ready with no dependencies")
}

func TestResolveReady_WaitsForDependencies(t *testing.T) {
	g := NewExecutionGraph("test")

	// intake -> classifier -> response (linear chain)
	g.AddNode(&GraphNode{ID: "intake", AgentType: "intake", Status: NodeStatusPending})
	g.AddNode(&GraphNode{ID: "classifier", AgentType: "classifier", Status: NodeStatusPending, DependsOn: []string{"intake"}})
	g.AddNode(&GraphNode{ID: "response", AgentType: "response", Status: NodeStatusPending, DependsOn: []string{"classifier"}})

	// Initially only intake is ready
	ready := g.resolveReady()
	require.Len(t, ready, 1, "expected 1 ready node")
	assert.Equal(t, "intake", ready[0].ID, "only intake should be ready initially")

	// After intake completes, classifier becomes ready
	g.SetNodeStatus("intake", NodeStatusCompleted)
	ready = g.resolveReady()
	require.Len(t, ready, 1, "expected 1 ready node after intake completes")
	assert.Equal(t, "classifier", ready[0].ID, "classifier should be ready after intake completes")

	// After classifier completes, response becomes ready
	g.SetNodeStatus("classifier", NodeStatusCompleted)
	ready = g.resolveReady()
	require.Len(t, ready, 1, "expected 1 ready node after classifier completes")
	assert.Equal(t, "response", ready[0].ID, "response should be ready after classifier completes")
}

func TestResolveReady_ParallelNodes(t *testing.T) {
	g := NewExecutionGraph("test")

	// Classic parallel execution: rag, billing, and memory_pre all run in parallel
	// after classifier, then feed into ranking
	g.AddNode(&GraphNode{ID: "classifier", AgentType: "classifier", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "rag", AgentType: "rag", Status: NodeStatusPending, DependsOn: []string{"classifier"}})
	g.AddNode(&GraphNode{ID: "billing", AgentType: "billing", Status: NodeStatusPending, DependsOn: []string{"classifier"}})
	g.AddNode(&GraphNode{ID: "memory_pre", AgentType: "memory", Status: NodeStatusPending, DependsOn: []string{"classifier"}})
	g.AddNode(&GraphNode{ID: "ranking", AgentType: "ranking", Status: NodeStatusPending, DependsOn: []string{"rag", "billing", "memory_pre"}})

	// After classifier completes, all three (rag, billing, memory_pre) should be ready in parallel
	ready := g.resolveReady()
	require.Len(t, ready, 3, "expected 3 ready nodes (rag, billing, memory_pre)")

	readyIDs := make(map[string]bool)
	for _, node := range ready {
		readyIDs[node.ID] = true
	}
	assert.True(t, readyIDs["rag"], "rag should be ready")
	assert.True(t, readyIDs["billing"], "billing should be ready")
	assert.True(t, readyIDs["memory_pre"], "memory_pre should be ready")

	// After rag completes, ranking still waits for billing and memory_pre
	g.SetNodeStatus("rag", NodeStatusCompleted)
	ready = g.resolveReady()
	require.Len(t, ready, 2, "expected 2 ready nodes (billing, memory_pre)")
	assert.Equal(t, "billing", ready[0].ID)
	assert.Equal(t, "memory_pre", ready[1].ID)

	// After all three complete, ranking becomes ready
	g.SetNodeStatus("billing", NodeStatusCompleted)
	g.SetNodeStatus("memory_pre", NodeStatusCompleted)
	ready = g.resolveReady()
	require.Len(t, ready, 1, "expected 1 ready node (ranking)")
	assert.Equal(t, "ranking", ready[0].ID)
}

func TestIsComplete_AllDone(t *testing.T) {
	g := NewExecutionGraph("test")

	// All nodes completed - should be complete
	g.AddNode(&GraphNode{ID: "a", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "b", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "c", Status: NodeStatusSkipped}) // Skipped nodes don't count

	assert.True(t, g.IsComplete(), "IsComplete should be true when all non-skipped nodes are done")

	// Add a failed node - should still be complete (failed is terminal)
	g.AddNode(&GraphNode{ID: "d", Status: NodeStatusFailed})
	assert.True(t, g.IsComplete(), "IsComplete should be true with failed nodes (terminal state)")

	// Add a pending node - should not be complete
	g.AddNode(&GraphNode{ID: "e", Status: NodeStatusPending})
	assert.False(t, g.IsComplete(), "IsComplete should be false with pending nodes")

	// Add a running node - should not be complete
	g.SetNodeStatus("e", NodeStatusRunning)
	assert.False(t, g.IsComplete(), "IsComplete should be false with running nodes")
}

func TestConditionalSkip_AccessControlBlock(t *testing.T) {
	g := NewExecutionGraph("test")

	// Simulate access_control gate with block condition
	g.AddNode(&GraphNode{ID: "access_control", AgentType: "access_control", Status: NodeStatusCompleted})
	g.AddNode(&GraphNode{ID: "rag", AgentType: "rag", Status: NodeStatusPending})
	g.AddNode(&GraphNode{ID: "billing", AgentType: "billing", Status: NodeStatusPending})

	// When access_control returns block, both rag and billing should be skipped
	err := g.AddConditionalSkip("access_control", "decision", "block", []string{"rag", "billing"})
	require.NoError(t, err, "AddConditionalSkip should not error")

	// Manually set skip in state (simulating access_control gate evaluation)
	g.SetState("skip_access_control", json.RawMessage(`["rag","billing"]`))

	// Verify the skip targets are stored
	v, ok := g.GetState("skip_access_control")
	require.True(t, ok, "skip_access_control should be in state")

	var targets []string
	err = json.Unmarshal(v, &targets)
	require.NoError(t, err, "should unmarshal skip targets")
	assert.Equal(t, []string{"rag", "billing"}, targets)
}

func TestGraph_EvaluateConditions_BlockSkips(t *testing.T) {
	g := NewExecutionGraph("test")

	// Build graph: intake -> access_control -> [rag, ranking, response]
	g.AddNode(&GraphNode{ID: "intake", AgentType: "intake", Status: NodeStatusPending})
	g.AddNode(&GraphNode{ID: "access_control", AgentType: "access_control", Status: NodeStatusPending, DependsOn: []string{"intake"}})
	g.AddNode(&GraphNode{ID: "rag", AgentType: "rag", Status: NodeStatusPending, DependsOn: []string{"access_control"}})
	g.AddNode(&GraphNode{ID: "ranking", AgentType: "ranking", Status: NodeStatusPending, DependsOn: []string{"access_control"}})
	g.AddNode(&GraphNode{ID: "response", AgentType: "response", Status: NodeStatusPending, DependsOn: []string{"access_control"}})

	// Add condition: when access_control.decision == "block", skip rag and ranking
	err := g.AddConditionalSkip("access_control", "decision", "block", []string{"rag", "ranking"})
	require.NoError(t, err, "AddConditionalSkip should not error")

	// Simulate access_control completing with decision="block"
	g.SetNodeStatus("access_control", NodeStatusCompleted)
	output := map[string]any{"decision": "block", "reason": "unauthorized"}
	g.EvaluateConditions("access_control", output)

	// Verify rag and ranking are skipped
	ragNode, ok := g.Node("rag")
	require.True(t, ok, "rag node should exist")
	assert.Equal(t, NodeStatusSkipped, ragNode.Status, "rag should be skipped when access_control=block")

	rankingNode, ok := g.Node("ranking")
	require.True(t, ok, "ranking node should exist")
	assert.Equal(t, NodeStatusSkipped, rankingNode.Status, "ranking should be skipped when access_control=block")

	// Verify response is NOT skipped (not in target list)
	responseNode, ok := g.Node("response")
	require.True(t, ok, "response node should exist")
	assert.Equal(t, NodeStatusPending, responseNode.Status, "response should NOT be skipped")
}

func TestGraph_EvaluateConditions_AllowDoesNotSkip(t *testing.T) {
	g := NewExecutionGraph("test")

	// Build graph: intake -> access_control -> [rag, ranking]
	g.AddNode(&GraphNode{ID: "intake", AgentType: "intake", Status: NodeStatusPending})
	g.AddNode(&GraphNode{ID: "access_control", AgentType: "access_control", Status: NodeStatusPending, DependsOn: []string{"intake"}})
	g.AddNode(&GraphNode{ID: "rag", AgentType: "rag", Status: NodeStatusPending, DependsOn: []string{"access_control"}})
	g.AddNode(&GraphNode{ID: "ranking", AgentType: "ranking", Status: NodeStatusPending, DependsOn: []string{"access_control"}})

	// Add condition: when access_control.decision == "block", skip rag and ranking
	err := g.AddConditionalSkip("access_control", "decision", "block", []string{"rag", "ranking"})
	require.NoError(t, err, "AddConditionalSkip should not error")

	// Simulate access_control completing with decision="allow"
	g.SetNodeStatus("access_control", NodeStatusCompleted)
	output := map[string]any{"decision": "allow"}
	g.EvaluateConditions("access_control", output)

	// Verify rag and ranking are NOT skipped (decision=allow, not block)
	ragNode, ok := g.Node("rag")
	require.True(t, ok, "rag node should exist")
	assert.Equal(t, NodeStatusPending, ragNode.Status, "rag should NOT be skipped when access_control=allow")

	rankingNode, ok := g.Node("ranking")
	require.True(t, ok, "ranking node should exist")
	assert.Equal(t, NodeStatusPending, rankingNode.Status, "ranking should NOT be skipped when access_control=allow")
}

func TestGraph_EvaluateConditions_WrongNode(t *testing.T) {
	g := NewExecutionGraph("test")

	g.AddNode(&GraphNode{ID: "access_control", AgentType: "access_control", Status: NodeStatusPending})
	g.AddNode(&GraphNode{ID: "rag", AgentType: "rag", Status: NodeStatusPending})

	// Add condition on access_control
	err := g.AddConditionalSkip("access_control", "decision", "block", []string{"rag"})
	require.NoError(t, err, "AddConditionalSkip should not error")

	// Evaluate conditions for a different node (intake, not access_control)
	// This should NOT trigger the condition even with the same output
	g.SetNodeStatus("access_control", NodeStatusCompleted)
	output := map[string]any{"decision": "block"}
	g.EvaluateConditions("intake", output) // Note: wrong node ID

	// rag should NOT be skipped because the condition source is access_control, not intake
	ragNode, ok := g.Node("rag")
	require.True(t, ok, "rag node should exist")
	assert.Equal(t, NodeStatusPending, ragNode.Status, "rag should NOT be skipped when evaluating wrong node")
}