# Library Compatibility Matrix

> Generated: 2026-04-12
> Purpose: Update decision support

| Library | Current | Min Go | Max Go | Status |
|---------|---------|--------|--------|--------|
| `go-redis` (redis/go-redis/v9) | 9.5.1 | 1.18 | 1.24 | Stable |
| `qdrant` (qdrant/go-client) | 1.17.1 | 1.21 | 1.26 | Stable |
| `stripe-go` (stripe-go/v80) | 80.2.1 | 1.18 | 1.26 | Stable |
| `gemini` (internal embedder) | gemini-embedding-002 | - | - | Custom HTTP |
| `minimax` (internal client) | OpenAI-compatible | - | - | Custom HTTP |

## Notes

### go-redis v9.5.1
- Requires Go 1.18+ for generics support
- Project Go: 1.26.1 — compatible
- Redis compatibility: last 3 Redis releases

### qdrant v1.17.1
- Supports Go 1.21+
- gRPC-based client with connection pooling and TLS
- Qdrant server version independent (client handles API versioning)

### stripe-go v80
- v80 stable, v84 available with breaking changes (API 2025-03-31.basil)
- Breaking changes in v82+: billing capabilities, Checkout Sessions subscription handling
- Migration to v84 requires Stripe API version bump

### gemini (internal)
- Custom HTTP embedder using `generativelanguage.googleapis.com/v1beta`
- Model: `gemini-embedding-002` (768 dimensions)
- No Go library dependency — direct REST calls

### minimax (internal)
- Custom HTTP client, OpenAI-compatible API format
- Base: `https://api.minimax.io/anthropic`
- No official Go SDK — direct REST calls

## Update Recommendations

| Library | Action | Risk |
|---------|--------|------|
| go-redis | Can upgrade to latest v9.x | Low |
| qdrant | Can upgrade to latest v1.x | Low |
| stripe-go | **Deferred** — v80→v84 requires API migration | High |
| gemini | Monitor Google API deprecations | Low |
| minimax | Monitor MiniMax API changes | Low |
