package agents

import (
	"context"
	"fmt"
)

// AgentInterface is the contract all swarm agents must implement.
// Agents receive tasks from the swarm scheduler and produce output maps
// that are merged into the shared execution graph state.
type AgentInterface interface {
	// Execute runs the agent logic for the given task.
	// It returns a map of output keys/values on success, or an error on failure.
	// Output keys should follow the convention: "agent_type.key" (e.g., "intake.phone").
	Execute(ctx context.Context, task *SwarmTask) (map[string]any, error)

	// AgentType returns the canonical agent type identifier.
	// This must match the queue name in Redis (e.g., "intake", "classifier").
	AgentType() string

	// MaxRetries returns the maximum number of retry attempts for this agent.
	MaxRetries() int

	// TimeoutMs returns the default timeout in milliseconds for task execution.
	TimeoutMs() int
}

// SwarmTask is the core task representation shared across the swarm.
// It is serialized to JSON and stored in Redis queues.
type SwarmTask struct {
	TaskID     string          `json:"task_id"`
	GraphID    string          `json:"graph_id"`
	NodeID     string          `json:"node_id"`
	Type       string          `json:"type"`
	Status     string          `json:"status"`
	Priority   int             `json:"priority"`
	WorkerID   string          `json:"worker_id,omitempty"`
	Input      map[string]any  `json:"input,omitempty"`
	Output     map[string]any  `json:"output,omitempty"`
	Retries    int             `json:"retries"`
	MaxRetries int             `json:"max_retries"`
	TimeoutMs  int             `json:"timeout_ms"`
	StolenFrom string          `json:"stolen_from,omitempty"`
}

// InputMap is a convenience type for agent input data.
type InputMap map[string]any

// OutputMap is a convenience type for agent output data.
type OutputMap map[string]any

// TaskStatus represents the current state of a task in the swarm.
type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
	TaskStatusSkipped   TaskStatus = "skipped"
)

// ErrNotImplemented is returned when an agent method is not yet implemented.
var ErrNotImplemented = fmt.Errorf("agent method not implemented")