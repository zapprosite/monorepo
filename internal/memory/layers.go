package memory

import (
	"context"
)

// SearchResult represents a single search result from vector search.
type SearchResult struct {
	ID        string                 `json:"id"`
	Score     float64                `json:"score"`
	Payload   map[string]interface{} `json:"payload"`
	Version   int64                  `json:"version,omitempty"`
}

// User represents a user record for cold storage.
type User struct {
	Phone         string `json:"phone"`
	Status        string `json:"status"`
	Plan          string `json:"plan"`
	CreatedAt     int64  `json:"created_at"`
	TotalRequests int64  `json:"total_requests"`
}

// BillingEvent represents a billing event for cold storage.
type BillingEvent struct {
	EventID    string `json:"event_id"`
	Phone      string `json:"phone"`
	Type       string `json:"type"`
	AmountBRL  int64  `json:"amount_brl"`
	StripeID   string `json:"stripe_id"`
	Timestamp  int64  `json:"timestamp"`
}

// AuditLogEntry represents an audit log entry for cold storage.
type AuditLogEntry struct {
	GraphID    string `json:"graph_id"`
	Agent      string `json:"agent"`
	Action     string `json:"action"`
	DurationMs int64  `json:"duration_ms"`
	Timestamp  int64  `json:"timestamp"`
}

// Conversation represents a conversation message for cold storage.
type Conversation struct {
	Phone     string `json:"phone"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

// MemoryManager defines the interface for the 3-layer memory system.
type MemoryManager interface {
	// Hot layer (Redis)
	SetUserState(ctx context.Context, phone string, state map[string]string) error
	GetUserState(ctx context.Context, phone string) (map[string]string, error)
	SetGraphState(ctx context.Context, graphID string, state map[string]interface{}) error
	GetGraphState(ctx context.Context, graphID string) (map[string]interface{}, error)

	// Vector layer (Qdrant)
	HybridSearch(ctx context.Context, query string, filters map[string]string, limit int) ([]SearchResult, error)

	// Cold layer (SQLite)
	PersistUser(ctx context.Context, user *User) error
	PersistConversation(ctx context.Context, conv *Conversation) error
	SyncToSQLite(ctx context.Context) error
}
