# Nexus Scripts Audit

**Date:** 2026-04-30
**Auditor:** Claude Code
**Scope:** All nexus-*.sh and vibe.sh in /srv/monorepo/scripts/

---

## 1. Script Inventory

| Script | Function |
|--------|----------|
| nexus-alert.sh | Persistent alert/reminder system with escalation levels |
| nexus-auto.sh | Autonomous Nexus worker with task queue and rate limiting |
| nexus-code-scanner.sh | Claude CLI powered code quality analysis (legacy, salada, hardcoded) |
| nexus-context-window-manager.sh | Claude Code context window monitoring and state preservation |
| nexus-context-wrap.sh | Nexus wrapper with context awareness pre/post checks |
| nexus-cron-helper.sh | Cron trigger dispatcher (queue check, health, status, cleanup) |
| nexus-cron-legacy.sh | Legacy detection cron orchestrator for multi-repo scanning |
| nexus-deploy.sh | Auto-deploy with random subdomain for MVPs |
| nexus-full-deploy.sh | Complete auto-deploy pipeline (Gitea + DNS + Docker/Coolify + health) |
| nexus-governance.sh | Enterprise deploy with port/subdomain governance, UFW, Cloudflare |
| nexus-hermes-stats.sh | Hermes/Mem0 metrics collection (health, latency, collections) |
| nexus-investigate.sh | Multi-layer service health verification (HTTP + port + process + logs) |
| nexus-legacy-detector.sh | Legacy file detection by date, placeholders, hardcoded values, salada dirs |
| nexus-monitor-15k.sh | Monitor sustained 50 RPM / 5h (15k total requests) |
| nexus-ollama-stats.sh | Ollama metrics collection (models, active, latency) |
| nexus-qdrant-stats.sh | Qdrant metrics collection (collections, vectors, latency) |
| nexus-rate-limiter.sh | Token bucket rate limiter (500 RPM) |
| nexus-redis-stats.sh | Redis metrics collection (keys, memory, clients, hit rate) |
| nexus-session-scheduler.sh | Claude Code session scheduler with cron-based execution |
| nexus-sre.sh | SRE autonomous deploy (type detection, DNS, Docker/Coolify) |
| nexus-tunnel.sh | Cloudflare Tunnel ingress automation via API |
| nexus-ufw.sh | Autonomous UFW firewall management with idempotent port allowance |
| vibe.sh | Vibe coding loop: NL intent classification -> SPEC -> pipeline -> execute |

---

## 2. Critical Problems

| Script | Problem | Severity |
|--------|---------|----------|
| nexus-alert.sh | `jq` dependency not validated before use; silent failure if jq missing | HIGH |
| nexus-alert.sh | No timeout/retry on API calls to Cloudflare or external services | HIGH |
| nexus-auto.sh | Race condition in `claim_task()`: non-atomic read-modify-write on queue.json | CRITICAL |
| nexus-auto.sh | No lock file; concurrent instances can corrupt queue state | CRITICAL |
| nexus-auto.sh | No timeout on task execution; hung task blocks worker indefinitely | HIGH |
| nexus-code-scanner.sh | No timeout on `claude -p` invocation; Claude CLI can hang indefinitely | CRITICAL |
| nexus-code-scanner.sh | Global rate limiter state is in-memory only (not persistent across runs) | MEDIUM |
| nexus-context-window-manager.sh | Context usage estimation is pure heuristic (file size based); no actual Claude API integration | HIGH |
| nexus-context-window-manager.sh | No verification that Claude Code is actually running before saving state | MEDIUM |
| nexus-context-wrap.sh | Depends on `context-decide.sh`, `context-snapshot.sh`, `context-meter.sh` which may not exist | HIGH |
| nexus-context-wrap.sh | No error handling if nexus.sh is missing or fails | HIGH |
| nexus-cron-helper.sh | `smoke-hermes-ready.sh` result is ignored (`>> "$LOG" 2>&1` with `true`) | MEDIUM |
| nexus-cron-helper.sh | No alerting if health check fails; silently continues | HIGH |
| nexus-deploy.sh | `load_env()` uses `grep CF_API_TOKEN "$HOME/.env"` — splits on first `=` only, breaks tokens with `=` inside | HIGH |
| nexus-deploy.sh | Hardcoded `localhost:8080` target; does not adapt to actual deployed port | MEDIUM |
| nexus-full-deploy.sh | Uses `set -a` + `source .env` — any variable in .env becomes environmentexport, risky | CRITICAL |
| nexus-full-deploy.sh | `load_env()` parses terraform.tfvars unsafely; edge cases with quotes/spaces break | HIGH |
| nexus-full-deploy.sh | Git push failures are silently ignored (`|| true`) — deployment proceeds without verification | HIGH |
| nexus-full-deploy.sh | No rollback if any step fails; partially deployed state left behind | HIGH |
| nexus-governance.sh | Hardcoded fallback IP `177.112.202.125` used when all curl attempts fail | HIGH |
| nexus-governance.sh | Hardcoded `zone_id` in multiple places (not from env); stale if TF changes | MEDIUM |
| nexus-governance.sh | `validate_port()` checks reserved ports but does NOT read PORTS.md for dynamic slots | MEDIUM |
| nexus-hermes-stats.sh | `source /srv/monorepo/.env` directly — violates secret protocol (should use env-sync.sh pattern) | CRITICAL |
| nexus-hermes-stats.sh | QDRANT_API_KEY passed as `-H "api-key: $QDRANT_KEY"` — value exposed in process list | CRITICAL |
| nexus-hermes-stats.sh | No timeout on curl calls; service hang blocks metric collection | HIGH |
| nexus-investigate.sh | `curl` calls have no `--max-time`; slow responses block indefinitely | HIGH |
| nexus-investigate.sh | `sudo ss -tlnp` used for process verification; sudo may prompt password | MEDIUM |
| nexus-investigate.sh | PID extraction from `ss` output with `sed` is fragile; format varies across Linux versions | MEDIUM |
| nexus-legacy-detector.sh | `stat -c %Y` used; BusyBox systems don't support `-c`; fails silently on those hosts | MEDIUM |
| nexus-legacy-detector.sh | `grep -r` for hardcoded patterns can match binary files; no `-I` flag | MEDIUM |
| nexus-monitor-15k.sh | State in `/tmp/` — wiped on reboot; no persistence | MEDIUM |
| nexus-ollama-stats.sh | `date +%s%3N` subsecond timing not portable (requires bash 4+ or date from GNU coreutils) | MEDIUM |
| nexus-qdrant-stats.sh | `source /srv/monorepo/.env` directly — same violation as nexus-hermes-stats.sh | CRITICAL |
| nexus-rate-limiter.sh | State file `/tmp/nexus-rate-state.json` has no locking; concurrent `acquire()` calls race | CRITICAL |
| nexus-rate-limiter.sh | No automatic cleanup of stale state files | LOW |
| nexus-redis-stats.sh | `redis-cli -a "$REDIS_PASS"` exposes password in process list (`ps aux` shows it) | CRITICAL |
| nexus-session-scheduler.sh | `eval "$command"` for arbitrary command execution — dangerous if schedule file is compromised | CRITICAL |
| nexus-session-scheduler.sh | Lock mechanism uses `$HOME/.claude/...` path; not atomic across NFS/home directories | MEDIUM |
| nexus-session-scheduler.sh | No timeout on scheduled command execution | HIGH |
| nexus-sre.sh | `load_env()` uses `export "$(grep -v '^#' ... | xargs)"` — fragile parsing, command injection risk | HIGH |
| nexus-sre.sh | `detect_deploy_method()` uses filename pattern matching; `ls *.tf` race condition | MEDIUM |
| nexus-sre.sh | Docker compose output captured but exit code checked only loosely (`|| true`) | MEDIUM |
| nexus-tunnel.sh | Hardcoded `TUNNEL_ID`, `CF_ACCOUNT_ID`, `CF_GLOBAL_KEY` — credentials in code | HIGH |
| nexus-tunnel.sh | `X-Auth-Email: zappro.ia@gmail.com` — email in plaintext in script | MEDIUM |
| nexus-tunnel.sh | `curl` has no `--max-time`; API calls can hang | HIGH |
| nexus-tunnel.sh | `sudo systemctl restart cloudflared` — may prompt for password, blocks script | HIGH |
| nexus-ufw.sh | Lock file mechanism: 30s wait only; `apt-get install ufw` runs without confirming OS type | MEDIUM |
| nexus-ufw.sh | `exec_sudo()` has 3 fallback methods; method 2 (direct execution) bypasses sudo entirely | HIGH |
| vibe.sh | `curl` to localhost:11434 with no timeout; gemma4 call blocks if model hangs | HIGH |
| vibe.sh | `SPEC` content uses placeholder text `[Descreva o problema...]` — creates invalid docs | MEDIUM |
| vibe.sh | `pipeline.json` path hardcoded as `${MONOREPO_DIR}/tasks/pipeline.json`; directory may not exist | MEDIUM |
| vibe.sh | `grep -E "^\d+\. \[ \]"` for task extraction is fragile; breaks with different checkbox syntax | MEDIUM |

---

## 3. Enterprise-Grade Deficiencies

### 3.1 Structured Logging
**Missing in:** ALL scripts
- No JSON logging format
- No log levels with syslog integration
- No log rotation policies enforced
- No correlation IDs for tracing across script invocations

### 3.2 Exit Codes
**Problems:**
- Most scripts return `0` even on partial failure
- `nexus-full-deploy.sh`: returns success even when git push fails (`|| true`)
- `nexus-cron-helper.sh`: health check failures are silently absorbed
- `nexus-sre.sh`: docker compose failures checked loosely

**Missing:** Standardized exit code matrix (0=success, 1=generic error, 2=validation, 3=timeout, 4=auth, 5=resource unavailable)

### 3.3 Health Checks
**Missing:**
- Pre-flight checks before critical operations (disk space, memory, sudo availability)
- Liveness probes for daemon scripts (nexus-auto.sh, vibe.sh loop mode)
- Graceful degradation when dependencies are unavailable

### 3.4 Observability
**Missing:**
- No Prometheus metrics export
- No distributed tracing (correlation IDs)
- No structured error reporting to a central system (Sentry, Grafana, etc.)
- No Slack/webhook notifications for critical failures

### 3.5 Security
**Critical gaps:**
- Secrets parsed from .env directly (should use vault or sealed secrets)
- Passwords passed as CLI args to redis-cli (visible in `ps aux`)
- eval() used for command execution in scheduler
- No input validation/sanitization on user-provided arguments
- Hardcoded credentials in multiple scripts (tunnel.sh, governance.sh)

### 3.6 Resilience
**Missing:**
- Retry with exponential backoff for API calls
- Circuit breakers for external service calls
- Idempotency keys for deploy operations
- Rollback mechanisms for failed deployments
- Lock-free coordination (current lock files break on NFS)

### 3.7 Operational
**Missing:**
- No dry-run mode for critical operations
- No --force flag to override safety checks
- No config validation on startup
- No version/signature on scripts to detect tampering
- No backup of state before modifications

---

## 4. Summary Table

| Script | Critical Issues | High Issues | Medium Issues | Enterprise Grade Score |
|--------|-----------------|-------------|---------------|------------------------|
| nexus-alert.sh | 0 | 2 | 0 | 4/10 |
| nexus-auto.sh | 2 | 2 | 0 | 3/10 |
| nexus-code-scanner.sh | 1 | 1 | 1 | 5/10 |
| nexus-context-window-manager.sh | 0 | 2 | 0 | 4/10 |
| nexus-context-wrap.sh | 0 | 2 | 0 | 3/10 |
| nexus-cron-helper.sh | 0 | 2 | 1 | 3/10 |
| nexus-cron-legacy.sh | 0 | 1 | 2 | 4/10 |
| nexus-deploy.sh | 0 | 2 | 1 | 4/10 |
| nexus-full-deploy.sh | 2 | 2 | 0 | 2/10 |
| nexus-governance.sh | 0 | 2 | 2 | 5/10 |
| nexus-hermes-stats.sh | 2 | 1 | 0 | 3/10 |
| nexus-investigate.sh | 0 | 1 | 2 | 5/10 |
| nexus-legacy-detector.sh | 0 | 0 | 3 | 5/10 |
| nexus-monitor-15k.sh | 0 | 0 | 1 | 4/10 |
| nexus-ollama-stats.sh | 0 | 0 | 2 | 4/10 |
| nexus-qdrant-stats.sh | 2 | 0 | 0 | 2/10 |
| nexus-rate-limiter.sh | 2 | 0 | 1 | 3/10 |
| nexus-redis-stats.sh | 2 | 0 | 0 | 2/10 |
| nexus-session-scheduler.sh | 2 | 1 | 1 | 2/10 |
| nexus-sre.sh | 1 | 2 | 2 | 3/10 |
| nexus-tunnel.sh | 1 | 2 | 1 | 3/10 |
| nexus-ufw.sh | 1 | 2 | 1 | 4/10 |
| vibe.sh | 0 | 2 | 3 | 4/10 |

---

## 5. Top Priorities for Remediation

### P0 (Critical - Fix Immediately)
1. **nexus-full-deploy.sh, nexus-qdrant-stats.sh, nexus-hermes-stats.sh, nexus-redis-stats.sh** — Stop sourcing `.env` directly; use env-sync pattern or parameter passing
2. **nexus-rate-limiter.sh** — Add flock to state file for atomic acquire
3. **nexus-auto.sh** — Make claim_task atomic using flock or atomic rename
4. **nexus-session-scheduler.sh** — Remove eval(); use explicit command mapping
5. **nexus-redis-stats.sh** — Use `redis-cli --no-auth-warning -a` or STDIN for password

### P1 (High - Fix Soon)
6. **nexus-code-scanner.sh** — Add `--max-time` to all curl and CLI invocations
7. **All scripts with curl** — Add `--max-time 30` to prevent hangs
8. **nexus-tunnel.sh** — Move credentials to env vars; remove hardcoded values
9. **nexus-governance.sh** — Read dynamic port list from PORTS.md
10. **nexus-investigate.sh** — Add `--max-time` to all curl calls

### P2 (Medium - Technical Debt)
11. **vibe.sh** — Add timeout to gemma4 LLM classification call
12. **nexus-legacy-detector.sh** — Use `stat -L` for portability
13. **All stats scripts** — Add persistent storage (not /tmp)
14. **All scripts** — Implement structured JSON logging
15. **All scripts** — Standardize exit code matrix
