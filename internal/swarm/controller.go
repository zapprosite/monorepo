package swarm

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

// SwarmController orchestrates the execution graph, scheduling, and maintenance loops.
type SwarmController struct {
	ID       string
	redis    *RedisClient
	registry *AgentRegistry

	graphs map[string]*ExecutionGraph
	mu     sync.RWMutex

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	schedulerTick     time.Duration
	orphanTick        time.Duration
	rebalanceTick     time.Duration
	metricsTick       time.Duration
	heartbeatInterval time.Duration
}

// NewSwarmController creates a new SwarmController.
func NewSwarmController(redis *RedisClient, registry *AgentRegistry) *SwarmController {
	ctx, cancel := context.WithCancel(context.Background())
	c := &SwarmController{
		ID:                uuid.New().String(),
		redis:             redis,
		registry:          registry,
		graphs:            make(map[string]*ExecutionGraph),
		ctx:               ctx,
		cancel:            cancel,
		schedulerTick:     100 * time.Millisecond,
		orphanTick:       10 * time.Second,
		rebalanceTick:    30 * time.Second,
		metricsTick:       5 * time.Second,
		heartbeatInterval: 5 * time.Second,
	}
	return c
}

// Run starts all controller loops. It blocks until the context is cancelled.
func (c *SwarmController) Run() error {
	log.Printf("[controller:%s] starting", c.ID)

	c.wg.Add(1)
	go c.SchedulerLoop()

	c.wg.Add(1)
	go c.OrphanWatchdog()

	c.wg.Add(1)
	go c.RebalanceLoop()

	c.wg.Add(1)
	go c.MetricsCollector()

	<-c.ctx.Done()
	log.Printf("[controller:%s] shutting down", c.ID)
	return nil
}

// Stop gracefully stops all loops.
func (c *SwarmController) Stop() {
	log.Printf("[controller:%s] stopping...", c.ID)
	c.cancel()
	c.wg.Wait()
	log.Printf("[controller:%s] stopped", c.ID)
}

// RegisterGraph adds a graph to the controller's registry.
func (c *SwarmController) RegisterGraph(g *ExecutionGraph) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.graphs[g.ID] = g
	if c.registry != nil {
		c.registry.RegisterGraph(g)
	}
}

// GetGraph returns a graph by ID.
func (c *SwarmController) GetGraph(id string) (*ExecutionGraph, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	g, ok := c.graphs[id]
	return g, ok
}

// SchedulerLoop resolves ready nodes and enqueues them to Redis.
func (c *SwarmController) SchedulerLoop() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.schedulerTick)
	defer ticker.Stop()

	log.Printf("[controller:%s] scheduler loop started (tick=%v)", c.ID, c.schedulerTick)

	for {
		select {
		case <-c.ctx.Done():
			log.Printf("[controller:%s] scheduler loop exiting", c.ID)
			return
		case <-ticker.C:
			c.resolveAndEnqueue()
		}
	}
}

// resolveAndEnqueue finds ready nodes and enqueues them to their respective queues.
func (c *SwarmController) resolveAndEnqueue() {
	c.mu.RLock()
	graphs := make(map[string]*ExecutionGraph, len(c.graphs))
	for k, v := range c.graphs {
		graphs[k] = v
	}
	c.mu.RUnlock()

	for graphID, graph := range graphs {
		ready := graph.resolveReady()
		for _, node := range ready {
			if err := c.enqueueNode(graphID, node); err != nil {
				log.Printf("[controller:%s] enqueue error for node %s: %v", c.ID, node.ID, err)
			}
		}
	}
}

// enqueueNode creates a Task and pushes it to the Redis queue.
func (c *SwarmController) enqueueNode(graphID string, node *GraphNode) error {
	agentType := NodeAgentType(node.ID)

	task := &Task{
		TaskID:     fmt.Sprintf("%s-%s", graphID, node.ID),
		GraphID:    graphID,
		NodeID:     node.ID,
		Type:       agentType,
		Status:     "pending",
		MaxRetries: node.MaxRetries,
		TimeoutMs:  int(node.Timeout.Duration.Milliseconds()),
	}

	if err := c.redis.PushTask(c.ctx, agentType, task); err != nil {
		return fmt.Errorf("push task: %w", err)
	}

	log.Printf("[controller:%s] enqueued node %s (graph=%s, agent=%s)", c.ID, node.ID, graphID, agentType)
	return nil
}

// OrphanWatchdog detects workers that have missed heartbeats and redistributes their tasks.
func (c *SwarmController) OrphanWatchdog() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.orphanTick)
	defer ticker.Stop()

	log.Printf("[controller:%s] orphan watchdog started (tick=%v)", c.ID, c.orphanTick)

	for {
		select {
		case <-c.ctx.Done():
			log.Printf("[controller:%s] orphan watchdog exiting", c.ID)
			return
		case <-ticker.C:
			c.checkOrphans()
		}
	}
}

// checkOrphans finds dead workers and requeues their tasks.
func (c *SwarmController) checkOrphans() {
	alive, err := c.redis.GetAliveAgents(c.ctx)
	if err != nil {
		log.Printf("[controller:%s] get alive agents error: %v", c.ID, err)
		return
	}

	aliveMap := make(map[string]bool, len(alive))
	for _, a := range alive {
		aliveMap[a.WorkerID] = true
	}

	registryWorkers := c.registry.Workers()

	for _, w := range registryWorkers {
		if !aliveMap[w.ID] {
			log.Printf("[controller:%s] detected dead worker %s, redistributing tasks", c.ID, w.ID)
			c.redistributeWorkerTasks(w.AgentType)
		}
	}
}

// redistributeWorkerTasks moves tasks from a dead worker's processing hash back to the queue.
func (c *SwarmController) redistributeWorkerTasks(agentType string) {
	tasks, err := c.redis.GetProcessingTasks(c.ctx, agentType)
	if err != nil {
		log.Printf("[controller:%s] get processing tasks error: %v", c.ID, err)
		return
	}

	for _, task := range tasks {
		task.Status = "pending"
		task.WorkerID = nil
		if err := c.redis.PushTask(c.ctx, agentType, task); err != nil {
			log.Printf("[controller:%s] requeue task %s error: %v", c.ID, task.TaskID, err)
		} else {
			log.Printf("[controller:%s] requeued orphaned task %s", c.ID, task.TaskID)
		}
	}
}

// RebalanceLoop monitors queue depths and triggers rebalancing.
func (c *SwarmController) RebalanceLoop() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.rebalanceTick)
	defer ticker.Stop()

	log.Printf("[controller:%s] rebalancer started (tick=%v)", c.ID, c.rebalanceTick)

	for {
		select {
		case <-c.ctx.Done():
			log.Printf("[controller:%s] rebalancer exiting", c.ID)
			return
		case <-ticker.C:
			c.checkRebalance()
		}
	}
}

// checkRebalance checks for congestion and publishes rebalance events.
func (c *SwarmController) checkRebalance() {
	agentTypes := []string{"intake", "classifier", "access_control", "rag", "ranking", "response", "billing", "memory"}

	var congested []string
	for _, at := range agentTypes {
		length, err := c.redis.GetQueueLength(c.ctx, at)
		if err != nil {
			continue
		}
		if length > 10 {
			congested = append(congested, fmt.Sprintf("%s:%d", at, length))
		}
	}

	if len(congested) > 0 {
		log.Printf("[controller:%s] congestion detected: %v", c.ID, congested)
		c.redis.PublishRebalance(c.ctx, fmt.Sprintf("congestion: %v", congested))
	}
}

// MetricsCollector aggregates swarm metrics and logs them periodically.
func (c *SwarmController) MetricsCollector() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.metricsTick)
	defer ticker.Stop()

	log.Printf("[controller:%s] metrics collector started (tick=%v)", c.ID, c.metricsTick)

	for {
		select {
		case <-c.ctx.Done():
			log.Printf("[controller:%s] metrics collector exiting", c.ID)
			return
		case <-ticker.C:
			c.collectMetrics()
		}
	}
}

// collectMetrics gathers and logs current swarm metrics.
func (c *SwarmController) collectMetrics() {
	c.mu.RLock()
	totalGraphs := len(c.graphs)
	var totalNodes, pendingNodes, runningNodes, completedNodes int
	for _, g := range c.graphs {
		for _, n := range g.Nodes {
			totalNodes++
			switch n.Status {
			case NodeStatusPending:
				pendingNodes++
			case NodeStatusRunning:
				runningNodes++
			case NodeStatusCompleted:
				completedNodes++
			}
		}
	}
	c.mu.RUnlock()

	queueLens := make(map[string]int64)
	for _, at := range []string{"intake", "classifier", "access_control", "rag", "ranking", "response", "billing", "memory"} {
		l, _ := c.redis.GetQueueLength(c.ctx, at)
		queueLens[at] = l
	}

	log.Printf("[controller:%s] metrics: graphs=%d nodes=%d pending=%d running=%d completed=%d queues=%v",
		c.ID, totalGraphs, totalNodes, pendingNodes, runningNodes, completedNodes, queueLens)
}

// ProcessEvent handles incoming Pub/Sub events.
func (c *SwarmController) ProcessEvent(eventType string, payload []byte) error {
	switch eventType {
	case ChannelTaskCompleted:
		return c.onTaskCompleted(payload)
	case ChannelAgentStatus:
		return c.onAgentStatus(payload)
	case ChannelGraphDone:
		return c.onGraphDone(payload)
	case ChannelRebalance:
		return c.onRebalance(payload)
	default:
		return fmt.Errorf("unknown event type: %s", eventType)
	}
}

func (c *SwarmController) onTaskCompleted(payload []byte) error {
	var event struct {
		TaskID   string `json:"task_id"`
		WorkerID string `json:"worker_id"`
	}
	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("unmarshal task_completed: %w", err)
	}
	log.Printf("[controller:%s] task completed: %s", c.ID, event.TaskID)
	return nil
}

func (c *SwarmController) onAgentStatus(payload []byte) error {
	var event struct {
		WorkerID string `json:"worker_id"`
		Status   string `json:"status"`
	}
	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("unmarshal agent_status: %w", err)
	}
	log.Printf("[controller:%s] agent status: %s -> %s", c.ID, event.WorkerID, event.Status)
	return nil
}

func (c *SwarmController) onGraphDone(payload []byte) error {
	var event struct {
		GraphID string `json:"graph_id"`
	}
	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("unmarshal graph_done: %w", err)
	}
	log.Printf("[controller:%s] graph done: %s", c.ID, event.GraphID)
	c.mu.Lock()
	delete(c.graphs, event.GraphID)
	c.mu.Unlock()
	return nil
}

func (c *SwarmController) onRebalance(payload []byte) error {
	var event struct {
		Reason string `json:"reason"`
	}
	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("unmarshal rebalance: %w", err)
	}
	log.Printf("[controller:%s] rebalance triggered: %s", c.ID, event.Reason)
	return nil
}

// HandleGraphEvent routes a graph event to the appropriate handler.
func (c *SwarmController) HandleGraphEvent(graphID string, nodeID string, status NodeStatus, output map[string]any) error {
	c.mu.RLock()
	graph, ok := c.graphs[graphID]
	c.mu.RUnlock()
	if !ok {
		return fmt.Errorf("graph %q not found", graphID)
	}

	if err := graph.SetNodeStatus(nodeID, status); err != nil {
		return err
	}

	if status == NodeStatusCompleted && output != nil {
		data, _ := json.Marshal(output)
		graph.SetState(nodeID+".output", data)

		// Evaluate conditional skip rules (e.g., access_control=block skips rag+ranking)
		graph.EvaluateConditions(nodeID, output)
	}

	if graph.IsComplete() {
		c.redis.PublishGraphDone(c.ctx, graphID)
	}

	return nil
}

// StartPubSub subscribes to swarm events and processes them.
func (c *SwarmController) StartPubSub() {
	c.wg.Add(1)
	go func() {
		defer c.wg.Done()

		pubsub := c.redis.Subscribe(c.ctx,
			ChannelTaskCompleted,
			ChannelAgentStatus,
			ChannelGraphDone,
			ChannelRebalance,
		)
		defer pubsub.Close()

		ch := pubsub.Channel()
		log.Printf("[controller:%s] pubsub subscribed to swarm events", c.ID)

		for {
			select {
			case <-c.ctx.Done():
				return
			case msg := <-ch:
				if err := c.ProcessEvent(msg.Channel, []byte(msg.Payload)); err != nil {
					log.Printf("[controller:%s] process event error: %v", c.ID, err)
				}
			}
		}
	}()
}

// Workers returns the current worker list from the registry.
func (c *SwarmController) Workers() []WorkerStatus {
	if c.registry == nil {
		return nil
	}
	return c.registry.Workers()
}

// Graphs returns a snapshot of all managed graphs.
func (c *SwarmController) Graphs() map[string]*ExecutionGraph {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make(map[string]*ExecutionGraph, len(c.graphs))
	for k, v := range c.graphs {
		result[k] = v
	}
	return result
}
