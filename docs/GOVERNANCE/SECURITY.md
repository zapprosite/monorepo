# Security Hardening Guide

This document covers security hardening across access control, secrets management, input validation, rate limiting, audit logging, and environment isolation.

---

## 1. Access Control

### Threat

Unauthorized execution of privileged operations. An attacker or misconfigured process gains access to restricted commands (service restarts, ZFS operations, firewall changes) due to missing permission boundaries.

### Mitigation

Principle of least privilege. Every actor (user, service, agent) receives only the permissions required for its function. No wildcard sudo, no shared credentials across environments.

### Implementation

```bash
# /srv/ops/ai-governance/CLAUDE.md defines approval matrix
# SAFE (no approval): read-only, backups, snapshots, docs
# APPROVAL REQUIRED: service stop/start, package install, ZFS, firewall, config edits
# FORBIDDEN: disk wipe, pool destruction, /srv/data deletion

# Example: Claude Code agent permissions
allowed_commands:
  - read-only: git status, git log, cat, ls, ps
  - safe: git add, git commit (non-destructive)
  - require_approval: systemctl restart, firewall-cmd, zfs
  - forbidden: dd, wipefs, rm -rf /srv/data

# Ownership隔离 — each service runs under its own user
# PostgreSQL: postgres:postgres
# Qdrant: qdrant:qdrant
# LiteLLM: litellm:litellm
```

### Verification

```bash
# Verify no forbidden operations are accessible
grep -rE "dd|wipefs|rm -rf /srv/data" /srv/ops/ai-governance/ 2>/dev/null && echo "VIOLATION" || echo "OK"

# Verify sudoers is restricted
sudo -l 2>/dev/null | grep -v "(ALL)" && echo "RESTRICTED" || echo "WIDE OPEN"

# Verify each service binary is owned by its service user
ls -la /usr/bin/systemctl /usr/sbin/zfs | awk '{print $3}' | sort -u
```

---

## 2. Secrets Management

### Threat

API keys, tokens, and credentials exposed in logs, error messages, shell history, or version control. Secret rotation becomes impossible if values are hardcoded across the codebase.

### Mitigation

All secrets stored in environment variables or encrypted vaults. No hardcoded values in source code, config files, or documentation. Secrets injected at runtime via `${VAR}` references.

### Implementation

```bash
# Template pattern — never hardcode values
# .env.example (tracked):
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
LITELLM_MASTER_KEY=${LITELLM_MASTER_KEY}
CF_GLOBAL_KEY=${CF_GLOBAL_KEY}

# Actual .env (gitignored, owned by ops):
ANTHROPIC_API_KEY=sk-cp-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LITELLM_MASTER_KEY=sk-zappro-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Secret storage: /srv/ops/secrets/*.env (never read directly)
# Use env-sync.sh only:
bash /srv/monorepo/scripts/env-sync.sh   # syncs .env → .env.example

# Scan for hardcoded secrets
bash /srv/ops/scripts/scan-and-refactor-secrets.sh --dry-run

# Pre-commit hook blocks secret commits
# /srv/ops/scripts/pre-commit-subdomain-check.sh
# Blocks patterns: sk-cp-, sk-zappro-, cfk_, cfut_, ghp_, 87xxxxxxxxx:
```

```typescript
// WRONG — hardcoded secret
const apiKey = "71cae77676e2a5fd552d172caa1c3200";

// CORRECT — environment variable
const apiKey = process.env.QDRANT_API_KEY ?? "";
```

### Verification

```bash
# Dry-run scan for hardcoded secrets
bash /srv/ops/scripts/scan-and-refactor-secrets.sh --dry-run

# Verify .env is gitignored
git -C /srv/monorepo check-ignore .env && echo "IGNORED" || echo "NOT IGNORED"

# Verify no secrets in git history (one-time check)
git log --all -p | grep -E "sk-cp-[a-z0-9]{40}" | head -1 && echo "FOUND" || echo "CLEAN"

# Verify no secret values in logs
journalctl -u some-service | grep -iE "sk-[a-z0-9]{30}" && echo "LEAK" || echo "CLEAN"
```

---

## 3. Input Validation

### Threat

Injection attacks via unsanitized user input. SQL injection, command injection, path traversal, and prompt injection allow attackers to read unauthorized data or execute arbitrary operations.

### Mitigation

Validate and sanitize all external input at entry points. Reject input that does not match expected schema. Escape output before rendering. Use typed schemas (e.g., Zod) for all API request payloads.

### Implementation

```typescript
// Use Zod schemas for all external input (already in monorepo)
import { z } from "zod";

const ProviderConfigSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
});

function validateProviderConfig(input: unknown) {
  return ProviderConfigSchema.parse(input);
}

// Path traversal prevention
function safePath(base: string, userInput: string): string {
  const resolved = path.resolve(base, userInput);
  if (!resolved.startsWith(base)) throw new Error("Path traversal detected");
  return resolved;
}

// Command injection prevention — never use user input in shell exec
// Use spawn with array args, never string concatenation
const args = [userArg1, userArg2]; // NOT "cmd $userArg1"
spawn("command", args, { shell: false }); // shell: false blocks injection
```

### Verification

```bash
# Verify all API routes have input validation
grep -rn "z\.object\|z\.string\|z\.number" /srv/monorepo/src/services/ | wc -l

# Verify no shell: true with user-controlled args
grep -rn "spawn.*shell: true" /srv/monorepo/src/ || echo "NO SHELL TRUE"

# Verify path.resolve is used for file operations
grep -rn "path\.resolve\|realpath" /srv/monorepo/src/services/ | head -5

# Fuzz test: send malformed JSON to each endpoint
echo '{"name":"../../../etc/passwd","apiKey":"test"}' | \
  curl -s -X POST -H "Content-Type: application/json" -d @- \
  http://localhost:PORT/api/endpoint 2>&1 | grep -iE "error|invalid" || echo "NOT REJECTED"
```

---

## 4. Rate Limiting

### Threat

Denial-of-service via request flooding. An attacker or misbehaving client sends thousands of requests per second, exhausting server resources or rate quotas (e.g., OpenRouter costs).

### Mitigation

Enforce rate limits at the API gateway and per-service level. Use token bucket or sliding window algorithms. Return `429 Too Many Requests` with `Retry-After` header. Separate rate limits per API key to prevent one key consuming the entire quota.

### Implementation

```typescript
// LiteLLM config in docker-compose.yml or config.yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      api_key: os.environ/OpenAI_API_KEY
      rate_limit:
        requests_per_minute: 60
        requests_per_day: 10000

# nginx rate limiting for public endpoints
limit_req_zone $binary_remote_addr zone=public:10m rate=10r/s;
limit_req zone=public burst=20 nodelay;

# Per-API-key rate limiting in application code
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(apiKey: string, limit = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(apiKey) ?? { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  rateLimitMap.set(apiKey, entry);
  return entry.count <= limit;
}
```

### Verification

```bash
# Test rate limiting with load
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:PORT/api/endpoint
done | sort | uniq -c

# Expected: majority 200, some 429
# Verify 429 includes Retry-After header
curl -sI http://localhost:PORT/api/endpoint | grep -i "retry-after"

# Verify LiteLLM rate limits are active
curl -s http://localhost:4000/health | jq .rate_limits 2>/dev/null || echo "no rate limit endpoint"
```

---

## 5. Audit Logging

### Threat

Security incidents go undetected without logs. An attacker moves laterally through the system, but without audit trails, there is no evidence of what was accessed, modified, or exfiltrated.

### Mitigation

Log all authentication events, authorization decisions, secrets access attempts, configuration changes, and administrative operations. Logs must include timestamp, actor identity, action, resource, and outcome. Logs must never contain secret values.

### Implementation

```typescript
// Audit log format (JSON structured)
interface AuditLog {
  timestamp: string;        // ISO 8601
  actor: string;            // user@host or service name
  action: string;           // "api_key.create", "config.update"
  resource: string;         // "providers/openrouter"
  outcome: "success" | "failure" | "denied";
  metadata?: Record<string, unknown>;
}

// Never log secret values
logger.info({
  event: "api_key.validate",
  actor: "claude-code@willzappro",
  api_key_id: "openrouter-prod-01",
  outcome: "success",
  // apiKey intentionally omitted — never log the value
});

// Authentication events
logger.info({
  event: "auth.login",
  method: "api_key",
  actor: "service@monorepo",
  outcome: "success",
});

// Authorization denials — these are critical
logger.warn({
  event: "auth.denied",
  actor: "unknown@external",
  action: "service.stop",
  resource: "litellm",
  outcome: "denied",
  reason: "not in allowed_commands list",
});
```

### Verification

```bash
# Verify audit logs are being written
ls -la /srv/monorepo/logs/audit.log 2>/dev/null && echo "EXISTS" || echo "MISSING"

# Verify no secret values in logs
grep -rE "sk-cp-[a-z0-9]{40}|71cae77676e2a5fd552d172caa1c3200" \
  /srv/monorepo/logs/audit.log 2>/dev/null && echo "SECRET LEAKED" || echo "CLEAN"

# Verify auth events are logged
grep '"event":"auth' /srv/monorepo/logs/audit.log | tail -5

# Verify denial events are logged
grep '"outcome":"denied"' /srv/monorepo/logs/audit.log | tail -5

# Verify log rotation is configured
logrotate -d /etc/logrotate.d/monorepo 2>&1 | grep "error" && echo "CONFIG ERROR" || echo "OK"
```

---

## 6. Environment Isolation

### Threat

Development misconfiguration bleeds into production. A developer runs a test against a production database, or a service in one environment accesses secrets from another environment, causing data corruption or cross-environment contamination.

### Mitigation

Strict environment separation. Each environment (dev, staging, production) has its own configuration, secrets vault, network segment, and resource quotas. No shared state between environments. Services in production run with minimal privileges.

### Implementation

```bash
# Environment file isolation
.env.dev      # development secrets (gitignored)
.env.staging  # staging secrets (gitignored)
.env.production # production secrets (gitignored, owned by ops)
.env.example  # template with ${VAR} placeholders (tracked)

# Network isolation — each environment on separate subnet
# 10.0.1.0/24 — production (no internet egress)
# 10.0.2.0/24 — staging (limited egress)
# 10.0.3.0/24 — development (full egress)

# ZFS dataset isolation
srv/data/              # production data (snapshots enabled)
srv/data/dev           # dev environment (separate dataset)
srv/data/staging       # staging environment (separate dataset)
srv/backups/           # backups (separate pool, read-only mount)

# Service isolation via Docker networks
networks:
  production:
    driver: bridge
    ipam:
      config:
        subnet: 10.0.1.0/24
  staging:
    driver: bridge
    ipam:
      config:
        subnet: 10.0.2.0/24

# Each service connects only to its own network
services:
  litellm:
    networks:
      - production
    environment:
      - LLM_ENV=production
```

### Verification

```bash
# Verify each ZFS dataset has separate snapshots
zfs list -t snapshot -r srv/data | grep -v "daily\|weekly" | grep "^srv/data" | wc -l

# Verify no .env files are committed
git -C /srv/monorepo status --porcelain | grep "\.env$" && echo "ENV FILES COMMITTED" || echo "CLEAN"

# Verify Docker networks are isolated
docker network inspect production_bridge -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null
docker network inspect staging_bridge -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null

# Verify environment variables are not leaked across containers
docker exec litellm-prod printenv | grep -E "DEV_|STAGING_" && echo "CROSS-ENV LEAK" || echo "ISOLATED"

# Verify production services cannot reach internet (egress block)
docker exec litellm-prod wget -q --spider --timeout=5 https://google.com && echo "EGRESS ALLOWED" || echo "EGRESS BLOCKED"
```

---

## Quick Reference — Threat vs. Mitigation

| Threat | Mitigation | Key Files |
|---|---|---|
| Unauthorized privilege escalation | Least-privilege sudo, approval matrix | CLAUDE.md, GUARDRAILS.md |
| Hardcoded secrets in code | `${VAR}` templates, env-sync.sh, pre-commit hook | .env.example, scan-and-refactor-secrets.sh |
| Injection attacks | Zod schemas, safePath, shell:false spawn | All API route handlers |
| DoS via request flooding | Rate limiting per key, 429 + Retry-After | LiteLLM config, nginx |
| Security incident undetected | Structured audit logs, no secret values | logs/audit.log |
| Environment contamination | Separate ZFS datasets, Docker networks, env files | docker-compose.yml, ZFS datasets |

---

## Emergency Response

If a security incident is detected:

1. **Isolate** — disconnect affected service from network
2. **Rotate** — all secrets in the affected environment
3. **Audit** — review logs from the past 30 days
4. **Report** — document timeline and actions taken
5. **Restore** — from last known-good snapshot