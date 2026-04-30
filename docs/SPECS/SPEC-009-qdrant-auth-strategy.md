---
name: SPEC-009
description: Qdrant authentication strategy — api-key vs token for homelab deployment
status: draft
owner: will-zappro
created: 2026-04-29
parent: SPEC-009-shadow-context-blueprint
---

# SPEC-009 — Qdrant Authentication Strategy

## Context

Qdrant is returning **401 Unauthorized** because no authentication is configured. This blocks:
- RAG operations via `qdrant_layer.go`
- mem0 integration with Qdrant backend
- Shadow Context Blueprint (SPEC-009 parent)

**Current state:**
- Qdrant endpoint: `http://localhost:6333`
- Go client: `github.com/qdrant/go-client/qdrant`
- Auth: **NONE** (open, localhost-only)

---

## Authentication Options

### Option 1: API Key (Recommended for Homelab)

**Mechanism:** Static key in `X-Qdrant-ApiKey` header

**Pros:**
- Simple to configure
- No external dependency (self-contained)
- Works with all Qdrant clients (Go, Python, REST)
- Sufficient for localhost/internal network

**Cons:**
- Single key, no per-client rotation
- Key stored in environment variable

**Configuration:**
```bash
# Qdrant server flag
qdrant --api-key <random-256-bit-key>

# Client uses header
curl -H "X-Qdrant-ApiKey: ${QDRANT_API_KEY}" http://localhost:6333/collections
```

**Key generation:**
```bash
openssl rand -hex 32
# e.g.,: a8f4e7d2c3b1a9e6f7d2c4b1a3e9d6c2f7b4a1e8d3c6b9a2f5e8d1c4b3a7e9d
```

---

### Option 2: JWT Token (Recommended for Production/Multi-User)

**Mechanism:** OAuth2-like flow with `qdrant` CLI or API

**Pros:**
- Per-user tokens with expiry
- Scoped permissions (read-only, read-write, admin)
- Token refresh mechanism
- Suitable for multi-tenant

**Cons:**
- More complex setup
- Requires `qdrant` CLI for key management
- Additional infrastructure for token issuance

**Configuration:**
```bash
# Generate token (requires qdrantctl)
qdrantctl user create --role admin

# Client uses Bearer token
curl -H "Authorization: Bearer <jwt-token>" http://localhost:6333/collections
```

---

## Decision Matrix

| Criteria | API Key | JWT Token |
|----------|---------|-----------|
| Setup complexity | Low | High |
| Per-user auth | No | Yes |
| Key rotation | Manual | Automatic |
| Go client support | Yes (via context) | Yes (via context) |
| Suitable for | Homelab, dev | Production, multi-tenant |
| Secret storage | `.env` | Vault/IdP |

---

## Recommended Strategy

**For homelab (current):** API Key

**Rationale:**
1. Single-user homelab — no per-user separation needed
2. Qdrant is localhost-only — attack surface minimal
3. Go client (`qdrant_layer.go`) supports API key via context
4. T-DESIGN-001 blocked until auth is fixed

**Migration path:** If multi-user or public exposure needed → JWT

---

## Implementation Plan

### Phase 1: Enable API Key Auth on Qdrant

**1.1 Generate secure API key**
```bash
QDRANT_API_KEY=$(openssl rand -hex 32)
echo "QDRANT_API_KEY=${QDRANT_API_KEY}" >> ~/.env
```

**1.2 Update Qdrant service startup**
- Docker: Add `--env QDRANT__SERVICE__API_KEY=${QDRANT_API_KEY}`
- Systemd: Add `Environment=QDRANT_API_KEY=<key>` to unit file
- Docker Compose: Add to `environment:` section

**1.3 Update `.env.example`**
```
QDRANT_API_KEY=${QDRANT_API_KEY}
```

### Phase 2: Update Go Client

**2.1 Check `qdrant.Client` API for API key**

The `qdrant.Client` from `github.com/qdrant/go-client/qdrant` accepts options:
```go
import "github.com/qdrant/go-client/qdrant"

client, err := qdrant.NewClient(
    qdrant.WithURL("http://localhost:6333"),
    qdrant.WithAPIKey("your-api-key"),
)
```

**2.2 Update `NewQdrantLayer` to accept API key**

In `internal/memory/qdrant_layer.go`:
```go
// NewQdrantLayer creates a new Qdrant layer instance.
func NewQdrantLayer(client *qdrant.Client) *QdrantLayer {
    return &QdrantLayer{
        client:     client,
        collection: "hvac_service_manuals",
        cb:         circuitbreaker.NewWithLogger(5, 30*time.Second, slog.Default()),
    }
}

// NewQdrantLayerFromEnv creates a new Qdrant layer with API key from environment.
func NewQdrantLayerFromEnv() (*QdrantLayer, error) {
    apiKey := os.Getenv("QDRANT_API_KEY")
    host := os.Getenv("QDRANT_HOST")
    if host == "" {
        host = "localhost:6333"
    }

    client, err := qdrant.NewClient(
        qdrant.WithURL(fmt.Sprintf("http://%s", host)),
        qdrant.WithAPIKey(apiKey),
    )
    if err != nil {
        return nil, fmt.Errorf("qdrant client: %w", err)
    }

    return &QdrantLayer{
        client:     client,
        collection: "hvac_service_manuals",
        cb:         circuitbreaker.NewWithLogger(5, 30*time.Second, slog.Default()),
    }, nil
}
```

### Phase 3: Verify

**3.1 Test unauthenticated request (expect 401)**
```bash
curl -s http://localhost:6333/collections | jq
# Expected: {"status":{"code":"401","message":"Unauthorized"}}
```

**3.2 Test authenticated request (expect 200)**
```bash
curl -s -H "X-Qdrant-ApiKey: ${QDRANT_API_KEY}" http://localhost:6333/collections | jq
# Expected: {"result":{"collections":[...],"time":...}}
```

**3.3 Test Go client integration**
```bash
go test ./internal/memory/... -run TestQdrantAuth
```

---

## Security Considerations

1. **Key storage:** API key must NOT be committed to git — use `.env` only
2. **Key rotation:** Generate new key periodically, update `.env` + Qdrant restart
3. **Network isolation:** Qdrant binds to `127.0.0.1` or internal interface only
4. **Audit logging:** Enable Qdrant access logs to track auth failures
5. **Fail closed:** If `QDRANT_API_KEY` is missing, reject connections

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `QDRANT_HOST` | No | Host:port (default: `localhost:6333`) |
| `QDRANT_API_KEY` | Yes | API key for authentication |

---

## References

- Qdrant Auth Docs: https://qdrant.tech/documentation/concepts/authentication/
- Go Client: `github.com/qdrant/go-client/qdrant`
- SPEC-009 Shadow Context Blueprint (parent): `/srv/monorepo/docs/SPECS/SPEC-009-SHADOW-CONTEXT-BLUEPRINT.md`

---

## Status

| Task | Status |
|------|--------|
| T-DESIGN-001: Define Qdrant auth strategy | ✅ Done |
| T-FIX-001: Configure Qdrant auth | TODO |
| T-FIX-002: Create Qdrant collections | TODO |
| T-VERIFY-001: Test Qdrant auth | TODO |
