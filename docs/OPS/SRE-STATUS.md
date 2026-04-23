# SRE Status Report

**Last Check:** 2026-04-23T03:37:42Z (UTC)

---

## Service Health Table

| Service | Container | Status | Uptime | Health Check |
|---------|-----------|--------|--------|-------------|
| ai-gateway | zappro-ai-gateway | Healthy | 43 min | 200 OK |
| Qdrant (primary) | qdrant | Healthy | 28 hours | all shards ready |
| Qdrant (secondary) | qdrant-c95x9bgnhpedt0zp7dfsims7 | Healthy | 2 hours | - |
| Qdrant (mcp) | mcp-qdrant | Healthy | 41 hours | - |
| Hermes Agency | hermes-agency | Healthy | 3 hours | - |
| LiteLLM Proxy | zappro-litellm | Healthy | 4 hours | 200 OK (auth expected) |
| LiteLLM DB | zappro-litellm-db | Healthy | 12 hours | - |
| Redis (zappro) | zappro-redis | Healthy | 11 hours | PONG |
| Redis (coolify) | coolify-redis | Healthy | 41 hours | PONG |
| Redis (opencode) | redis-opencode | Healthy | 11 hours | PONG |

---

## Health Endpoint Results

| Endpoint | Result |
|----------|--------|
| `http://localhost:4002/health` | `{"status":"ok","service":"ai-gateway"}` |
| `http://localhost:4000/health` | 401 Authentication Error (expected - no key passed) |
| `http://localhost:6333/readyz` | `all shards are ready` |
| Redis PING | `PONG` |

---

## Issues Found

### 1. Hermes Agency - Qdrant Collection Creation Warnings
**Severity:** Low (non-blocking)

Hermes logs show repeated warnings when creating Qdrant collections:
```
[Qdrant] Failed to create agency_clients: {"status":{"error":"Wrong input: Collection `agency_clients` already exists!"}...}
[HermesAgency] WARN: Qdrant at http://qdrant:6333 returned 401
```

**Analysis:** These errors occur because Hermes attempts to create collections that already exist on startup. This is benign - the service continues to operate normally. The 401 from Hermes to Qdrant may indicate a misconfiguration in Qdrant authentication settings.

**Recommendation:** Investigate Qdrant authentication configuration for hermes-agency.

### 2. LiteLLM Proxy - Authentication Errors
**Severity:** Low (informational)

LiteLLM logs show repeated `No api key passed in` errors:
```
Exception: No api key passed in.
[92m03:35:01 - LiteLLM Proxy:ERROR[0m: auth_exception_handler.py:78 - Exception occured - No api key passed in.
```

**Analysis:** These errors occur when clients make requests to LiteLLM without providing an API key. This is expected behavior for a proxy that requires authentication. The service itself is operational.

**Recommendation:** No action required unless unauthorized access is suspected.

---

## Action Items

- [ ] Investigate Qdrant 401 errors from hermes-agency (auth configuration)
- [ ] Review if Qdrant collection creation logic can be improved to check existence first

---

## Overall SRE Health Score

**Score: 9/10**

### Rationale:
- All critical containers are running and healthy
- All health endpoints respond correctly
- No service outages detected
- Only minor warnings in logs (benign collection conflicts, expected auth errors)
- Deducted 1 point for Qdrant auth warning from Hermes (non-blocking but worth investigating)
