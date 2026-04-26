package swarm

import (
	"sync"
	"time"
)

// WorkerStatus represents a single worker's state.
type WorkerStatus struct {
	ID          string    `json:"id"`
	AgentType   string    `json:"agent_type"`
	Status      string    `json:"status"` // idle|busy|dead
	LastHeart   time.Time `json:"last_heartbeat"`
	CurrentTask string    `json:"current_task,omitempty"`
}

// AgentRegistry tracks active workers and graphs.
type AgentRegistry struct {
	mu      sync.RWMutex
	workers map[string]*WorkerStatus
	graphs  map[string]*ExecutionGraph
}

// NewAgentRegistry creates a new AgentRegistry.
func NewAgentRegistry() *AgentRegistry {
	return &AgentRegistry{
		workers: make(map[string]*WorkerStatus),
		graphs:  make(map[string]*ExecutionGraph),
	}
}

// Workers returns a snapshot of all worker statuses.
func (r *AgentRegistry) Workers() []WorkerStatus {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]WorkerStatus, 0, len(r.workers))
	for _, w := range r.workers {
		result = append(result, *w)
	}
	return result
}

// Graphs returns a snapshot of all graphs.
func (r *AgentRegistry) Graphs() map[string]*ExecutionGraph {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make(map[string]*ExecutionGraph, len(r.graphs))
	for k, v := range r.graphs {
		result[k] = v
	}
	return result
}

// RegisterWorker adds or updates a worker.
func (r *AgentRegistry) RegisterWorker(ws WorkerStatus) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.workers[ws.ID] = &ws
}

// UnregisterWorker removes a worker.
func (r *AgentRegistry) UnregisterWorker(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.workers, id)
}

// RegisterGraph adds or updates a graph.
func (r *AgentRegistry) RegisterGraph(g *ExecutionGraph) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.graphs[g.ID] = g
}
