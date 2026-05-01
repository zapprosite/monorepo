# Go Docker Skill

Docker container patterns for Go applications.

## Multi-Stage Dockerfile

```dockerfile
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache ca-certificates tzdata git
RUN adduser -D -g '' -u 10001 appuser
WORKDIR /app
COPY go.mod go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o server ./cmd/main.go

FROM alpine
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/server /server
USER appuser
ENTRYPOINT ["/server"]
```

## Key Build Flags

| Flag | Purpose |
|------|---------|
| `CGO_ENABLED=0` | Static binary, no cgo dependencies |
| `-ldflags="-s -w"` | Strip debug info, reduce size |

## Layer Caching

```dockerfile
# Copy go.mod/go.sum FIRST
COPY go.mod go.sum* ./
RUN go mod download

# Then copy source
COPY . .
RUN go build ...
```

Mount cache for faster rebuilds:
```dockerfile
RUN --mount=type=cache,target=/go/pkg/mod go mod download
```

## Non-Root User

```dockerfile
RUN adduser -D -g '' -u 10001 appuser
USER appuser
```

## Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
```

## Image Size Target

- Goal: < 50MB
- Use distroless or alpine base
- Strip debug symbols
- No shell, no package manager in final stage

## Compose for Local Dev

```yaml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://db:5432/app
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
```
