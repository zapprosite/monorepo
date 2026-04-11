package memory

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// SQLiteLayer implements the cold layer using SQLite.
type SQLiteLayer struct {
	db   *sql.DB
	mu   sync.RWMutex
	path string
}

// NewSQLiteLayer creates a new SQLite layer instance.
func NewSQLiteLayer(path string) (*SQLiteLayer, error) {
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	// Enable connection pool
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(time.Hour)

	layer := &SQLiteLayer{
		db:   db,
		path: path,
	}

	if err := layer.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return layer, nil
}

// migrate creates the required tables if they don't exist.
func (s *SQLiteLayer) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		phone TEXT PRIMARY KEY,
		status TEXT NOT NULL DEFAULT '',
		plan TEXT NOT NULL DEFAULT '',
		created_at INTEGER NOT NULL DEFAULT 0,
		total_requests INTEGER NOT NULL DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS billing_events (
		event_id TEXT PRIMARY KEY,
		phone TEXT NOT NULL,
		type TEXT NOT NULL,
		amount_brl INTEGER NOT NULL DEFAULT 0,
		stripe_id TEXT NOT NULL DEFAULT '',
		timestamp INTEGER NOT NULL DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS audit_log (
		graph_id TEXT NOT NULL,
		agent TEXT NOT NULL,
		action TEXT NOT NULL,
		duration_ms INTEGER NOT NULL DEFAULT 0,
		timestamp INTEGER NOT NULL DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS conversations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		phone TEXT NOT NULL,
		role TEXT NOT NULL,
		content TEXT NOT NULL,
		timestamp INTEGER NOT NULL DEFAULT 0
	);

	CREATE INDEX IF NOT EXISTS idx_billing_events_phone ON billing_events(phone);
	CREATE INDEX IF NOT EXISTS idx_audit_log_graph_id ON audit_log(graph_id);
	CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
	CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
	CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
	`

	_, err := s.db.Exec(schema)
	return err
}

// PersistUser inserts or updates a user record.
func (s *SQLiteLayer) PersistUser(ctx context.Context, user *User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
	INSERT INTO users (phone, status, plan, created_at, total_requests)
	VALUES (?, ?, ?, ?, ?)
	ON CONFLICT(phone) DO UPDATE SET
		status = excluded.status,
		plan = excluded.plan,
		total_requests = excluded.total_requests
	`

	_, err := s.db.ExecContext(ctx, query,
		user.Phone, user.Status, user.Plan, user.CreatedAt, user.TotalRequests)
	if err != nil {
		return fmt.Errorf("persist user: %w", err)
	}
	return nil
}

// PersistBillingEvent inserts a billing event.
func (s *SQLiteLayer) PersistBillingEvent(ctx context.Context, event *BillingEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
	INSERT INTO billing_events (event_id, phone, type, amount_brl, stripe_id, timestamp)
	VALUES (?, ?, ?, ?, ?, ?)
	ON CONFLICT(event_id) DO NOTHING
	`

	_, err := s.db.ExecContext(ctx, query,
		event.EventID, event.Phone, event.Type, event.AmountBRL, event.StripeID, event.Timestamp)
	if err != nil {
		return fmt.Errorf("persist billing event: %w", err)
	}
	return nil
}

// PersistAuditLog inserts an audit log entry.
func (s *SQLiteLayer) PersistAuditLog(ctx context.Context, entry *AuditLogEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
	INSERT INTO audit_log (graph_id, agent, action, duration_ms, timestamp)
	VALUES (?, ?, ?, ?, ?)
	`

	_, err := s.db.ExecContext(ctx, query,
		entry.GraphID, entry.Agent, entry.Action, entry.DurationMs, entry.Timestamp)
	if err != nil {
		return fmt.Errorf("persist audit log: %w", err)
	}
	return nil
}

// PersistConversation inserts a conversation message.
func (s *SQLiteLayer) PersistConversation(ctx context.Context, conv *Conversation) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
	INSERT INTO conversations (phone, role, content, timestamp)
	VALUES (?, ?, ?, ?)
	`

	_, err := s.db.ExecContext(ctx, query,
		conv.Phone, conv.Role, conv.Content, conv.Timestamp)
	if err != nil {
		return fmt.Errorf("persist conversation: %w", err)
	}
	return nil
}

// GetUser retrieves a user by phone.
func (s *SQLiteLayer) GetUser(ctx context.Context, phone string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT phone, status, plan, created_at, total_requests FROM users WHERE phone = ?`
	row := s.db.QueryRowContext(ctx, query, phone)

	var user User
	err := row.Scan(&user.Phone, &user.Status, &user.Plan, &user.CreatedAt, &user.TotalRequests)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return &user, nil
}

// GetBillingEvents retrieves billing events for a phone.
func (s *SQLiteLayer) GetBillingEvents(ctx context.Context, phone string, limit int) ([]BillingEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 {
		limit = 100
	}

	query := `
	SELECT event_id, phone, type, amount_brl, stripe_id, timestamp
	FROM billing_events
	WHERE phone = ?
	ORDER BY timestamp DESC
	LIMIT ?
	`

	rows, err := s.db.QueryContext(ctx, query, phone, limit)
	if err != nil {
		return nil, fmt.Errorf("get billing events: %w", err)
	}
	defer rows.Close()

	var events []BillingEvent
	for rows.Next() {
		var event BillingEvent
		if err := rows.Scan(&event.EventID, &event.Phone, &event.Type, &event.AmountBRL, &event.StripeID, &event.Timestamp); err != nil {
			return nil, fmt.Errorf("scan billing event: %w", err)
		}
		events = append(events, event)
	}

	return events, rows.Err()
}

// GetConversations retrieves conversations for a phone.
func (s *SQLiteLayer) GetConversations(ctx context.Context, phone string, limit int) ([]Conversation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 {
		limit = 100
	}

	query := `
	SELECT phone, role, content, timestamp
	FROM conversations
	WHERE phone = ?
	ORDER BY timestamp ASC
	LIMIT ?
	`

	rows, err := s.db.QueryContext(ctx, query, phone, limit)
	if err != nil {
		return nil, fmt.Errorf("get conversations: %w", err)
	}
	defer rows.Close()

	var convs []Conversation
	for rows.Next() {
		var conv Conversation
		if err := rows.Scan(&conv.Phone, &conv.Role, &conv.Content, &conv.Timestamp); err != nil {
			return nil, fmt.Errorf("scan conversation: %w", err)
		}
		convs = append(convs, conv)
	}

	return convs, rows.Err()
}

// Close closes the SQLite connection.
func (s *SQLiteLayer) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Close()
}

// DB returns the underlying database connection for health checks.
func (s *SQLiteLayer) DB() *sql.DB {
	return s.db
}

// Ping checks the database connection.
func (s *SQLiteLayer) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}
