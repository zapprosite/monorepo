# Security Architecture

**Scope:** homelab.zappro.site — AI Agency Suite
**Classification:** Internal — Principal Engineer only
**Last Updated:** 2026-04-23

---

## 1. Authentication

### 1.1 API Gateway Bearer Tokens

| Service | Env Var | Purpose |
|---------|---------|---------|
| AI Gateway Facade | `AI_GATEWAY_FACADE_KEY` | Master key for AI Gateway proxy |
| AI Agency | `HERMES_API_KEY` | Agency Suite API authentication |
| LiteLLM Proxy | `LITELLM_MASTER_KEY` | LiteLLM orchestration |

**Token Requirements:**
- Minimum 32 characters, cryptographically random
- Generated via `openssl rand -hex 32`
- Rotated quarterly for API keys, annual for tokens
- Stored in `.env` only — never committed

### 1.2 Telegram Bot Authentication

| Component | Auth Method |
|-----------|-------------|
| Bot Token | `AI_AGENCY_BOT_TOKEN` (BotFather) |
| Admin Users | `AI_AGENCY_ADMIN_USER_IDS` (comma-separated Telegram User IDs) |
| Chat Whitelist | `AI_AGENCY_ALLOWED_CHAT_IDS` (optional, for group bots) |

### 1.3 Grafana

- Service account token via `GRAFANA_TOKEN`
- Read-only tokens for dashboard embedding
- Service account with minimal permissions

---

## 2. Authorization

### 2.1 Role-Based Access Control (RBAC)

| Role | Access Level |
|------|-------------|
| `admin` | Full access: health, metrics, circuit breakers, config reload |
| `user` | Standard bot operations, own data only |
| `readonly` | Metrics query only (Prometheus/Grafana) |

### 2.2 Telegram Admin Enforcement

Admin-only endpoints (checked via `HERMES_ADMIN_USER_IDS`):
- `/health/circuit-breakers` — circuit breaker status
- `/health/authenticated` — full system status
- Any admin command (reload, config changes)

```typescript
const adminIds = (process.env['AI_AGENCY_ADMIN_USER_IDS'] ?? '').split(',').filter(Boolean);
if (!adminIds.includes(userId)) {
  res.writeHead(403);
  return { error: 'Forbidden — admin only' };
}
```

---

## 3. Secrets Management

### 3.1 Environment Variables

**Canonical source:** `.env.example` in each service root

```bash
# AI Gateway
AI_GATEWAY_FACADE_KEY=changeme_placeholder

# AI Agency
AI_AGENCY_BOT_TOKEN=changeme_placeholder
HERMES_API_KEY=changeme_placeholder
AI_AGENCY_ADMIN_USER_IDS=changeme_placeholder
AI_AGENCY_ALLOWED_CHAT_IDS=changeme_placeholder

# LiteLLM
LITELLM_MASTER_KEY=changeme_placeholder

# Observability
GRAFANA_TOKEN=changeme_placeholder
```

### 3.2 Real `.env` File

- Location: `~/.hermes-gateway/.env` (or service-specific)
- Permissions: `600` (owner read/write only)
- **Never committed to git**
- `.gitignore` entries: `.env`, `*.env.local`

### 3.3 Secret Rotation Schedule

| Secret Type | Rotation Frequency |
|-------------|-------------------|
| API Keys (HERMES_API_KEY, AI_AGENCY_API_KEY) | Quarterly |
| Telegram Bot Tokens | Annual |
| Database passwords | Quarterly |
| Grafana tokens | Semi-annual |

---

## 4. Network Security

### 4.1 Cloudflare Tunnel

All external traffic routes through Cloudflare Tunnel:
- No direct IP access to any service
- Authenticated origin pulls enabled
- TLS 1.3 enforced at edge

### 4.2 Port Allocation

| Port | Service | Access |
|------|---------|--------|
| 3000 | Open WebUI | Tunnel-only |
| 3001 | AI Agency Health | localhost + tunnel |
| 4000 | LiteLLM Proxy | localhost |
| 5173 | Vite Dev | Internal only |
| 8000 | Coolify PaaS | Direct (internal) |
| 8080 | -api | localhost |
| 9090 | Prometheus | tunnel + auth |

### 4.3 Service Connectivity

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare Tunnel                      │
│                    (authenticated origin)                   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Telegram Bot    AI Gateway      Grafana
              │               │               │
              ▼               ▼               ▼
     ┌────────────────────────────────────────┐
     │          Internal Network (localhost)  │
     │  Redis │ Qdrant │ PostgreSQL │ Ollama │
     └────────────────────────────────────────┘
```

### 4.4 Firewall Rules

- **Inbound:** Only Cloudflare IP ranges (via tunnel)
- **Outbound:** DNS, HTTPS to necessary APIs only
- **No inbound SSH** except via VPN

---

## 5. Data Privacy

### 5.1 Telegram Data

- Messages stored in **Qdrant** collection `agency_conversations`
- User PII (names, usernames) **not persisted**
- Correlation via `userId` (Telegram numeric ID) only
- Retention: 90 days rolling window

### 5.2 PostgreSQL Schema Isolation

### 5.2 GDPR Compliance

| Requirement | Implementation |
|-------------|----------------|
| Data export | `/api/v1/user/:id/export` endpoint |
| Data deletion | `/api/v1/user/:id/delete` (soft delete + purge) |
| Consent tracking | `user_consent` table with timestamp |
| Data minimization | No PII in logs (correlation IDs only) |

### 5.3 Log Sanitization

All logs use correlation IDs, never:
- Email addresses
- Phone numbers
- Full names
- IP addresses (hashed if needed)

---

## 6. Audit Logging

### 6.1 Logged Events

| Event Type | Fields | Retention |
|------------|--------|-----------|
| API calls | timestamp, caller, action, result, duration | 90 days |
| Circuit breaker | timestamp, service, state, reason | 90 days |
| Auth failures | timestamp, caller, reason, source IP | 90 days |
| Admin actions | timestamp, adminId, action, target, result | 90 days |
| Auth failures | timestamp, caller, reason, source IP | 90 days |
| Rate limit hits | timestamp, userId, limit, window | 90 days |

### 6.2 Log Storage

- **Primary:** Loki (journald → Loki)
- **Visualization:** Grafana
- **Alerting:** Alertmanager (off-hours oncall)

### 6.3 Admin Action Audit

All admin operations logged with:
```json
{
  "timestamp": "2026-04-23T10:30:00Z",
  "adminId": "123456789",
  "action": "reload_config",
  "target": "circuit_breaker",
  "result": "success",
  "correlationId": "req_abc123"
}
```

---

## 7. Rate Limiting

### 7.1 Redis Sliding Window

**Configuration:**
- Window: `HERMES_RATE_WINDOW_MS` (default: 10000ms)
- Max: `HERMES_RATE_MAX_MSGS` (default: 5 messages)
- Key format: `ratelimit:<userId>`

**Response Headers:**
```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1745402400000
```

### 7.2 In-Memory Fallback

When Redis is unavailable:
- Single-instance only (no distributed enforcement)
- Logged warning on fallback activation
- Automatic cleanup every `RATE_LIMIT_WINDOW_MS * 2`

---

## 8. Circuit Breakers

### 8.1 Per-Service Breakers

Each external service has an independent circuit breaker:

| Service | Failure Threshold | Timeout |
|---------|-----------------|---------|
| Ollama | 5 failures | 30s |
| Qdrant | 3 failures | 15s |
| AI Gateway | 5 failures | 30s |
| External APIs | 3 failures | 60s |

### 8.2 Circuit Breaker Logging

```json
{
  "timestamp": "2026-04-23T10:30:00Z",
  "service": "ollama",
  "previousState": "closed",
  "newState": "open",
  "reason": "5 consecutive failures",
  "correlationId": "req_abc123"
}
```

### 8.3 Admin-Only Visibility

Circuit breaker status (`/health/circuit-breakers`) requires:
1. Valid `HERMES_API_KEY` in header, OR
2. Admin user ID in query params matching `HERMES_ADMIN_USER_IDS`

---

## 9. Penetration Testing

### 9.1 Quarterly Automated Scanning

| Tool | Target | Checks |
|------|--------|--------|
| OWASP ZAP | All tunnel endpoints | Top 10 |
| Nmap | Internal ports | Service detection |
| Nuclei | Running services | CVE database |

### 9.2 Annual Penetration Test

- External red team engagement
- Social engineering resistance
- Physical security (if applicable)

### 9.3 Dependency Vulnerability Scanning

- **Dependabot** for GitHub dependencies
- **npm audit** in CI/CD pipeline
- **Grype** for container images
- Critical CVEs: patched within 24h
- High CVEs: patched within 7 days

---

## 10. Incident Response

### 10.1 Alert Triggers

| Alert | Severity | Response |
|-------|----------|----------|
| Circuit breaker cascade | P1 Critical | Immediate oncall |
| Error rate > 10% | P1 Critical | Immediate oncall |
| Unauthorized access attempt | P2 High | Business hours |
| Rate limit exhaustion | P3 Medium | Next business day |
| Disk > 80% | P2 High | 4h response |

### 10.2 Runbook Categories

- `RB-001` — Circuit breaker cascade recovery
- `RB-002` — Redis failover procedure
- `RB-003` — Qdrant backup restore
- `RB-004` — Telegram bot restart
- `RB-005` — LiteLLM key rotation

### 10.3 On-Call Rotation

- Primary: Principal Engineer (24/7)
- Secondary: None (single operator homelab)
- Escalation: N/A

---

## 11. Security Checklist

### Pre-Commit
- [ ] No secrets in code (pre-commit hook: detect-secrets)
- [ ] No `.env` files committed
- [ ] All dependencies audited (`bun audit`)
- [ ] TypeScript type errors resolved (`bunx tsc --noEmit`)

### Pre-Deployment
- [ ] All RBAC checks verified
- [ ] Rate limiting enabled
- [ ] Circuit breakers configured
- [ ] Health endpoints responding
- [ ] Logs flowing to Loki

### Post-Deployment
- [ ] Smoke tests pass
- [ ] Circuit breakers closed
- [ ] Rate limits enforced
- [ ] Metrics visible in Grafana

---

## 12. Threat Model Summary

| Threat | Mitigation |
|--------|------------|
| Stolen API key | Immediate rotation, IP allowlist via tunnel |
| Telegram bot abuse | Rate limiting + admin whitelist |
| Redis unavailability | In-memory fallback with warnings |
| Qdrant data loss | Regular snapshots, point-in-time recovery |
| Credential stuffing | High-entropy keys, no password auth |
| Man-in-middle | TLS 1.3 only via Cloudflare |
| Privilege escalation | RBAC enforced, least-privilege service accounts |

---

## 13. Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System overview
- [OBSERVABILITY.md](./OBSERVABILITY.md) — Monitoring and alerting
- [RUNBOOK.md](./RUNBOOK.md) — Operational procedures
- [topology/](./topology/) — Network topology diagrams
