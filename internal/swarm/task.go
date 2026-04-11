package swarm

import (
	"encoding/json"
	"time"
)

// TaskStatus represents the current state of a task.
type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
	TaskStatusSkipped   TaskStatus = "skipped"
)

// NodeStatus represents the state of a graph node.
type NodeStatus string

const (
	NodeStatusPending   NodeStatus = "pending"
	NodeStatusRunning   NodeStatus = "running"
	NodeStatusCompleted NodeStatus = "completed"
	NodeStatusFailed    NodeStatus = "failed"
	NodeStatusSkipped   NodeStatus = "skipped"
)

// SwarmTask represents a single task in the swarm execution graph.
// Tasks are pulled from Redis queues by workers.
type SwarmTask struct {
	TaskID     string          `json:"task_id"`
	GraphID    string          `json:"graph_id"`
	NodeID     string          `json:"node_id"`
	Type       string          `json:"type"`
	Status     TaskStatus      `json:"status"`
	Priority   int             `json:"priority"`
	WorkerID   string          `json:"worker_id,omitempty"`
	Input      json.RawMessage `json:"input,omitempty"`
	Output     json.RawMessage `json:"output,omitempty"`
	Retries    int             `json:"retries"`
	MaxRetries int             `json:"max_retries"`
	TimeoutMs  int             `json:"timeout_ms"`
	StolenFrom string          `json:"stolen_from,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
	StartedAt  *time.Time      `json:"started_at,omitempty"`
	FinishedAt *time.Time      `json:"finished_at,omitempty"`
}

// TimeoutDuration returns the task timeout as a time.Duration.
func (t *SwarmTask) TimeoutDuration() time.Duration {
	return time.Duration(t.TimeoutMs) * time.Millisecond
}

// MarkRunning records the start time of task execution.
func (t *SwarmTask) MarkRunning(workerID string) {
	t.WorkerID = workerID
	t.Status = TaskStatusRunning
	now := time.Now()
	t.StartedAt = &now
}

// MarkCompleted records successful completion with output.
func (t *SwarmTask) MarkCompleted(output json.RawMessage) {
	t.Output = output
	t.Status = TaskStatusCompleted
	now := time.Now()
	t.FinishedAt = &now
}

// MarkFailed records task failure and increments retry count.
func (t *SwarmTask) MarkFailed() {
	t.Retries++
	t.Status = TaskStatusFailed
	now := time.Now()
	t.FinishedAt = &now
}

// MarkSkipped marks the task as skipped (e.g., conditional gate).
func (t *SwarmTask) MarkSkipped() {
	t.Status = TaskStatusSkipped
	now := time.Now()
	t.FinishedAt = &now
}

// CanRetry returns true if the task can be retried within MaxRetries.
func (t *SwarmTask) CanRetry() bool {
	return t.Retries < t.MaxRetries
}

// MarshalJSON serializes a SwarmTask to JSON.
func (t SwarmTask) MarshalJSON() ([]byte, error) {
	type Alias SwarmTask
	return json.Marshal(&struct {
		Alias
		TimeoutDuration string `json:"timeout_duration,omitempty"`
	}{
		Alias:           Alias(t),
		TimeoutDuration: t.TimeoutDuration().String(),
	})
}

// UnmarshalJSON deserializes a SwarmTask from JSON.
func (t *SwarmTask) UnmarshalJSON(data []byte) error {
	type Alias SwarmTask
	aux := &struct {
		*Alias
		TimeoutDuration string `json:"timeout_duration,omitempty"`
	}{
		Alias: (*Alias)(t),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	if t.TimeoutMs > 0 && t.TimeoutDuration() == 0 {
		// Already set via Alias
	}
	return nil
}