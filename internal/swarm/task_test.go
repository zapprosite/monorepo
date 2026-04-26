package swarm

import (
	"encoding/json"
	"testing"
	"time"
)

func TestSwarmTask_JSONMarshal(t *testing.T) {
	task := SwarmTask{
		TaskID:     "task-1",
		GraphID:    "graph-1",
		NodeID:     "node-1",
		Type:       "intake",
		Status:     TaskStatusPending,
		Priority:   1,
		WorkerID:   "",
		Input:      json.RawMessage(`{"key":"value"}`),
		MaxRetries: 3,
		TimeoutMs:  5000,
		CreatedAt:  time.Now(),
	}

	data, err := json.Marshal(task)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	var restored SwarmTask
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	if restored.TaskID != task.TaskID {
		t.Errorf("TaskID mismatch: got %s, want %s", restored.TaskID, task.TaskID)
	}
	if restored.GraphID != task.GraphID {
		t.Errorf("GraphID mismatch: got %s, want %s", restored.GraphID, task.GraphID)
	}
	if restored.Status != task.Status {
		t.Errorf("Status mismatch: got %s, want %s", restored.Status, task.Status)
	}
	if restored.Priority != task.Priority {
		t.Errorf("Priority mismatch: got %d, want %d", restored.Priority, task.Priority)
	}
	if restored.MaxRetries != task.MaxRetries {
		t.Errorf("MaxRetries mismatch: got %d, want %d", restored.MaxRetries, task.MaxRetries)
	}
	if restored.TimeoutMs != task.TimeoutMs {
		t.Errorf("TimeoutMs mismatch: got %d, want %d", restored.TimeoutMs, task.TimeoutMs)
	}
}

func TestSwarmTask_TimeoutDuration(t *testing.T) {
	task := SwarmTask{TimeoutMs: 5000}
	if d := task.TimeoutDuration(); d != 5*time.Second {
		t.Errorf("TimeoutDuration() = %v, want 5s", d)
	}
}

func TestSwarmTask_MarkRunning(t *testing.T) {
	task := SwarmTask{Status: TaskStatusPending}
	task.MarkRunning("worker-1")

	if task.Status != TaskStatusRunning {
		t.Errorf("Status = %s, want %s", task.Status, TaskStatusRunning)
	}
	if task.WorkerID != "worker-1" {
		t.Errorf("WorkerID = %s, want worker-1", task.WorkerID)
	}
	if task.StartedAt == nil {
		t.Error("StartedAt is nil")
	}
}

func TestSwarmTask_MarkCompleted(t *testing.T) {
	task := SwarmTask{Status: TaskStatusRunning}
	output := json.RawMessage(`{"result":"ok"}`)
	task.MarkCompleted(output)

	if task.Status != TaskStatusCompleted {
		t.Errorf("Status = %s, want %s", task.Status, TaskStatusCompleted)
	}
	if task.Output == nil {
		t.Error("Output is nil")
	}
	if task.FinishedAt == nil {
		t.Error("FinishedAt is nil")
	}
}

func TestSwarmTask_MarkFailed(t *testing.T) {
	task := SwarmTask{Status: TaskStatusRunning, Retries: 0, MaxRetries: 3}
	task.MarkFailed()

	if task.Status != TaskStatusFailed {
		t.Errorf("Status = %s, want %s", task.Status, TaskStatusFailed)
	}
	if task.Retries != 1 {
		t.Errorf("Retries = %d, want 1", task.Retries)
	}
}

func TestSwarmTask_CanRetry(t *testing.T) {
	task := SwarmTask{Retries: 2, MaxRetries: 3}
	if !task.CanRetry() {
		t.Error("CanRetry() = false, want true")
	}

	task.Retries = 3
	if task.CanRetry() {
		t.Error("CanRetry() = true, want false")
	}
}

func TestSwarmTask_MarkSkipped(t *testing.T) {
	task := SwarmTask{Status: TaskStatusPending}
	task.MarkSkipped()

	if task.Status != TaskStatusSkipped {
		t.Errorf("Status = %s, want %s", task.Status, TaskStatusSkipped)
	}
	if task.FinishedAt == nil {
		t.Error("FinishedAt is nil")
	}
}

func TestTaskStatusConstants(t *testing.T) {
	statuses := []TaskStatus{
		TaskStatusPending,
		TaskStatusRunning,
		TaskStatusCompleted,
		TaskStatusFailed,
		TaskStatusSkipped,
	}
	expected := []string{"pending", "running", "completed", "failed", "skipped"}

	for i, s := range statuses {
		if string(s) != expected[i] {
			t.Errorf("Status[%d] = %s, want %s", i, s, expected[i])
		}
	}
}

func TestNodeStatusConstants(t *testing.T) {
	statuses := []NodeStatus{
		NodeStatusPending,
		NodeStatusRunning,
		NodeStatusCompleted,
		NodeStatusFailed,
		NodeStatusSkipped,
	}
	expected := []string{"pending", "running", "completed", "failed", "skipped"}

	for i, s := range statuses {
		if string(s) != expected[i] {
			t.Errorf("NodeStatus[%d] = %s, want %s", i, s, expected[i])
		}
	}
}