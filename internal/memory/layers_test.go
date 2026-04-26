package memory

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockSearchResult creates a SearchResult for testing.
func mockSearchResult(id string, score float64, payload map[string]interface{}) SearchResult {
	return SearchResult{
		ID:      id,
		Score:   score,
		Payload: payload,
	}
}

func TestSearchResult_Struct(t *testing.T) {
	result := SearchResult{
		ID:        "doc_123",
		Score:     0.95,
		Payload:   map[string]interface{}{"text": "hello world"},
		Version:   1,
	}

	assert.Equal(t, "doc_123", result.ID)
	assert.Equal(t, 0.95, result.Score)
	assert.Equal(t, "hello world", result.Payload["text"])
	assert.Equal(t, int64(1), result.Version)
}

func TestUser_Struct(t *testing.T) {
	user := User{
		Phone:         "+5511999999999",
		Status:        "active",
		Plan:          "pro",
		CreatedAt:     1704067200,
		TotalRequests: 1000,
	}

	assert.Equal(t, "+5511999999999", user.Phone)
	assert.Equal(t, "active", user.Status)
	assert.Equal(t, "pro", user.Plan)
	assert.Equal(t, int64(1704067200), user.CreatedAt)
	assert.Equal(t, int64(1000), user.TotalRequests)
}

func TestBillingEvent_Struct(t *testing.T) {
	event := BillingEvent{
		EventID:   "evt_123",
		Phone:     "+5511999999999",
		Type:      "invoice.paid",
		AmountBRL: 4990,
		StripeID:  "in_123",
		Timestamp: 1704067200,
	}

	assert.Equal(t, "evt_123", event.EventID)
	assert.Equal(t, "+5511999999999", event.Phone)
	assert.Equal(t, "invoice.paid", event.Type)
	assert.Equal(t, int64(4990), event.AmountBRL)
	assert.Equal(t, "in_123", event.StripeID)
	assert.Equal(t, int64(1704067200), event.Timestamp)
}

func TestAuditLogEntry_Struct(t *testing.T) {
	entry := AuditLogEntry{
		GraphID:    "graph_123",
		Agent:      "intake",
		Action:     "completed",
		DurationMs: 150,
		Timestamp:  1704067200,
	}

	assert.Equal(t, "graph_123", entry.GraphID)
	assert.Equal(t, "intake", entry.Agent)
	assert.Equal(t, "completed", entry.Action)
	assert.Equal(t, int64(150), entry.DurationMs)
	assert.Equal(t, int64(1704067200), entry.Timestamp)
}

func TestConversation_Struct(t *testing.T) {
	conv := Conversation{
		Phone:     "+5511999999999",
		Role:      "user",
		Content:   "Hello, how are you?",
		Timestamp: 1704067200,
	}

	assert.Equal(t, "+5511999999999", conv.Phone)
	assert.Equal(t, "user", conv.Role)
	assert.Equal(t, "Hello, how are you?", conv.Content)
	assert.Equal(t, int64(1704067200), conv.Timestamp)
}

func TestSearchResult_WithVersion(t *testing.T) {
	result := SearchResult{
		ID:      "doc_v2",
		Score:   0.88,
		Payload: map[string]interface{}{"content": "updated text"},
		Version: 2,
	}

	assert.Equal(t, int64(2), result.Version)
	assert.Equal(t, "doc_v2", result.ID)
}

func TestUser_StatusTransitions(t *testing.T) {
	// Test various status values
	statuses := []string{"active", "suspended", "cancelled", "trial"}

	for _, status := range statuses {
		user := User{
			Phone:  "+5511999999999",
			Status: status,
			Plan:   "pro",
		}
		assert.Equal(t, status, user.Status)
	}
}

func TestBillingEvent_Types(t *testing.T) {
	// Test various billing event types
	types := []string{
		"checkout.session.completed",
		"invoice.paid",
		"invoice.payment_failed",
		"customer.subscription.deleted",
	}

	for _, typ := range types {
		event := BillingEvent{
			EventID:   "evt_123",
			Phone:     "+5511999999999",
			Type:      typ,
			AmountBRL: 4990,
		}
		assert.Equal(t, typ, event.Type)
	}
}

func TestConversation_Roles(t *testing.T) {
	// Test various conversation roles
	roles := []string{"user", "assistant", "system"}

	for _, role := range roles {
		conv := Conversation{
			Phone:     "+5511999999999",
			Role:      role,
			Content:   "Test message",
			Timestamp: 1704067200,
		}
		assert.Equal(t, role, conv.Role)
	}
}

func TestMemoryManager_Interface(t *testing.T) {
	// Verify that MemoryManager interface exists and has the expected methods
	// This is a compile-time check - if MemoryManager changes, this test will fail
	var _ MemoryManager = (*mockMemoryManager)(nil)
}

// mockMemoryManager implements MemoryManager for interface verification.
type mockMemoryManager struct{}

func (m *mockMemoryManager) SetUserState(ctx context.Context, phone string, state map[string]string) error {
	return nil
}

func (m *mockMemoryManager) GetUserState(ctx context.Context, phone string) (map[string]string, error) {
	return nil, nil
}

func (m *mockMemoryManager) SetGraphState(ctx context.Context, graphID string, state map[string]interface{}) error {
	return nil
}

func (m *mockMemoryManager) GetGraphState(ctx context.Context, graphID string) (map[string]interface{}, error) {
	return nil, nil
}

func (m *mockMemoryManager) HybridSearch(ctx context.Context, query string, filters map[string]string, limit int) ([]SearchResult, error) {
	return nil, nil
}

func (m *mockMemoryManager) PersistUser(ctx context.Context, user *User) error {
	return nil
}

func (m *mockMemoryManager) PersistConversation(ctx context.Context, conv *Conversation) error {
	return nil
}

func (m *mockMemoryManager) SyncToSQLite(ctx context.Context) error {
	return nil
}

func TestMockMemoryManager_SetUserState(t *testing.T) {
	m := &mockMemoryManager{}
	err := m.SetUserState(context.Background(), "+5511999999999", map[string]string{"key": "value"})
	require.NoError(t, err)
}

func TestMockMemoryManager_GetUserState(t *testing.T) {
	m := &mockMemoryManager{}
	state, err := m.GetUserState(context.Background(), "+5511999999999")
	require.NoError(t, err)
	assert.Nil(t, state)
}

func TestMockMemoryManager_HybridSearch(t *testing.T) {
	m := &mockMemoryManager{}
	results, err := m.HybridSearch(context.Background(), "test query", nil, 10)
	require.NoError(t, err)
	assert.Nil(t, results)
}

func TestMockMemoryManager_PersistUser(t *testing.T) {
	m := &mockMemoryManager{}
	user := &User{Phone: "+5511999999999", Plan: "pro"}
	err := m.PersistUser(context.Background(), user)
	require.NoError(t, err)
}

func TestMockMemoryManager_PersistConversation(t *testing.T) {
	m := &mockMemoryManager{}
	conv := &Conversation{Phone: "+5511999999999", Role: "user", Content: "hello"}
	err := m.PersistConversation(context.Background(), conv)
	require.NoError(t, err)
}

func TestSearchResult_PayloadAccess(t *testing.T) {
	result := SearchResult{
		ID:      "doc_1",
		Score:   0.9,
		Payload: map[string]interface{}{"text": "sample", "metadata": map[string]string{"author": "test"}},
	}

	// Access string payload
	text, ok := result.Payload["text"].(string)
	require.True(t, ok)
	assert.Equal(t, "sample", text)

	// Access nested map
	meta, ok := result.Payload["metadata"].(map[string]string)
	require.True(t, ok)
	assert.Equal(t, "test", meta["author"])
}