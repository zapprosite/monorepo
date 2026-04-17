# Skill: Self-Healing Cron

**Purpose:** Automated monitoring and healing for homelab voice pipeline (Hermes Agent + LiteLLM + wav2vec2 + Traefik)
**Schedule:** Every 5 minutes (`*/5 * * * *`)
**Risk:** Medium (auto-restarts containers, limited to 3 attempts per hour per container)
**Output:** `/srv/ops/logs/self-healing.log`

---

## What It Monitors

### 1. Container Health

All critical containers must be **Up (healthy)**:

| Container | Purpose |
|-----------|---------|
| `hermes-agent-qgtzrmi6771lt8l7x8rqx72f` | Hermes Agent voice gateway |
| `zappro-litellm` | LiteLLM proxy (Ollama + OpenRouter) |
| `zappro-wav2vec2` | wav2vec2 STT service |
| `zappro-litellm-db` | LiteLLM PostgreSQL database |
| `coolify-proxy` | Traefik reverse proxy |

### 2. Route Health

Critical routes must return expected HTTP codes:

| Route | Expected | Purpose |
|-------|----------|---------|
| `http://localhost:80/ping` | 200 | Traefik alive |
| `https://bot.zappro.site/` | 200 or 401 | Hermes Agent routing via Cloudflare Tunnel |
| `http://localhost:4000/health` | 200 | LiteLLM proxy alive |
| `http://localhost:8201/health` | 200 | wav2vec2 STT alive |

### 3. Network Isolation

Container pairs that must share a Docker network:

| Pair | Required for |
|------|--------------|
| `coolify-proxy` <-> `hermes-agent-*` | Traefik routing to Hermes Agent |
| `zappro-litellm` <-> `zappro-wav2vec2` | STT requests from LiteLLM |

---

## Healing Actions

| Failure | Action | Auto-healable? |
|---------|--------|----------------|
| Container down/unhealthy | `docker restart` (max 3 attempts/hour) | Yes |
| Route returns 502/504 | Log and alert | No (unknown cause) |
| Network isolation detected | ALERT only | No (human required) |

---

## Rate Limiting

Restart attempts are tracked in `/tmp/container-restart-attempts.json`:

```json
{
  "hermes-agent-qgtzrmi6771lt8l7x8rqx72f": {"count": 2, "last_attempt": "2026-04-08T14:30:00Z"},
  "zappro-litellm": {"count": 0, "last_attempt": "1970-01-01T00:00:00Z"}
}
```

- **Max 3 restarts per container per hour**
- After 3 attempts: skip restart, alert instead
- Counter resets after 1 hour window

---

## Log Format

```
TIMESTAMP LEVEL ACTION TARGET DETAIL
```

Examples:

```
2026-04-08T14:35:00Z INFO CONTAINER_OK hermes-agent-qgtzrmi6771lt8l7x8rqx72f Status=running, Health=healthy
2026-04-08T14:40:00Z INFO RESTARTING zappro-litellm Attempt to heal container
2026-04-08T14:40:05Z HEALED RESTART_SUCCESS zappro-litellm Container restarted and healthy
2026-04-08T14:45:00Z ALERT ROUTE_FAILED litellm-health http://localhost:4000/health -> 000 (expected 200)
2026-04-08T14:50:00Z ALERT NETWORK_ISOLATED coolify-proxy<->hermes-agent-qgtzrmi6771lt8l7x8rqx72f No shared network - human intervention required
2026-04-08T14:55:00Z ALERT RATE_LIMITED hermes-agent-qgtzrmi6771lt8l7x8rqx72f Max restart attempts (3) reached in last hour
```

---

## JSON Status Output

The script outputs JSON to stdout for external monitoring:

```json
{
  "timestamp": "2026-04-08T14:55:00Z",
  "status": "DEGRADED",
  "healed": 1,
  "failed": 0,
  "alerts": 2,
  "details": {
    "containers_checked": 5,
    "routes_checked": 4,
    "network_pairs_checked": 2
  }
}
```

---

## Installation

### 0. Environment Setup

The script automatically sources `.env` from the monorepo root. Ensure tokens are available:

```bash
# Verify .env exists with required tokens
cat /srv/monorepo/.env | grep -E "LITELLM_KEY|MINIMAX_API_KEY"
```

### 1. Make script executable

```bash
chmod +x /srv/monorepo/docs/OPERATIONS/SKILLS/self-healing.sh
```

### 2. Install cron job

```bash
# Edit crontab
crontab -e

# Add this line:
*/5 * * * * /srv/monorepo/docs/OPERATIONS/SKILLS/self-healing.sh >> /srv/ops/logs/self-healing-cron.log 2>&1
```

### 3. Ensure log directory exists

```bash
sudo mkdir -p /srv/ops/logs
sudo chown $USER:$USER /srv/ops/logs
```

### 4. Test run

```bash
/srv/monorepo/docs/OPERATIONS/SKILLS/self-healing.sh
```

Expected output: JSON status with `status: "OK"` if all checks pass.

---

## How to Interpret Logs

### All Healthy

```
2026-04-08T14:00:00Z INFO SUMMARY self-healing All checks passed - no healing needed
{"status": "OK", "healed": 0, "failed": 0, "alerts": 0, ...}
```

### Container Healed

```
2026-04-08T14:05:00Z WARN CONTAINER_DOWN zappro-wav2vec2 Status=exited
2026-04-08T14:05:00Z INFO RESTARTING zappro-wav2vec2 Attempt to heal container
2026-04-08T14:05:05Z HEALED RESTART_SUCCESS zappro-wav2vec2 Container restarted and healthy
```

### Healing Failed (rate limited)

```
2026-04-08T14:10:00Z WARN CONTAINER_DOWN hermes-agent-qgtzrmi6771lt8l7x8rqx72f Status=exited
2026-04-08T14:10:00Z ALERT RATE_LIMITED hermes-agent-qgtzrmi6771lt8l7x8rqx72f Max restart attempts (3) reached in last hour
```

### Route Failure

```
2026-04-08T14:15:00Z ALERT ROUTE_FAILED litellm-health http://localhost:4000/health -> 000 (expected 200)
```

This means LiteLLM is not responding. Possible causes:
- `zappro-litellm` container is down
- LiteLLM process crashed inside container
- Port 4000 not exposed on host

**Action:** Check container status manually, then check LiteLLM logs.

---

## What to Do When ALERT is Logged

### ALERT NETWORK_ISOLATED

**Severity:** High
**Human intervention required.**

Network isolation means containers cannot communicate. This is the root cause identified in INCIDENT-2026-04-08.

1. Check container networks:
   ```bash
   docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool
   docker inspect hermes-agent-qgtzrmi6771lt8l7x8rqx72f --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool
   ```

2. Find shared network:
   ```bash
   # Look for networks common to both containers
   ```

3. Connect containers to same network:
   ```bash
   docker network connect <shared-network> <container-name>
   ```

4. Verify:
   ```bash
   /srv/monorepo/docs/OPERATIONS/SKILLS/self-healing.sh
   ```

### ALERT ROUTE_FAILED

**Severity:** Medium
**Manual investigation required.**

Route returning unexpected code (not 502/504 auto-restart):
- `000` = connection refused / timeout
- 500 = internal server error

1. Check container is running:
   ```bash
   docker ps | grep <container-name>
   ```

2. Check container logs:
   ```bash
   docker logs <container-name> --tail 50
   ```

3. Enter container and test:
   ```bash
   docker exec -it <container-name> sh
   curl -v http://localhost:<port>/health
   ```

### ALERT RATE_LIMITED

**Severity:** Medium
**Possible restart loop.**

Container has been restarted 3+ times in the last hour without staying healthy.

1. Check container logs for recurring errors:
   ```bash
   docker logs <container-name> --tail 100
   ```

2. Check container restart count:
   ```bash
   docker inspect <container-name> --format '{{.RestartCount}}'
   ```

3. Possible causes:
   - OOM (Out of Memory) kills
   - Crash loop from misconfiguration
   - Dependency not available

4. **Do not keep restarting** — investigate root cause first.

---

## When to Escalate

Escalate to human intervention when:

1. **ALERT NETWORK_ISOLATED** — network misconfiguration
2. **ALERT RATE_LIMITED** — restart loop, underlying issue not resolved
3. **Multiple containers down simultaneously** — host or Docker daemon issue
4. **Route failures persist after container restart** — routing configuration issue

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `tail -f /srv/ops/logs/self-healing.log` | Watch live logs |
| `grep ALERT /srv/ops/logs/self-healing.log` | Find all alerts |
| `cat /tmp/container-restart-attempts.json` | Check rate limit state |
| `/srv/monorepo/docs/OPERATIONS/SKILLS/self-healing.sh` | Manual run |
| `docker ps --format '{{.Names}}\t{{.Status}}'` | Quick container status |

---

## Files

| File | Purpose |
|------|---------|
| `/srv/monorepo/docs/OPERATIONS/SKILLS/self-healing.sh` | The script |
| `/srv/ops/logs/self-healing.log` | Human-readable log |
| `/tmp/container-restart-attempts.json` | Rate limiting state |

---

## Related Incidents

- `INCIDENT-2026-04-08-voice-pipeline-stable.md` — Root cause analysis and prevention plan
- `INCIDENT-2026-04-08-wav2vec2-network-isolation.md` — Network isolation root cause

---

## See Also

- `container-self-healer.md` — Heals containers in Created/Exited state
- `traefik-health-check.md` — Traefik diagnostics
- `litellm-health-check.md` — LiteLLM diagnostics
- `wav2vec2-health-check.md` — wav2vec2 diagnostics
- `verify-network.sh` — Network connectivity verification
