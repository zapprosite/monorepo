package swarm

import (
	"testing"
)

func TestBuildMessageGraph(t *testing.T) {
	g, err := BuildMessageGraph("test-graph")
	if err != nil {
		t.Fatalf("BuildMessageGraph failed: %v", err)
	}

	if g.ID != "test-graph" {
		t.Errorf("graph ID = %s, want test-graph", g.ID)
	}

	// Check all 9 nodes are present
	expectedNodes := []string{
		NodeIntake, NodeClassifier, NodeAccessControl,
		NodeRAG, NodeBilling, NodeMemoryPre,
		NodeRanking, NodeResponse, NodeMemoryPost,
	}
	if n := g.NodeCount(); n != len(expectedNodes) {
		t.Errorf("NodeCount() = %d, want %d", n, len(expectedNodes))
	}

	for _, id := range expectedNodes {
		node, ok := g.Node(id)
		if !ok {
			t.Errorf("node %s not found", id)
			continue
		}
		if node.ID != id {
			t.Errorf("node.ID = %s, want %s", node.ID, id)
		}
	}
}

func TestBuildMessageGraph_Edges(t *testing.T) {
	g, err := BuildMessageGraph("test")
	if err != nil {
		t.Fatalf("BuildMessageGraph failed: %v", err)
	}

	// Verify key dependencies
	intake, _ := g.Node(NodeIntake)
	if len(intake.DependsOn) != 0 {
		t.Errorf("intake.DependsOn = %v, want []", intake.DependsOn)
	}

	classifier, _ := g.Node(NodeClassifier)
	if len(classifier.DependsOn) != 1 || classifier.DependsOn[0] != NodeIntake {
		t.Errorf("classifier.DependsOn = %v, want [%s]", classifier.DependsOn, NodeIntake)
	}

	accessControl, _ := g.Node(NodeAccessControl)
	if len(accessControl.DependsOn) != 1 || accessControl.DependsOn[0] != NodeClassifier {
		t.Errorf("accessControl.DependsOn = %v, want [%s]", accessControl.DependsOn, NodeClassifier)
	}

	rag, _ := g.Node(NodeRAG)
	if len(rag.DependsOn) != 1 || rag.DependsOn[0] != NodeAccessControl {
		t.Errorf("rag.DependsOn = %v, want [%s]", rag.DependsOn, NodeAccessControl)
	}

	response, _ := g.Node(NodeResponse)
	if len(response.DependsOn) != 2 {
		t.Errorf("response.DependsOn length = %d, want 2", len(response.DependsOn))
	}

	ranking, _ := g.Node(NodeRanking)
	if len(ranking.DependsOn) != 1 || ranking.DependsOn[0] != NodeRAG {
		t.Errorf("ranking.DependsOn = %v, want [%s]", ranking.DependsOn, NodeRAG)
	}
}

func TestBuildMessageGraph_ConditionalSkip(t *testing.T) {
	g, err := BuildMessageGraph("test")
	if err != nil {
		t.Fatalf("BuildMessageGraph failed: %v", err)
	}

	// Verify conditional skip was registered
	v, ok := g.GetState("skip_" + NodeAccessControl)
	if !ok {
		t.Fatal("conditional skip not registered for access_control")
	}

	var targets []string
	if err := parseSkipTargets(v, &targets); err != nil {
		t.Fatalf("failed to parse skip targets: %v", err)
	}

	expected := []string{NodeRAG, NodeRanking, NodeResponse, NodeMemoryPost}
	if len(targets) != len(expected) {
		t.Fatalf("skip targets count = %d, want %d", len(targets), len(expected))
	}
	for i, e := range expected {
		if targets[i] != e {
			t.Errorf("skip target[%d] = %s, want %s", i, targets[i], e)
		}
	}
}

func parseSkipTargets(data []byte, targets *[]string) error {
	// Simple parser for ["a","b"] format
	s := string(data)
	// Remove brackets
	s = s[1 : len(s)-1]
	// Parse comma-separated quoted strings
	var result []string
	start := 0
	inQuote := false
	for i := 0; i < len(s); i++ {
		if s[i] == '"' {
			if !inQuote {
				start = i + 1
				inQuote = true
			} else {
				result = append(result, s[start:i])
				inQuote = false
			}
		}
	}
	*targets = result
	return nil
}

func TestBuildMessageGraph_Timeouts(t *testing.T) {
	g, err := BuildMessageGraph("test")
	if err != nil {
		t.Fatalf("BuildMessageGraph failed: %v", err)
	}

	// Verify each node has a non-zero timeout
	for _, id := range []string{NodeIntake, NodeClassifier, NodeAccessControl, NodeRAG} {
		node, ok := g.Node(id)
		if !ok {
			t.Errorf("node %s not found", id)
			continue
		}
		if node.Timeout.Duration == 0 {
			t.Errorf("node %s has zero timeout", id)
		}
	}
}

func TestBuildMessageGraph_MaxRetries(t *testing.T) {
	g, err := BuildMessageGraph("test")
	if err != nil {
		t.Fatalf("BuildMessageGraph failed: %v", err)
	}

	// Verify max retries are set
	for _, id := range []string{NodeIntake, NodeRAG, NodeResponse} {
		node, ok := g.Node(id)
		if !ok {
			t.Errorf("node %s not found", id)
			continue
		}
		if node.MaxRetries <= 0 {
			t.Errorf("node %s has invalid MaxRetries: %d", id, node.MaxRetries)
		}
	}
}

func TestBuildMessageGraphSimple(t *testing.T) {
	g := BuildMessageGraphSimple()
	if g == nil {
		t.Fatal("BuildMessageGraphSimple returned nil")
	}
	if g.ID != "simple-graph" {
		t.Errorf("ID = %s, want simple-graph", g.ID)
	}
}

func TestNodeAgentType(t *testing.T) {
	tests := []struct {
		nodeID   string
		expected string
	}{
		{NodeIntake, "intake"},
		{NodeClassifier, "classifier"},
		{NodeAccessControl, "access_control"},
		{NodeRAG, "rag"},
		{NodeRanking, "ranking"},
		{NodeResponse, "response"},
		{NodeBilling, "billing"},
		{NodeMemoryPre, "memory"},
		{NodeMemoryPost, "memory"},
		{"unknown", "unknown"},
	}

	for _, tt := range tests {
		if got := NodeAgentType(tt.nodeID); got != tt.expected {
			t.Errorf("NodeAgentType(%s) = %s, want %s", tt.nodeID, got, tt.expected)
		}
	}
}

func TestValidateGraph(t *testing.T) {
	// Valid graph
	g, _ := BuildMessageGraph("valid")
	if err := ValidateGraph(g); err != nil {
		t.Errorf("ValidateGraph(valid) = %v, want nil", err)
	}

	// Nil graph
	if err := ValidateGraph(nil); err == nil {
		t.Error("ValidateGraph(nil) = nil, want error")
	}

	// Empty ID
	g2 := NewExecutionGraph("")
	if err := ValidateGraph(g2); err == nil {
		t.Error("ValidateGraph(empty ID) = nil, want error")
	}

	// No nodes
	g3 := NewExecutionGraph("no-nodes")
	if err := ValidateGraph(g3); err == nil {
		t.Error("ValidateGraph(no nodes) = nil, want error")
	}

	// Missing dependency
	g4 := NewExecutionGraph("missing-dep")
	g4.AddNode(&GraphNode{ID: "a"})
	g4.AddNode(&GraphNode{ID: "b", DependsOn: []string{"missing"}})
	if err := ValidateGraph(g4); err == nil {
		t.Error("ValidateGraph(missing dep) = nil, want error")
	}
}