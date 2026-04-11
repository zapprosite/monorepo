package swarm

import (
	"fmt"
	"time"
)

// Node IDs for the message processing graph.
const (
	NodeIntake        = "intake"
	NodeClassifier    = "classifier"
	NodeAccessControl = "access_control"
	NodeRAG          = "rag"
	NodeBilling      = "billing"
	NodeMemoryPre    = "memory_pre"
	NodeRanking      = "ranking"
	NodeResponse     = "response"
	NodeMemoryPost   = "memory_post"
)

// Default timeouts per node type.
var defaultTimeouts = map[string]time.Duration{
	NodeIntake:        30 * time.Second,
	NodeClassifier:    15 * time.Second,
	NodeAccessControl: 5 * time.Second,
	NodeRAG:           30 * time.Second,
	NodeBilling:       10 * time.Second,
	NodeMemoryPre:     10 * time.Second,
	NodeRanking:       20 * time.Second,
	NodeResponse:      45 * time.Second,
	NodeMemoryPost:    10 * time.Second,
}

// Default max retries per node type.
var defaultMaxRetries = map[string]int{
	NodeIntake:        2,
	NodeClassifier:    2,
	NodeAccessControl: 1,
	NodeRAG:           3,
	NodeBilling:       2,
	NodeMemoryPre:     2,
	NodeRanking:       2,
	NodeResponse:      3,
	NodeMemoryPost:    2,
}

// BuildMessageGraph creates a standard 9-node execution graph for message processing.
// The graph represents the HVAC-R message pipeline with conditional access control skip.
//
// Graph structure:
//   intake → classifier → access_control ─┬─→ rag → ranking ─┬─→ response → memory_post
//                                         ├─→ billing
//                                         └─→ memory_pre
//
// Conditional skip: when access_control.block == true, skip rag, ranking, response, memory_post.
func BuildMessageGraph(graphID string) (*ExecutionGraph, error) {
	g := NewExecutionGraph(graphID)

	nodes := []*GraphNode{
		{
			ID:         NodeIntake,
			AgentType:  "intake",
			Status:     NodeStatusPending,
			MaxRetries: defaultMaxRetries[NodeIntake],
			Timeout:    Duration{defaultTimeouts[NodeIntake]},
		},
		{
			ID:         NodeClassifier,
			AgentType:  "classifier",
			Status:     NodeStatusPending,
			DependsOn:  []string{NodeIntake},
			MaxRetries: defaultMaxRetries[NodeClassifier],
			Timeout:    Duration{defaultTimeouts[NodeClassifier]},
		},
		{
			ID:         NodeAccessControl,
			AgentType:  "access_control",
			Status:     NodeStatusPending,
			DependsOn:  []string{NodeClassifier},
			MaxRetries: defaultMaxRetries[NodeAccessControl],
			Timeout:    Duration{defaultTimeouts[NodeAccessControl]},
		},
		{
			ID:         NodeRAG,
			AgentType:  "rag",
			Status:     NodeStatusPending,
			DependsOn:  []string{NodeAccessControl},
			MaxRetries: defaultMaxRetries[NodeRAG],
			Timeout:    Duration{defaultTimeouts[NodeRAG]},
		},
		{
			ID:         NodeBilling,
			AgentType:  "billing",
			Status:     NodeStatusPending,
			DependsOn:  []string{NodeAccessControl},
			MaxRetries: defaultMaxRetries[NodeBilling],
			Timeout:    Duration{defaultTimeouts[NodeBilling]},
		},
		{
			ID:         NodeMemoryPre,
			AgentType:  "memory_pre",
			Status:     NodeStatusPending,
			DependsOn:  []string{NodeAccessControl},
			MaxRetries: defaultMaxRetries[NodeMemoryPre],
			Timeout:    Duration{defaultTimeouts[NodeMemoryPre]},
		},
		{
			ID:         NodeRanking,
			AgentType:  "ranking",
			Status:     NodeStatusPending,
			DependsOn:  []string{NodeRAG},
			MaxRetries: defaultMaxRetries[NodeRanking],
			Timeout:    Duration{defaultTimeouts[NodeRanking]},
		},
		{
			ID:         NodeResponse,
			AgentType:  "response",
			Status:     NodeStatusPending,
			DependsOn:  []string{NodeRanking, NodeAccessControl},
			MaxRetries: defaultMaxRetries[NodeResponse],
			Timeout:    Duration{defaultTimeouts[NodeResponse]},
		},
		{
			ID:         NodeMemoryPost,
			AgentType:  "memory_post",
			Status:     NodeStatusPending,
			DependsOn:  []string{NodeResponse},
			MaxRetries: defaultMaxRetries[NodeMemoryPost],
			Timeout:    Duration{defaultTimeouts[NodeMemoryPost]},
		},
	}

	for _, n := range nodes {
		if err := g.AddNode(n); err != nil {
			return nil, fmt.Errorf("failed to add node %s: %w", n.ID, err)
		}
	}

	// Add edges
	if err := g.AddEdge(NodeClassifier, NodeAccessControl); err != nil {
		return nil, err
	}
	if err := g.AddEdge(NodeAccessControl, NodeRAG); err != nil {
		return nil, err
	}
	if err := g.AddEdge(NodeAccessControl, NodeBilling); err != nil {
		return nil, err
	}
	if err := g.AddEdge(NodeAccessControl, NodeMemoryPre); err != nil {
		return nil, err
	}
	if err := g.AddEdge(NodeRAG, NodeRanking); err != nil {
		return nil, err
	}
	if err := g.AddEdge(NodeRanking, NodeResponse); err != nil {
		return nil, err
	}
	if err := g.AddEdge(NodeAccessControl, NodeResponse); err != nil {
		return nil, err
	}
	if err := g.AddEdge(NodeResponse, NodeMemoryPost); err != nil {
		return nil, err
	}

	// Conditional skip: access_control.block → skip rag, ranking, response, memory_post
	if err := g.AddConditionalSkip(NodeAccessControl, []string{NodeRAG, NodeRanking, NodeResponse, NodeMemoryPost}, nil); err != nil {
		return nil, err
	}

	return g, nil
}

// BuildMessageGraphSimple is a convenience factory for tests.
func BuildMessageGraphSimple() *ExecutionGraph {
	g, err := BuildMessageGraph("simple-graph")
	if err != nil {
		panic(err)
	}
	return g
}

// NodeAgentType maps a node ID to its canonical agent type for queue routing.
func NodeAgentType(nodeID string) string {
	switch nodeID {
	case NodeIntake:
		return "intake"
	case NodeClassifier:
		return "classifier"
	case NodeAccessControl:
		return "access_control"
	case NodeRAG:
		return "rag"
	case NodeRanking:
		return "ranking"
	case NodeResponse:
		return "response"
	case NodeBilling:
		return "billing"
	case NodeMemoryPre, NodeMemoryPost:
		return "memory"
	default:
		return nodeID
	}
}

// ValidateGraph checks that the graph is well-formed.
func ValidateGraph(g *ExecutionGraph) error {
	if g == nil {
		return fmt.Errorf("graph is nil")
	}
	if g.ID == "" {
		return fmt.Errorf("graph ID is empty")
	}
	if len(g.Nodes) == 0 {
		return fmt.Errorf("graph has no nodes")
	}
	for _, node := range g.Nodes {
		for _, dep := range node.DependsOn {
			if _, exists := g.Nodes[dep]; !exists {
				return fmt.Errorf("node %q depends on unknown node %q", node.ID, dep)
			}
		}
	}
	return nil
}