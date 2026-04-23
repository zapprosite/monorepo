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

---

# Qdrant / Mem0 Canonical Pattern

## Qdrant Endpoint

```bash
# Qdrant API (no password by default on local dev)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=71cae77676e2a5fd552d172caa1c3200  # from Docker container inspect
```

## Collection Naming Convention

Two separate systems share the Qdrant instance, each with distinct collection namespaces:

| Prefix/Namespace | Owner | Collections |
|-----------------|-------|-------------|
| `agency_*` | hermes-agency | `agency_clients`, `agency_campaigns`, `agency_conversations`, `agency_assets`, `agency_brand_guides`, `agency_tasks`, `agency_video_metadata`, `agency_knowledge`, `agency_working_memory` |
| `will` | Mem0 (hermes-second-brain) | Single collection for semantic memory |
| `openclaw-memory` | OpenClaw Bot | Bot memory |

### hermes-agency Collections (agency_*)

Defined in `/srv/monorepo/apps/hermes-agency/src/qdrant/client.ts` — 9 multi-tenant collections for agency operations.

### Mem0 Collection (will)

Defined via `QDRANT_COLLECTION=will` / `MEM0_QDRANT_COLLECTION=will` in `.env` — used by hermes-second-brain for persistent agent memory.

## Code Pattern (TypeScript — hermes-agency)

```typescript
import { COLLECTIONS } from './qdrant/client.ts';

// All 9 agency collections use agency_* prefix
COLLECTIONS.CLIENTS        // 'agency_clients'
COLLECTIONS.CAMPAIGNS     // 'agency_campaigns'
COLLECTIONS.CONVERSATIONS // 'agency_conversations'
// ... etc
```

## Anti-patterns to Avoid

- Mixing `agency_*` and `will` collections — they serve different systems
- Creating new collections without following the namespace convention above