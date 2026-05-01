---
name: redis-canonical
description: Canonical Redis connection pattern for all services
---

# Redis Canonical Pattern

## Environment Variables

```bash
# In .env.example (template — tracked, safe to read)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=${REDIS_URL}
REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_RETRY_DELAY_MS=2000
REDIS_MAX_RETRIES=3
```

## Docker Compose Usage

```yaml
environment:
  REDIS_URL: "${REDIS_URL}"
  REDIS_PASSWORD: "${REDIS_PASSWORD}"
```

## Code Pattern (TypeScript)

```typescript
function buildRedisUrl(): string {
  const url = process.env['REDIS_URL'];
  const password = process.env['REDIS_PASSWORD'];

  if (url) {
    if (password && !url.includes('@')) {
      return url.replace('redis://', `redis://:${password}@`);
    }
    return url;
  }

  // Fallback
  const host = process.env['REDIS_HOST'] ?? 'localhost';
  const port = process.env['REDIS_PORT'] ?? '6379';
  const pwd = process.env['REDIS_PASSWORD'];
  return pwd ? `redis://:${pwd}@${host}:${port}` : `redis://${host}:${port}`;
}
```

## Anti-patterns to Avoid

- `REDIS_URL=redis://host:6379` (no password)
- `REDIS_URL=redis://:@host:6379` (empty password)
- Hardcoding `${REDIS_PASSWORD}` directly in code

---

# Qdrant / Mem0 Canonical Pattern

## Qdrant Endpoint

```bash
# Qdrant API (via .env — QDRANT_API_KEY is a secret)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=${QDRANT_API_KEY}  # from .env (never hardcode)
```

## Collection Naming Convention

Two separate systems share the Qdrant instance, each with distinct collection namespaces:

| Prefix/Namespace | Owner | Collections |
|-----------------|-------|-------------|
| `will` | Mem0 (hermes-second-brain) | Single collection for semantic memory |

### Mem0 Collection (will)

Defined via `QDRANT_COLLECTION=will` / `MEM0_QDRANT_COLLECTION=will` in `.env` — used by hermes-second-brain for persistent agent memory.

## Anti-patterns to Avoid

- Creating new collections without following the namespace convention above