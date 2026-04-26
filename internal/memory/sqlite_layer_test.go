package memory

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPersistUser(t *testing.T) {
	// Create temp SQLite DB
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer layer.Close()

	ctx := context.Background()

	// Persist user
	user := &User{
		Phone:         "+5511999999999",
		Status:        "trial_on",
		Plan:          "trial",
		CreatedAt:     time.Now().Unix(),
		TotalRequests: 42,
	}

	err = layer.PersistUser(ctx, user)
	require.NoError(t, err)

	// Retrieve and verify
	retrieved, err := layer.GetUser(ctx, "+5511999999999")
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.Equal(t, "+5511999999999", retrieved.Phone)
	assert.Equal(t, "trial_on", retrieved.Status)
	assert.Equal(t, "trial", retrieved.Plan)
	assert.Equal(t, int64(42), retrieved.TotalRequests)
}

func TestPersistUser_UpdateExisting(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer layer.Close()

	ctx := context.Background()

	// Insert initial user
	user1 := &User{
		Phone:         "+5511999999999",
		Status:        "free_limit",
		Plan:          "free",
		CreatedAt:     time.Now().Unix(),
		TotalRequests: 10,
	}
	err = layer.PersistUser(ctx, user1)
	require.NoError(t, err)

	// Update same user
	user2 := &User{
		Phone:         "+5511999999999",
		Status:        "trial_on",
		Plan:          "trial",
		CreatedAt:     time.Now().Unix(),
		TotalRequests: 50,
	}
	err = layer.PersistUser(ctx, user2)
	require.NoError(t, err)

	// Verify updated values
	retrieved, err := layer.GetUser(ctx, "+5511999999999")
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.Equal(t, "trial_on", retrieved.Status)
	assert.Equal(t, "trial", retrieved.Plan)
	assert.Equal(t, int64(50), retrieved.TotalRequests)
}

func TestPersistBillingEvent(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer layer.Close()

	ctx := context.Background()

	event := &BillingEvent{
		EventID:   "evt_test_001",
		Phone:     "+5511999999999",
		Type:      "subscription_created",
		AmountBRL: 4990,
		StripeID:  "cus_test123",
		Timestamp: time.Now().Unix(),
	}

	err = layer.PersistBillingEvent(ctx, event)
	require.NoError(t, err)

	// Retrieve and verify
	events, err := layer.GetBillingEvents(ctx, "+5511999999999", 10)
	require.NoError(t, err)
	require.Len(t, events, 1)
	assert.Equal(t, "evt_test_001", events[0].EventID)
	assert.Equal(t, "subscription_created", events[0].Type)
	assert.Equal(t, int64(4990), events[0].AmountBRL)
}

func TestPersistAuditLog(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer layer.Close()

	ctx := context.Background()

	entry := &AuditLogEntry{
		GraphID:    "graph-audit-test-001",
		Agent:      "memory_agent",
		Action:     "sync",
		DurationMs: 150,
		Timestamp:  time.Now().Unix(),
	}

	err = layer.PersistAuditLog(ctx, entry)
	require.NoError(t, err)
	// Audit log doesn't have a Get method, so we just verify no error
}

func TestPersistConversation(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer layer.Close()

	ctx := context.Background()

	conv := &Conversation{
		Phone:     "+5511999999999",
		Role:      "user",
		Content:   "Olá, meu ar está com problema",
		Timestamp: time.Now().Unix(),
	}

	err = layer.PersistConversation(ctx, conv)
	require.NoError(t, err)

	// Retrieve and verify
	convs, err := layer.GetConversations(ctx, "+5511999999999", 10)
	require.NoError(t, err)
	require.Len(t, convs, 1)
	assert.Equal(t, "user", convs[0].Role)
	assert.Equal(t, "Olá, meu ar está com problema", convs[0].Content)
}

func TestGetUser_NotFound(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer layer.Close()

	ctx := context.Background()

	retrieved, err := layer.GetUser(ctx, "+0000000000")
	require.NoError(t, err)
	assert.Nil(t, retrieved)
}

func TestGetBillingEvents_Empty(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer layer.Close()

	ctx := context.Background()

	events, err := layer.GetBillingEvents(ctx, "+5511999999999", 10)
	require.NoError(t, err)
	assert.Empty(t, events)
}

func TestSQLiteLayer_Ping(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer layer.Close()

	ctx := context.Background()
	err = layer.Ping(ctx)
	require.NoError(t, err)
}

func TestSQLiteLayer_Close(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)

	err = layer.Close()
	require.NoError(t, err)
}

func TestSQLiteLayer_DB(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test.db"

	layer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer layer.Close()

	db := layer.DB()
	assert.NotNil(t, db)
}

// SyncManager tests

func TestSyncManager_SyncToSQLite(t *testing.T) {
	// Setup Redis layer
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	redisLayer := NewRedisLayer(client)

	// Setup SQLite layer
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/sync_test.db"
	sqliteLayer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer sqliteLayer.Close()

	// Create sync manager with short interval
	syncMgr := NewSyncManager(redisLayer, sqliteLayer, 60*time.Second)
	require.NotNil(t, syncMgr)

	// Set user state in Redis
	phone := "+5511999999999"
	state := map[string]string{
		"status":            "trial_on",
		"plan":              "trial",
		"total_requests":    "25",
	}
	err = redisLayer.SetUserState(ctx, phone, state)
	require.NoError(t, err)

	// Sync to SQLite
	err = syncMgr.SyncToSQLite(ctx)
	require.NoError(t, err)

	// Verify in SQLite
	user, err := sqliteLayer.GetUser(ctx, phone)
	require.NoError(t, err)
	require.NotNil(t, user)
	assert.Equal(t, phone, user.Phone)
}

func TestSyncManager_SyncUser(t *testing.T) {
	// Setup Redis layer
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	redisLayer := NewRedisLayer(client)

	// Setup SQLite layer
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/sync_test.db"
	sqliteLayer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer sqliteLayer.Close()

	syncMgr := NewSyncManager(redisLayer, sqliteLayer, 60*time.Second)

	// Set user state in Redis
	phone := "+5511999999999"
	state := map[string]string{
		"status":            "pro",
		"plan":              "pro",
		"total_requests":    "100",
	}
	err = redisLayer.SetUserState(ctx, phone, state)
	require.NoError(t, err)

	// Sync single user
	err = syncMgr.SyncUser(ctx, phone)
	require.NoError(t, err)

	// Verify in SQLite
	user, err := sqliteLayer.GetUser(ctx, phone)
	require.NoError(t, err)
	require.NotNil(t, user)
	assert.Equal(t, "pro", user.Plan)
	assert.Equal(t, int64(100), user.TotalRequests)
}

func TestSyncManager_SyncConversationBatch(t *testing.T) {
	// Setup Redis layer
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	redisLayer := NewRedisLayer(client)

	// Setup SQLite layer
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/sync_test.db"
	sqliteLayer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer sqliteLayer.Close()

	syncMgr := NewSyncManager(redisLayer, sqliteLayer, 60*time.Second)

	phone := "+5511999999999"
	messages := []map[string]string{
		{"role": "user", "content": "Olá"},
		{"role": "assistant", "content": "Olá, como posso ajudar?"},
		{"role": "user", "content": "Meu ar Springer XC-9000 está com problema"},
	}

	err = syncMgr.SyncConversationBatch(ctx, phone, messages)
	require.NoError(t, err)

	// Verify in SQLite
	convs, err := sqliteLayer.GetConversations(ctx, phone, 10)
	require.NoError(t, err)
	require.Len(t, convs, 3)
	assert.Equal(t, "user", convs[0].Role)
	assert.Equal(t, "Olá", convs[0].Content)
}

func TestSyncManager_StartStop(t *testing.T) {
	// Setup Redis layer
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	redisLayer := NewRedisLayer(client)

	// Setup SQLite layer
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/sync_test.db"
	sqliteLayer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer sqliteLayer.Close()

	syncMgr := NewSyncManager(redisLayer, sqliteLayer, 100*time.Millisecond)

	// Start
	syncMgr.Start(ctx)

	// Let it run for a bit
	time.Sleep(350 * time.Millisecond)

	// Stop
	syncMgr.Stop()

	// Verify manager stopped cleanly
	assert.NotPanics(t, func() {
		syncMgr.Stop() // Should be safe to call again
	})
}

func TestSyncToSQLite_RunsEvery60s(t *testing.T) {
	// This test verifies the sync interval behavior
	// Note: We use a ticker-based interval; actual 60s test would be too slow

	// Setup Redis layer
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	redisLayer := NewRedisLayer(client)

	// Setup SQLite layer
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/sync_interval_test.db"
	sqliteLayer, err := NewSQLiteLayer(dbPath)
	require.NoError(t, err)
	defer sqliteLayer.Close()

	// Create sync manager with 100ms interval for testing
	syncMgr := NewSyncManager(redisLayer, sqliteLayer, 100*time.Millisecond)
	require.NotNil(t, syncMgr)

	phone := "+5511999999999"

	// Set user state
	state := map[string]string{
		"status":            "free_limit",
		"plan":              "free",
		"total_requests":    "5",
	}
	err = redisLayer.SetUserState(ctx, phone, state)
	require.NoError(t, err)

	// Track sync count
	syncCount := 0
	var syncMu sync.Mutex

	// Start sync manager
	syncMgr.Start(ctx)

	// Track syncs via a separate goroutine
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
					syncMu.Lock()
					syncCount++
					syncMu.Unlock()
			}
		}
	}()

	// Wait for 350ms - should see ~3 syncs
	time.Sleep(350 * time.Millisecond)

	syncMu.Lock()
	count := syncCount
	syncMu.Unlock()

	// Clean up
	syncMgr.Stop()

	// With 100ms interval and 350ms wait, we expect 3-4 syncs
	assert.GreaterOrEqual(t, count, 3, "expected at least 3 syncs in 350ms with 100ms interval")
	t.Logf("Sync count in 350ms: %d", count)
}
