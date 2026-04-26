package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
)

const (
	batchSize   = 100
	syncTimeout  = 30 * time.Second
)

// SyncManager handles periodic syncing from Redis to SQLite.
type SyncManager struct {
	redis    *RedisLayer
	sqlite   *SQLiteLayer
	interval time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup
	running  bool
	mu       sync.Mutex
}

// NewSyncManager creates a new sync manager.
func NewSyncManager(redis *RedisLayer, sqlite *SQLiteLayer, interval time.Duration) *SyncManager {
	if interval <= 0 {
		interval = 60 * time.Second
	}
	return &SyncManager{
		redis:    redis,
		sqlite:   sqlite,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the periodic sync loop.
func (sm *SyncManager) Start(ctx context.Context) {
	sm.mu.Lock()
	if sm.running {
		sm.mu.Unlock()
		return
	}
	sm.running = true
	sm.mu.Unlock()

	sm.wg.Add(1)
	go sm.syncLoop(ctx)
	log.Printf("[sync] manager started with interval %v", sm.interval)
}

// Stop stops the periodic sync loop.
func (sm *SyncManager) Stop() {
	sm.mu.Lock()
	if !sm.running {
		sm.mu.Unlock()
		return
	}
	sm.running = false
	sm.mu.Unlock()

	close(sm.stopCh)
	sm.wg.Wait()
	log.Println("[sync] manager stopped")
}

// syncLoop runs the periodic sync.
func (sm *SyncManager) syncLoop(ctx context.Context) {
	defer sm.wg.Done()

	ticker := time.NewTicker(sm.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-sm.stopCh:
			return
		case <-ticker.C:
			if err := sm.SyncToSQLite(ctx); err != nil {
				log.Printf("[sync] error: %v", err)
			}
		}
	}
}

// SyncToSQLite syncs Redis state to SQLite cold storage.
func (sm *SyncManager) SyncToSQLite(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, syncTimeout)
	defer cancel()

	log.Println("[sync] starting sync to SQLite")
	start := time.Now()

	// Sync dirty users
	if err := sm.syncDirtyUsers(ctx); err != nil {
		log.Printf("[sync] sync dirty users error: %v", err)
	}

	// Sync dirty conversations
	if err := sm.syncDirtyConversations(ctx); err != nil {
		log.Printf("[sync] sync dirty conversations error: %v", err)
	}

	// Sync dirty billing events
	if err := sm.syncDirtyBillingEvents(ctx); err != nil {
		log.Printf("[sync] sync dirty billing events error: %v", err)
	}

	// Sync dirty audit logs
	if err := sm.syncDirtyAuditLogs(ctx); err != nil {
		log.Printf("[sync] sync dirty audit logs error: %v", err)
	}

	log.Printf("[sync] completed in %v", time.Since(start))
	return nil
}

// syncDirtyUsers syncs dirty users in batch from Redis to SQLite.
func (sm *SyncManager) syncDirtyUsers(ctx context.Context) error {
	for {
		phones, err := sm.redis.GetDirtyUsers(ctx, batchSize)
		if err != nil {
			return fmt.Errorf("get dirty users: %w", err)
		}
		if len(phones) == 0 {
			break
		}

		for _, phone := range phones {
			state, err := sm.redis.GetUserState(ctx, phone)
			if err != nil {
				log.Printf("[sync] get user state %s: %v", phone, err)
				continue
			}
			if state == nil {
				continue
			}

			user := &User{
				Phone:    phone,
				Status:   state["status"],
				Plan:     state["plan"],
				CreatedAt: time.Now().Unix(),
			}
			if total, ok := state["total_requests"]; ok {
				fmt.Sscanf(total, "%d", &user.TotalRequests)
			}

			if err := sm.sqlite.PersistUser(ctx, user); err != nil {
				log.Printf("[sync] persist user %s: %v", phone, err)
			}
		}
	}
	return nil
}

// syncDirtyConversations syncs dirty conversations in batch from Redis to SQLite.
func (sm *SyncManager) syncDirtyConversations(ctx context.Context) error {
	for {
		phones, err := sm.redis.GetDirtyConversations(ctx, batchSize)
		if err != nil {
			return fmt.Errorf("get dirty conversations: %w", err)
		}
		if len(phones) == 0 {
			break
		}

		for _, phone := range phones {
			messages, err := sm.redis.GetConversation(ctx, phone)
			if err != nil {
				log.Printf("[sync] get conversation %s: %v", phone, err)
				continue
			}

			for _, msg := range messages {
				conv := &Conversation{
					Phone:   phone,
					Role:    msg["role"],
					Content: msg["content"],
				}
				if ts, ok := msg["timestamp"]; ok {
					fmt.Sscanf(ts, "%d", &conv.Timestamp)
				} else {
					conv.Timestamp = time.Now().Unix()
				}

				if err := sm.sqlite.PersistConversation(ctx, conv); err != nil {
					log.Printf("[sync] persist conversation %s: %v", phone, err)
				}
			}
		}
	}
	return nil
}

// syncDirtyBillingEvents syncs dirty billing events from Redis to SQLite.
func (sm *SyncManager) syncDirtyBillingEvents(ctx context.Context) error {
	// Billing events are stored as hash at billing:event:{event_id}
	key := "billing_events_queue"
	events, err := sm.redis.client.LRange(ctx, key, 0, batchSize-1).Result()
	if err != nil {
		return fmt.Errorf("get billing events queue: %w", err)
	}

	if len(events) == 0 {
		return nil
	}

	// Remove the processed events
	if len(events) > 0 {
		sm.redis.client.LTrim(ctx, key, int64(len(events)), -1)
	}

	for _, eventData := range events {
		var event BillingEvent
		if err := json.Unmarshal([]byte(eventData), &event); err != nil {
			log.Printf("[sync] unmarshal billing event: %v", err)
			continue
		}

		if err := sm.sqlite.PersistBillingEvent(ctx, &event); err != nil {
			log.Printf("[sync] persist billing event %s: %v", event.EventID, err)
		}
	}
	return nil
}

// syncDirtyAuditLogs syncs dirty audit logs from Redis to SQLite.
func (sm *SyncManager) syncDirtyAuditLogs(ctx context.Context) error {
	// Audit logs are stored as hash at audit:{graph_id}
	for {
		graphIDs, err := sm.redis.GetDirtyAuditLogs(ctx, batchSize)
		if err != nil {
			return fmt.Errorf("get dirty audit logs: %w", err)
		}
		if len(graphIDs) == 0 {
			break
		}

		for _, graphID := range graphIDs {
			entry, err := sm.getAuditLogEntry(ctx, graphID)
			if err != nil {
				log.Printf("[sync] get audit log %s: %v", graphID, err)
				continue
			}
			if entry == nil {
				continue
			}

			if err := sm.sqlite.PersistAuditLog(ctx, entry); err != nil {
				log.Printf("[sync] persist audit log %s: %v", graphID, err)
			}
		}
	}
	return nil
}

// getAuditLogEntry retrieves an audit log entry from Redis.
func (sm *SyncManager) getAuditLogEntry(ctx context.Context, graphID string) (*AuditLogEntry, error) {
	key := fmt.Sprintf("audit:%s", graphID)
	data, err := sm.redis.client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, nil
	}

	entry := &AuditLogEntry{GraphID: graphID}
	if agent, ok := data["agent"]; ok {
		entry.Agent = agent
	}
	if action, ok := data["action"]; ok {
		entry.Action = action
	}
	if duration, ok := data["duration_ms"]; ok {
		fmt.Sscanf(duration, "%d", &entry.DurationMs)
	}
	if ts, ok := data["timestamp"]; ok {
		fmt.Sscanf(ts, "%d", &entry.Timestamp)
	} else {
		entry.Timestamp = time.Now().Unix()
	}

	return entry, nil
}

// syncUsers syncs user states from Redis to SQLite.
func (sm *SyncManager) syncUsers(ctx context.Context) error {
	// Get all user keys from Redis
	// In production, this would use SCAN to iterate keys
	// For now, we rely on callers to track which users need syncing

	// This is a placeholder - actual implementation would need
	// to track dirty users or scan for user:* keys
	return nil
}

// syncConversations syncs conversation history from Redis to SQLite.
func (sm *SyncManager) syncConversations(ctx context.Context) error {
	// Similar to syncUsers - would need to track dirty conversations
	return nil
}

// SyncUser explicitly syncs a single user to SQLite.
func (sm *SyncManager) SyncUser(ctx context.Context, phone string) error {
	// Get user state from Redis
	state, err := sm.redis.GetUserState(ctx, phone)
	if err != nil {
		return fmt.Errorf("get user state: %w", err)
	}

	if state == nil {
		return nil
	}

	// Build user record
	user := &User{
		Phone:    phone,
		Status:   state["status"],
		Plan:     state["plan"],
		CreatedAt: time.Now().Unix(),
	}

	if total, ok := state["total_requests"]; ok {
		fmt.Sscanf(total, "%d", &user.TotalRequests)
	}

	return sm.sqlite.PersistUser(ctx, user)
}

// SyncConversationBatch syncs conversation messages in batch.
func (sm *SyncManager) SyncConversationBatch(ctx context.Context, phone string, messages []map[string]string) error {
	if len(messages) == 0 {
		return nil
	}

	for _, msg := range messages {
		conv := &Conversation{
			Phone:     phone,
			Role:      msg["role"],
			Content:   msg["content"],
			Timestamp: time.Now().Unix(),
		}
		if ts, ok := msg["timestamp"]; ok {
			fmt.Sscanf(ts, "%d", &conv.Timestamp)
		}

		if err := sm.sqlite.PersistConversation(ctx, conv); err != nil {
			return fmt.Errorf("persist conversation: %w", err)
		}
	}

	return nil
}
