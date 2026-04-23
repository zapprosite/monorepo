---
name: redis-canonical
description: Canonical Redis connection pattern for all services
---

# Redis Canonical Pattern

## Environment Variables

```bash
# In .env (canonical)
REDIS_HOST=zappro-redis
REDIS_PORT=6379
REDIS_PASSWORD=Fifine156458*
REDIS_URL=redis://:Fifine156458*@zappro-redis:6379
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
- Hardcoding `Fifine156458*` directly in code