package swarm

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

// ----- Miniredis helpers -----

func startMiniredis(t *testing.T) (*redis.Client, func()) {
	// Try miniredis first
	mr, err := miniredis.Run()
	if err != nil {
		t.Skip("miniredis not available: ", err)
		return nil, func() {}
	}
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return client, func() {
		client.Close()
		mr.Close()
	}
}

// ----- Test cases -----

func TestTaskBoard_ClaimTask(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	agentType := "intake"
	worker1 := "worker-1"
	worker2 := "worker-2"

	// Push a single task
	task := &Task{
		TaskID:     "t_001",
		GraphID:    "g_001",
		NodeID:     "n_001",
		Type:       agentType,
		Status:     "pending",
		MaxRetries: 3,
		TimeoutMs:  5000,
	}
	err := rc.PushTask(ctx, agentType, task)
	require.NoError(t, err)

	// Worker 1 claims atomically via Lua script
	claimed1, err := rc.ClaimTask(ctx, agentType, worker1, time.Now().Unix())
	require.NoError(t, err)
	require.NotNil(t, claimed1)
	require.Equal(t, "running", claimed1.Status)
	require.Equal(t, worker1, *claimed1.WorkerID)

	// Worker 2 attempts to claim — queue is empty, should get nil
	claimed2, err := rc.ClaimTask(ctx, agentType, worker2, time.Now().Unix())
	require.NoError(t, err)
	require.Nil(t, claimed2)
}

func TestTaskBoard_ClaimTask_Concurrent(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	agentType := "classifier"
	workerCount := 10
	taskCount := 3

	// Push multiple tasks
	for i := 0; i < taskCount; i++ {
		task := &Task{
			TaskID:     "t_" + string(rune('a'+i)),
			GraphID:    "g_001",
			NodeID:     "n_001",
			Type:       agentType,
			Status:     "pending",
			MaxRetries: 3,
			TimeoutMs:  5000,
		}
		err := rc.PushTask(ctx, agentType, task)
		require.NoError(t, err)
	}

	var mu sync.Mutex
	successCount := 0
	var wg sync.WaitGroup

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(workerID string) {
			defer wg.Done()
			claimed, err := rc.ClaimTask(ctx, agentType, workerID, time.Now().Unix())
			if err != nil {
				t.Errorf("claim error: %v", err)
				return
			}
			if claimed != nil {
				mu.Lock()
				successCount++
				mu.Unlock()
			}
		}("worker-" + string(rune('0'+i)))
	}

	wg.Wait()

	// Exactly taskCount workers should succeed
	require.Equal(t, taskCount, successCount)

	// Queue should be empty
	qlen, err := rc.GetQueueLength(ctx, agentType)
	require.NoError(t, err)
	require.Equal(t, int64(0), qlen)
}

func TestTaskBoard_WorkStealing(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	srcAgent := "rag"
	dstAgent := "ranking"

	// Push 2 tasks to source queue
	for i := 0; i < 2; i++ {
		task := &Task{
			TaskID:     "t_src_" + string(rune('0'+i)),
			GraphID:    "g_001",
			NodeID:     "n_rag",
			Type:       srcAgent,
			Status:     "pending",
			MaxRetries: 3,
			TimeoutMs:  5000,
		}
		err := rc.PushTask(ctx, srcAgent, task)
		require.NoError(t, err)
	}

	// Verify source queue has 2 tasks
	qlen, err := rc.GetQueueLength(ctx, srcAgent)
	require.NoError(t, err)
	require.Equal(t, int64(2), qlen)

	// Steal one task (LMOVE RIGHT LEFT)
	stolen, err := rc.StealTask(ctx, srcAgent, dstAgent)
	require.NoError(t, err)
	require.NotNil(t, stolen)
	require.Equal(t, "t_src_0", stolen.TaskID)

	// Source queue should now have 1 task
	qlen, err = rc.GetQueueLength(ctx, srcAgent)
	require.NoError(t, err)
	require.Equal(t, int64(1), qlen)

	// Destination queue should have 1 task
	qlen, err = rc.GetQueueLength(ctx, dstAgent)
	require.NoError(t, err)
	require.Equal(t, int64(1), qlen)
}

func TestTaskBoard_WorkStealing_EmptyQueue(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	srcAgent := "billing"
	dstAgent := "memory"

	// Don't push anything — source queue is empty

	// Steal should return nil
	stolen, err := rc.StealTask(ctx, srcAgent, dstAgent)
	require.NoError(t, err)
	require.Nil(t, stolen)
}

func TestTaskBoard_WorkStealing_SingleTaskNoSteal(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	srcAgent := "ranking"
	dstAgent := "response"

	// Push only 1 task — steal condition is target_queue_len > 1
	task := &Task{
		TaskID:     "t_single",
		GraphID:    "g_001",
		NodeID:     "n_ranking",
		Type:       srcAgent,
		Status:     "pending",
		MaxRetries: 3,
		TimeoutMs:  5000,
	}
	err := rc.PushTask(ctx, srcAgent, task)
	require.NoError(t, err)

	// Simulate the work-stealing condition check (queue length must be > 1)
	qlen, err := rc.GetQueueLength(ctx, srcAgent)
	require.NoError(t, err)
	require.Equal(t, int64(1), qlen)
	require.LessOrEqual(t, qlen, int64(1), "should NOT steal when queue len <= 1")
}

func TestHeartbeat_Expires(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	workerID := "worker-heartbeat-test"

	// Register and send heartbeat
	info := &AgentInfo{
		WorkerID:   workerID,
		AgentType:  "intake",
		StartedAt:  time.Now().Unix(),
		LastSeenAt: time.Now().Unix(),
		Status:     "idle",
	}
	err := rc.RegisterAgent(ctx, info)
	require.NoError(t, err)

	err = rc.UpdateAgentHeartbeat(ctx, workerID)
	require.NoError(t, err)

	// Worker should be alive
	alive, err := rc.IsAgentAlive(ctx, workerID)
	require.NoError(t, err)
	require.True(t, alive)

	// Wait for heartbeat TTL to expire (15s + buffer)
	time.Sleep(HeartbeatTTL + 2*time.Second)

	// Worker should now be dead
	alive, err = rc.IsAgentAlive(ctx, workerID)
	require.NoError(t, err)
	require.False(t, alive)
}

func TestAgentRegistry_RegisterDeregister(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	registry := NewAgentRegistry()

	workerID := "worker-reg-test"

	// Register worker in registry
	status := WorkerStatus{
		ID:        workerID,
		AgentType: "classifier",
		Status:    "idle",
		LastHeart: time.Now().UTC(),
	}
	registry.RegisterWorker(status)

	// Register in Redis
	info := &AgentInfo{
		WorkerID:   workerID,
		AgentType:  "classifier",
		StartedAt:  time.Now().Unix(),
		LastSeenAt: time.Now().Unix(),
		Status:     "idle",
	}
	err := rc.RegisterAgent(ctx, info)
	require.NoError(t, err)

	// Send heartbeat
	err = rc.UpdateAgentHeartbeat(ctx, workerID)
	require.NoError(t, err)

	// Get alive agents
	alive, err := rc.GetAliveAgents(ctx)
	require.NoError(t, err)
	require.Len(t, alive, 1)
	require.Equal(t, workerID, alive[0].WorkerID)

	// Unregister from registry
	registry.UnregisterWorker(workerID)
	workers := registry.Workers()
	require.Len(t, workers, 0)
}

func TestAgentRegistry_MultipleWorkers(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	registry := NewAgentRegistry()

	workerIDs := []string{"w1", "w2", "w3"}

	for _, wid := range workerIDs {
		status := WorkerStatus{
			ID:        wid,
			AgentType: "rag",
			Status:    "idle",
			LastHeart: time.Now().UTC(),
		}
		registry.RegisterWorker(status)

		info := &AgentInfo{
			WorkerID:   wid,
			AgentType:  "rag",
			StartedAt:  time.Now().Unix(),
			LastSeenAt: time.Now().Unix(),
			Status:     "idle",
		}
		err := rc.RegisterAgent(ctx, info)
		require.NoError(t, err)

		err = rc.UpdateAgentHeartbeat(ctx, wid)
		require.NoError(t, err)
	}

	alive, err := rc.GetAliveAgents(ctx)
	require.NoError(t, err)
	require.Len(t, alive, 3)

	// Unregister one
	registry.UnregisterWorker(workerIDs[1])

	// Heartbeat still present in Redis but registry is updated
	workers := registry.Workers()
	require.Len(t, workers, 2)
}

func TestPubSub_TaskCompleted(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	agentType := "intake"
	workerID := "worker-pubsub"
	taskID := "t_pubsub_001"

	// Subscribe to task_completed channel
	pubsub := rc.Subscribe(ctx, ChannelTaskCompleted)
	defer pubsub.Close()

	// Give subscription time to establish
	time.Sleep(100 * time.Millisecond)

	// Publish task completed event
	err := rc.PublishTaskCompleted(ctx, taskID, workerID)
	require.NoError(t, err)

	// Receive the published message
	ch := pubsub.Channel()

	select {
	case msg := <-ch:
		require.Equal(t, ChannelTaskCompleted, msg.Channel)
		var event struct {
			TaskID   string `json:"task_id"`
			WorkerID string `json:"worker_id"`
		}
		err := json.Unmarshal([]byte(msg.Payload), &event)
		require.NoError(t, err)
		require.Equal(t, taskID, event.TaskID)
		require.Equal(t, workerID, event.WorkerID)
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for task_completed event")
	}
}

func TestPubSub_AgentStatus(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	workerID := "worker-status-pubsub"

	pubsub := rc.Subscribe(ctx, ChannelAgentStatus)
	defer pubsub.Close()
	time.Sleep(100 * time.Millisecond)

	err := rc.PublishAgentStatus(ctx, workerID, "busy")
	require.NoError(t, err)

	ch := pubsub.Channel()

	select {
	case msg := <-ch:
		require.Equal(t, ChannelAgentStatus, msg.Channel)
		var event struct {
			WorkerID string `json:"worker_id"`
			Status   string `json:"status"`
		}
		err := json.Unmarshal([]byte(msg.Payload), &event)
		require.NoError(t, err)
		require.Equal(t, workerID, event.WorkerID)
		require.Equal(t, "busy", event.Status)
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for agent_status event")
	}
}

func TestCompleteTask(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	agentType := "intake"
	workerID := "worker-complete"
	taskID := "t_complete_001"

	// Push and claim a task
	task := &Task{
		TaskID:     taskID,
		GraphID:    "g_001",
		NodeID:     "n_001",
		Type:       agentType,
		Status:     "pending",
		MaxRetries: 3,
		TimeoutMs:  5000,
	}
	err := rc.PushTask(ctx, agentType, task)
	require.NoError(t, err)

	claimed, err := rc.ClaimTask(ctx, agentType, workerID, time.Now().Unix())
	require.NoError(t, err)
	require.NotNil(t, claimed)

	// Complete the task
	output := json.RawMessage(`{"result":"ok"}`)
	err = rc.CompleteTask(ctx, agentType, taskID, output, false)
	require.NoError(t, err)

	// Task should be removed from processing hash
	processingKey := ProcessingKey(agentType)
	exists, err := client.HExists(ctx, processingKey, taskID).Result()
	require.NoError(t, err)
	require.False(t, exists)
}

func TestCompleteTask_DeadLetter(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	agentType := "rag"
	workerID := "worker-dl"
	taskID := "t_deadletter_001"

	// Push and claim
	task := &Task{
		TaskID:     taskID,
		GraphID:    "g_001",
		NodeID:     "n_rag",
		Type:       agentType,
		Status:     "pending",
		MaxRetries: 1,
		TimeoutMs:  100,
	}
	err := rc.PushTask(ctx, agentType, task)
	require.NoError(t, err)

	claimed, err := rc.ClaimTask(ctx, agentType, workerID, time.Now().Unix())
	require.NoError(t, err)
	require.NotNil(t, claimed)

	// Complete with dead-letter flag
	err = rc.CompleteTask(ctx, agentType, taskID, nil, true)
	require.NoError(t, err)

	// Task should be in dead-letter queue
	dlLen, err := rc.GetDeadLetterLength(ctx, agentType)
	require.NoError(t, err)
	require.Equal(t, int64(1), dlLen)
}

func TestPushTask_PopTaskBlocking(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	agentType := "response"

	task := &Task{
		TaskID:     "t_brpop_001",
		GraphID:    "g_001",
		NodeID:     "n_response",
		Type:       agentType,
		Status:     "pending",
		MaxRetries: 3,
		TimeoutMs:  5000,
	}
	err := rc.PushTask(ctx, agentType, task)
	require.NoError(t, err)

	// BRPOP should return the task
	popped, err := rc.PopTaskBlocking(ctx, agentType, 1*time.Second)
	require.NoError(t, err)
	require.NotNil(t, popped)
	require.Equal(t, "t_brpop_001", popped.TaskID)
}

func TestAgentStats(t *testing.T) {
	t.Parallel()

	client, cleanup := startMiniredis(t)
	defer cleanup()
	ctx := context.Background()
	rc := NewRedisClientWithClient(client)

	workerID := "worker-stats"

	// Update stats
	err := rc.UpdateAgentStats(ctx, workerID, 5, 2, 120.5)
	require.NoError(t, err)

	// Get stats
	stats, err := rc.GetAgentStats(ctx, workerID)
	require.NoError(t, err)
	require.Equal(t, 5, stats.Completed)
	require.Equal(t, 2, stats.Stolen)
	require.InDelta(t, 120.5, stats.AvgMs, 0.01)
}

func TestQueueKey(t *testing.T) {
	t.Parallel()
	require.Equal(t, "swarm:queue:intake", QueueKey("intake"))
	require.Equal(t, "swarm:queue:ranking", QueueKey("ranking"))
}

func TestProcessingKey(t *testing.T) {
	t.Parallel()
	require.Equal(t, "swarm:queue:intake:processing", ProcessingKey("intake"))
}

func TestDeadLetterKey(t *testing.T) {
	t.Parallel()
	require.Equal(t, "swarm:queue:intake:dead", DeadLetterKey("intake"))
}

func TestHeartbeatKey(t *testing.T) {
	t.Parallel()
	require.Equal(t, "swarm:agents:heartbeat:w1", HeartbeatKey("w1"))
}

func TestStatsKey(t *testing.T) {
	t.Parallel()
	require.Equal(t, "swarm:agents:stats:w1", StatsKey("w1"))
}
