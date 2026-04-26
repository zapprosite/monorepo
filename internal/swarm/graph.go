package swarm

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// ExecutionGraph represents the DAG of tasks for a single message processing run.
type ExecutionGraph struct {
	ID         string              `json:"id"`
	Nodes      map[string]*GraphNode `json:"nodes"`
	Edges      map[string][]string   `json:"edges"` // node_id → dependent nodes (this node depends on the ones in DependsOn)
	State      *SharedState          `json:"state,omitempty"`
	Conditions []Condition           `json:"conditions,omitempty"`
	mu         sync.RWMutex
}

// Condition defines a conditional skip rule for nodes.
// When SourceNode produces an output where OutputField equals TriggerValue,
// all TargetNodes are marked as skipped.
type Condition struct {
	SourceNode   string   `json:"source_node"`
	OutputField  string   `json:"output_field"`
	TriggerValue any      `json:"trigger_value"`
	TargetNodes  []string `json:"target_nodes"`
}

// GraphNode represents a single node in the execution graph.
type GraphNode struct {
	ID        string     `json:"id"`
	AgentType string     `json:"agent_type"`
	Status    NodeStatus `json:"status"`
	DependsOn []string   `json:"depends_on"`
	MaxRetries int       `json:"max_retries"`
	Timeout   Duration   `json:"timeout"`
	mu        sync.Mutex
}

// SharedState holds execution state shared across nodes.
type SharedState struct {
	Data map[string]json.RawMessage `json:"data"`
	mu   sync.RWMutex
}

// Duration is a time.Duration wrapper for JSON serialization.
type Duration struct {
	time.Duration
}

// MarshalJSON serializes Duration to JSON.
func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.Duration.String())
}

// UnmarshalJSON deserializes Duration from JSON.
func (d *Duration) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	p, err := time.ParseDuration(s)
	if err != nil {
		return fmt.Errorf("invalid duration: %w", err)
	}
	d.Duration = p
	return nil
}

// NewExecutionGraph creates a new execution graph with the given ID.
func NewExecutionGraph(id string) *ExecutionGraph {
	return &ExecutionGraph{
		ID:    id,
		Nodes: make(map[string]*GraphNode),
		Edges: make(map[string][]string),
		State: &SharedState{Data: make(map[string]json.RawMessage)},
	}
}

// AddNode adds a node to the graph.
func (g *ExecutionGraph) AddNode(node *GraphNode) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if node.ID == "" {
		return fmt.Errorf("node ID cannot be empty")
	}
	if _, exists := g.Nodes[node.ID]; exists {
		return fmt.Errorf("node %s already exists", node.ID)
	}
	g.Nodes[node.ID] = node
	return nil
}

// AddEdge adds a dependency edge: target depends on source.
// After this edge, source must complete before target can run.
func (g *ExecutionGraph) AddEdge(source, target string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if _, exists := g.Nodes[source]; !exists {
		return fmt.Errorf("source node %s does not exist", source)
	}
	if _, exists := g.Nodes[target]; !exists {
		return fmt.Errorf("target node %s does not exist", target)
	}

	// Ensure target's DependsOn includes source
	node := g.Nodes[target]
	for _, dep := range node.DependsOn {
		if dep == source {
			return nil // already added
		}
	}
	node.DependsOn = append(node.DependsOn, source)

	// Track reverse edge for dependency lookup
	g.Edges[source] = append(g.Edges[source], target)
	return nil
}

// resolveReady returns nodes that are ready to execute.
// A node is ready when all its dependencies are completed or skipped.
func (g *ExecutionGraph) resolveReady() []*GraphNode {
	g.mu.RLock()
	defer g.mu.RUnlock()

	var ready []*GraphNode
	for _, node := range g.Nodes {
		if node.Status != NodeStatusPending {
			continue
		}
		allDone := true
		for _, dep := range node.DependsOn {
			depNode, exists := g.Nodes[dep]
			if !exists {
				continue // dep node not in graph, skip
			}
			if depNode.Status != NodeStatusCompleted && depNode.Status != NodeStatusSkipped {
				allDone = false
				break
			}
		}
		if allDone {
			ready = append(ready, node)
		}
	}
	return ready
}

// Node returns a node by ID.
func (g *ExecutionGraph) Node(id string) (*GraphNode, bool) {
	g.mu.RLock()
	defer g.mu.RUnlock()
	n, ok := g.Nodes[id]
	return n, ok
}

// SetNodeStatus updates a node's status.
func (g *ExecutionGraph) SetNodeStatus(nodeID string, status NodeStatus) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	node, exists := g.Nodes[nodeID]
	if !exists {
		return fmt.Errorf("node %s does not exist", nodeID)
	}
	node.Status = status
	return nil
}

// IsComplete returns true when all non-skipped nodes have reached a terminal state.
func (g *ExecutionGraph) IsComplete() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()

	for _, node := range g.Nodes {
		if node.Status == NodeStatusPending || node.Status == NodeStatusRunning {
			return false
		}
	}
	return true
}

// CompletedCount returns the number of completed nodes.
func (g *ExecutionGraph) CompletedCount() int {
	g.mu.RLock()
	defer g.mu.RUnlock()

	var count int
	for _, node := range g.Nodes {
		if node.Status == NodeStatusCompleted {
			count++
		}
	}
	return count
}

// GetState returns a value from the shared state.
func (g *ExecutionGraph) GetState(key string) (json.RawMessage, bool) {
	g.State.mu.RLock()
	defer g.State.mu.RUnlock()
	v, ok := g.State.Data[key]
	return v, ok
}

// SetState stores a value in the shared state.
func (g *ExecutionGraph) SetState(key string, value json.RawMessage) {
	g.State.mu.Lock()
	defer g.State.mu.Unlock()
	g.State.Data[key] = value
}

// AddConditionalSkip adds a conditional skip rule to a node.
// When the gate condition evaluates to true, the target nodes are marked skipped.
// The condition triggers when output[outputField] == triggerValue.
func (g *ExecutionGraph) AddConditionalSkip(gateNodeID, outputField string, triggerValue any, targetNodeIDs []string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if _, exists := g.Nodes[gateNodeID]; !exists {
		return fmt.Errorf("gate node %s does not exist", gateNodeID)
	}

	// Append condition for later evaluation
	g.Conditions = append(g.Conditions, Condition{
		SourceNode:   gateNodeID,
		OutputField:  outputField,
		TriggerValue: triggerValue,
		TargetNodes:  targetNodeIDs,
	})

	// Also store skip targets in shared state for backwards compatibility
	if g.State.Data == nil {
		g.State.Data = make(map[string]json.RawMessage)
	}

	skipTargets, _ := json.Marshal(targetNodeIDs)
	g.State.Data["skip_"+gateNodeID] = skipTargets

	return nil
}

// EvaluateConditions checks all conditions and skips target nodes when the trigger is met.
// Called when a node completes with its output map.
func (g *ExecutionGraph) EvaluateConditions(nodeID string, output map[string]any) {
	g.mu.Lock()
	defer g.mu.Unlock()

	for _, cond := range g.Conditions {
		if cond.SourceNode != nodeID {
			continue
		}

		triggerVal, exists := output[cond.OutputField]
		if !exists {
			continue
		}

		// Compare trigger values
		if triggerVal == cond.TriggerValue {
			for _, targetID := range cond.TargetNodes {
				if node, ok := g.Nodes[targetID]; ok {
					node.Status = NodeStatusSkipped
				}
			}
		}
	}
}

// NodeCount returns total number of nodes in the graph.
func (g *ExecutionGraph) NodeCount() int {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return len(g.Nodes)
}