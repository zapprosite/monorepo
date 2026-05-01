# Go Database Skill

Database patterns for Go with PostgreSQL.

## Connection Pooling (pgx)

```go
config, _ := pgxpool.ParseConfig(connString)
config.MinConns = 5
config.MaxConns = 25
config.MaxConnLifetime = 1 * time.Hour
config.MaxConnIdleTime = 15 * time.Minute

pool, err := pgxpool.NewWithConfig(ctx, config)
```

## Repository Pattern

```go
type UserRepository interface {
    Create(ctx context.Context, user *User) error
    GetByID(ctx context.Context, id string) (*User, error)
    Update(ctx context.Context, user *User) error
    Delete(ctx context.Context, id string) error
}

type userRepository struct {
    db *pgxpool.Pool
}

func (r *userRepository) Create(ctx context.Context, user *User) error {
    query := `INSERT INTO users (id, name, email) VALUES ($1, $2, $3)`
    _, err := r.db.Exec(ctx, query, user.ID, user.Name, user.Email)
    return err
}
```

## sqlc Pattern

```sql
-- sql/users.sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

-- name: CreateUser
-- query: INSERT INTO users (id, name, email) VALUES ($1, $2, $3);
CREATE FUNCTION CreateUser(ctx context.Context, user User) error;
```

Run `sqlc generate` to produce type-safe Go code.

## Null Handling

```go
var email sql.NullString
var count sql.NullInt64

row.Scan(&email, &count)
if email.Valid {
    // use email.String
}
```

## UTC Timestamps

```go
// Always store in UTC
createdAt := time.Now().UTC()

// Scan with timezone
var ts time.Time
row.Scan(&ts)
```

## Transaction Pattern

```go
func (r *Repository) WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
    tx, err := r.db.Begin(ctx)
    if err != nil {
        return err
    }

    defer func() {
        if p := recover(); p != nil {
            _ = tx.Rollback(ctx)
            panic(p)
        }
    }()

    if err := fn(tx); err != nil {
        if rbErr := tx.Rollback(ctx); rbErr != nil {
            return fmt.Errorf("tx: %v, rb: %w", err, rbErr)
        }
        return err
    }

    return tx.Commit(ctx)
}
```

## Rules
- Hold `*sql.DB`/`*pgxpool.Pool` as long-lived
- Never open/close per-query
- Use `UTC` for all timestamps
- Use parameterized queries (no string formatting)
