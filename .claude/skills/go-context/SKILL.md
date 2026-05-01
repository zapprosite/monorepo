# Go Context Skill

Context propagation, cancellation, timeouts, and value storage patterns.

## When to Create Context

| Create Context | Use Case |
|---|---|
| `context.Background()` | Top-level (main, tests, initialization) |
| `context.TODO()` | Placeholder when context unclear |
| `WithTimeout(parent, duration)` | Operations with time limits |
| `WithCancel(parent)` | Manual cancellation needed |
| `WithDeadline(parent, time)` | Absolute deadline |
| `WithValue(parent, key, val)` | Request-scoped data |

## Key Rules

- **Context as first parameter** — never store in struct
- **Type-safe context keys** — custom types, not bare strings
- **WithoutCancel** — Go 1.21+, detach from parent cancellation

## Patterns

### Timeout with Cleanup
```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

select {
case <-ctx.Done():
    return ctx.Err()
case result := <-workChan:
    return result
}
```

### Request-Scoped Values
```go
type key int

const traceIDKey key = iota

func WithTraceID(ctx context.Context, traceID string) context.Context {
    return context.WithValue(ctx, traceIDKey, traceID)
}

func GetTraceID(ctx context.Context) string {
    v, _ := ctx.Value(traceIDKey).(string)
    return v
}
```

### Graceful Shutdown
```go
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()

<-ctx.Done()
 slog.Info("shutting down gracefully")
}
```

## Anti-Patterns

- Don't store context in struct
- Don't use bare string keys
- Don't use context for values that aren't request-scoped
- Don't cancel after response is sent (use WithoutCancel for async work)
