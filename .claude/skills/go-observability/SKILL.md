# Go Observability Skill

Logging, metrics, and tracing patterns for Go.

## Structured Logging (slog — Go 1.21+)

```go
slog.Info("request completed",
    slog.String("method", r.Method),
    slog.String("path", r.URL.Path),
    slog.Int("status", statusCode),
    slog.Duration("latency", time.Since(start)),
    slog.String("trace_id", traceID),
)
```

## Log Levels

| Level | Use |
|-------|-----|
| DEBUG | Detailed debugging info |
| INFO | Normal operation |
| WARN | Warning (degraded) |
| ERROR | Error condition |
| FATAL | System failure (process exits) |

## OpenTelemetry Tracing

```go
import "go.opentelemetry.io/otel/attribute"

func handleRequest(ctx context.Context) {
    ctx, span := otel.Tracer("my-service").Start(ctx, "handle-request")
    defer span.End()

    span.SetAttributes(
        attribute.String("http.method", "GET"),
        attribute.String("http.route", "/users"),
    )

    // work
}
```

## Prometheus Metrics

```go
var (
    httpRequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total HTTP requests",
        },
        []string{"method", "path", "status"},
    )

    httpRequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "path"},
    )
)
```

## Correlation

Link logs, metrics, and traces via trace ID:
```go
traceID := span.SpanContext().TraceID().String()
slog.Info("request", slog.String("trace_id", traceID))
```

## Health Readines

```go
func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
    if err := db.Ping(r.Context()); err != nil {
        http.Error(w, "not ready", http.StatusServiceUnavailable)
        return
    }
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}
```
