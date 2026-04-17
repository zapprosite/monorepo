package swarm

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/will-zappro/hvacr-swarm/internal/agents"

	"github.com/google/uuid"
)

// TaskQueueBackend defines the interface for task queue operations.
// Implemented by *RedisClient and test mocks.
type TaskQueueBackend interface {
	// Queue operations
	PushTask(ctx context.Context, agentType string, task *Task) error
	PopTaskBlocking(ctx context.Context, agentType string, timeout time.Duration) (*Task, error)
	GetQueueLength(ctx context.Context, agentType string) (int64, error)
	ClaimTask(ctx context.Context, agentType, workerID string, timestamp int64) (*Task, error)
	StealTask(ctx context.Context, srcAgentType, destAgentType string) (*Task, error)
	CompleteTask(ctx context.Context, agentType, taskID string, output json.RawMessage, moveToDeadLetter bool) error
	// Agent registry operations
	RegisterAgent(ctx context.Context, info *AgentInfo) error
	UpdateAgentHeartbeat(ctx context.Context, workerID string) error
	GetAgentStats(ctx context.Context, workerID string) (*AgentStats, error)
	UpdateAgentStats(ctx context.Context, workerID string, completed, stolen int, avgMs float64) error
	PublishTaskCompleted(ctx context.Context, taskID, workerID string) error
}

// SwarmWorker is a single agent worker that processes tasks from Redis queues.
// It runs an infinite loop until the context is cancelled.
type SwarmWorker struct {
	ID        string
	AgentType string
	redis     TaskQueueBackend
	agent     agents.AgentInterface
	registry  *AgentRegistry

	// Task queues (work-stealing support)
	ownQueue   string
	stealOrder []string

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewSwarmWorker creates a new SwarmWorker.
func NewSwarmWorker(agent agents.AgentInterface, redis TaskQueueBackend, registry *AgentRegistry) *SwarmWorker {
	ctx, cancel := context.WithCancel(context.Background())
	w := &SwarmWorker{
		ID:         uuid.New().String(),
		AgentType:  agent.AgentType(),
		redis:      redis,
		agent:      agent,
		registry:   registry,
		ownQueue:   QueueKey(agent.AgentType()),
		stealOrder: buildStealOrder(agent.AgentType()),
		ctx:        ctx,
		cancel:     cancel,
	}
	return w
}

// buildStealOrder returns the agent types to steal from, in priority order.
func buildStealOrder(agentType string) []string {
	switch agentType {
	case "intake":
		return []string{"classifier"}
	case "classifier":
		return []string{"intake", "rag"}
	case "access_control":
		return []string{}
	case "rag":
		return []string{"ranking"}
	case "ranking":
		return []string{"rag", "response"}
	case "response":
		return []string{"ranking"}
	case "billing":
		return []string{"memory"}
	case "memory":
		return []string{"billing"}
	default:
		return []string{}
	}
}

// Run starts the worker's main loop.
func (w *SwarmWorker) Run() error {
	log.Printf("[worker:%s] starting (agent=%s)", w.ID, w.AgentType)

	if err := w.register(); err != nil {
		log.Printf("[worker:%s] register error: %v", w.ID, err)
	}

	w.wg.Add(1)
	go w.heartbeatLoop()

	for {
		select {
		case <-w.ctx.Done():
			log.Printf("[worker:%s] context cancelled, exiting", w.ID)
			w.wg.Done()
			return nil
		default:
			task, err := w.claimTask()
			if err != nil {
				if w.ctx.Err() != nil {
					w.wg.Done()
					return nil
				}
				log.Printf("[worker:%s] claim error: %v", w.ID, err)
				time.Sleep(100 * time.Millisecond)
				continue
			}
			if task == nil {
				time.Sleep(50 * time.Millisecond)
				continue
			}
			w.executeTask(task)
		}
	}
}

// register registers the worker in the agent registry and Redis.
func (w *SwarmWorker) register() error {
	now := time.Now().UTC()
	status := WorkerStatus{
		ID:         w.ID,
		AgentType:  w.AgentType,
		Status:     "idle",
		LastHeart:  now,
		CurrentTask: "",
	}
	w.registry.RegisterWorker(status)

	info := &AgentInfo{
		WorkerID:   w.ID,
		AgentType:  w.AgentType,
		StartedAt:  now.Unix(),
		LastSeenAt: now.Unix(),
		Status:     "idle",
	}
	return w.redis.RegisterAgent(w.ctx, info)
}

// deregister removes the worker from registries.
func (w *SwarmWorker) deregister() {
	if w.registry != nil {
		w.registry.UnregisterWorker(w.ID)
	}
}

// claimTask attempts to claim a task using BRPOP with work-stealing fallback.
func (w *SwarmWorker) claimTask() (*Task, error) {
	// Try own queue first (BRPOP with 100ms timeout)
	task, err := w.redis.PopTaskBlocking(w.ctx, w.AgentType, 100*time.Millisecond)
	if err != nil {
		return nil, fmt.Errorf("own queue pop: %w", err)
	}
	if task != nil {
		log.Printf("[worker:%s] claimed task %s from own queue", w.ID, task.TaskID)
		return w.markClaimed(task), nil
	}

	// Work-stealing: try other queues in steal order
	for _, target := range w.stealOrder {
		srcLen, err := w.redis.GetQueueLength(w.ctx, target)
		if err != nil {
			continue
		}
		if srcLen <= 1 {
			continue
		}

		stolen, err := w.stealTask(target)
		if err != nil {
			continue
		}
		if stolen != nil {
			log.Printf("[worker:%s] stole task %s from %s", w.ID, stolen.TaskID, target)
			stolen.StolenFrom = &target
			return w.markClaimed(stolen), nil
		}
	}

	return nil, nil
}

// markClaimed atomically marks a task as claimed in Redis processing hash.
func (w *SwarmWorker) markClaimed(task *Task) *Task {
	claimed, err := w.redis.ClaimTask(w.ctx, w.AgentType, w.ID, time.Now().Unix())
	if err != nil {
		log.Printf("[worker:%s] claim task %s error: %v", w.ID, task.TaskID, err)
		return task
	}
	if claimed != nil {
		return claimed
	}
	return task
}

// stealTask atomically moves a task from src queue to own queue.
func (w *SwarmWorker) stealTask(srcAgentType string) (*Task, error) {
	return w.redis.StealTask(w.ctx, srcAgentType, w.AgentType)
}

// executeTask runs the agent logic and handles success/failure.
func (w *SwarmWorker) executeTask(task *Task) {
	log.Printf("[worker:%s] executing task %s (graph=%s, node=%s)",
		w.ID, task.TaskID, task.GraphID, task.NodeID)

	w.registry.RegisterWorker(WorkerStatus{
		ID:          w.ID,
		AgentType:   w.AgentType,
		Status:      "busy",
		LastHeart:   time.Now().UTC(),
		CurrentTask: task.TaskID,
	})

	taskCtx, cancel := context.WithTimeout(w.ctx, time.Duration(task.TimeoutMs)*time.Millisecond)
	defer cancel()

	// Parse task.Input (json.RawMessage) to map[string]any
	var input map[string]any
	if task.Input != nil {
		_ = json.Unmarshal(task.Input, &input)
	}
	var output map[string]any
	if task.Output != nil {
		_ = json.Unmarshal(task.Output, &output)
	}
	var stolenFrom string
	if task.StolenFrom != nil {
		stolenFrom = *task.StolenFrom
	}

	agentTask := agents.SwarmTask{
		TaskID:     task.TaskID,
		GraphID:    task.GraphID,
		NodeID:     task.NodeID,
		Type:       task.Type,
		Status:     task.Status,
		WorkerID:   w.ID,
		Input:      input,
		Output:     output,
		Retries:    task.Retries,
		MaxRetries: task.MaxRetries,
		TimeoutMs:  task.TimeoutMs,
		StolenFrom: stolenFrom,
	}

	start := time.Now()
	agentOutput, err := w.agent.Execute(taskCtx, &agentTask)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		log.Printf("[worker:%s] task %s error: %v (took %dms)", w.ID, task.TaskID, err, elapsed)
		w.handleFailure(task, err.Error())
		return
	}

	log.Printf("[worker:%s] task %s completed in %dms", w.ID, task.TaskID, elapsed)
	w.handleSuccess(task, agentOutput, elapsed)
}

// handleSuccess processes a completed task.
func (w *SwarmWorker) handleSuccess(task *Task, output map[string]any, elapsedMs int64) {
	var outputJSON json.RawMessage
	if output != nil {
		data, err := json.Marshal(output)
		if err != nil {
			log.Printf("[worker:%s] marshal output error: %v", w.ID, err)
		} else {
			outputJSON = data
		}
	}

	if err := w.redis.CompleteTask(w.ctx, w.AgentType, task.TaskID, outputJSON, false); err != nil {
		log.Printf("[worker:%s] complete task error: %v", w.ID, err)
	}

	stats, _ := w.redis.GetAgentStats(w.ctx, w.ID)
	if stats != nil {
		newAvg := (stats.AvgMs*float64(stats.Completed) + float64(elapsedMs)) / float64(stats.Completed+1)
		w.redis.UpdateAgentStats(w.ctx, w.ID, stats.Completed+1, stats.Stolen, newAvg)
	} else {
		w.redis.UpdateAgentStats(w.ctx, w.ID, 1, 0, float64(elapsedMs))
	}

	w.redis.PublishTaskCompleted(w.ctx, task.TaskID, w.ID)

	w.registry.RegisterWorker(WorkerStatus{
		ID:          w.ID,
		AgentType:   w.AgentType,
		Status:      "idle",
		LastHeart:   time.Now().UTC(),
		CurrentTask: "",
	})
}

// handleFailure handles a failed task, retrying or moving to dead-letter.
func (w *SwarmWorker) handleFailure(task *Task, errMsg string) {
	task.Retries++
	task.Status = "failed"

	if task.CanRetry() {
		log.Printf("[worker:%s] task %s retry %d/%d: %s",
			w.ID, task.TaskID, task.Retries, task.MaxRetries, errMsg)
		task.Status = "pending"
		if err := w.redis.PushTask(w.ctx, w.AgentType, task); err != nil {
			log.Printf("[worker:%s] requeue error: %v", w.ID, err)
		}
	} else {
		log.Printf("[worker:%s] task %s dead-lettered after %d retries: %s",
			w.ID, task.TaskID, task.Retries, errMsg)
		if err := w.redis.CompleteTask(w.ctx, w.AgentType, task.TaskID, nil, true); err != nil {
			log.Printf("[worker:%s] dead-letter error: %v", w.ID, err)
		}
	}

	w.registry.RegisterWorker(WorkerStatus{
		ID:          w.ID,
		AgentType:   w.AgentType,
		Status:      "idle",
		LastHeart:   time.Now().UTC(),
		CurrentTask: "",
	})
}

// heartbeatLoop sends a heartbeat to Redis every 5 seconds.
func (w *SwarmWorker) heartbeatLoop() {
	defer w.wg.Done()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-w.ctx.Done():
			return
		case <-ticker.C:
			if err := w.redis.UpdateAgentHeartbeat(w.ctx, w.ID); err != nil {
				log.Printf("[worker:%s] heartbeat error: %v", w.ID, err)
			}
			w.registry.RegisterWorker(WorkerStatus{
				ID:         w.ID,
				AgentType:  w.AgentType,
				Status:     "idle",
				LastHeart:  time.Now().UTC(),
			})
		}
	}
}

// Stop gracefully stops the worker.
func (w *SwarmWorker) Stop() {
	log.Printf("[worker:%s] stopping...", w.ID)
	w.cancel()
	w.wg.Wait()
	w.deregister()
	log.Printf("[worker:%s] stopped", w.ID)
}

// MockAgent is a simple mock agent for testing.
type MockAgent struct {
	AgentTypeFunc func() string
	MaxRetriesFunc func() int
	TimeoutMsFunc  func() int
	ExecuteFunc   func(context.Context, *agents.SwarmTask) (map[string]any, error)
}

func (m *MockAgent) Execute(ctx context.Context, task *agents.SwarmTask) (map[string]any, error) {
	if m.ExecuteFunc != nil {
		return m.ExecuteFunc(ctx, task)
	}
	return nil, nil
}

func (m *MockAgent) AgentType() string {
	if m.AgentTypeFunc != nil {
		return m.AgentTypeFunc()
	}
	return "mock"
}

func (m *MockAgent) MaxRetries() int {
	if m.MaxRetriesFunc != nil {
		return m.MaxRetriesFunc()
	}
	return 3
}

func (m *MockAgent) TimeoutMs() int {
	if m.TimeoutMsFunc != nil {
		return m.TimeoutMsFunc()
	}
	return 5000
}
