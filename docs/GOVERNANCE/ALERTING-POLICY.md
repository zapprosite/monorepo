---
version: 1.0
author: will-zappro
date: 2026-04-14
review-cycle: monthly
---

# SRE Alerting & Escalation Policy

**Host:** will-zappro
**Scope:** homelab-monorepo (/srv/monorepo)
**Stack:** Prometheus + AlertManager + Grafana + SRE Monitor + Cloudflare Health Checks
**Related:** [SPEC-023](./SPECS/SPEC-023-unified-monitoring-self-healing.md), [SPEC-040](./SPECS/SPEC-040-homelab-alerting-rate-limit.md), [INCIDENTS.md](./INCIDENTS.md)

---

## 1. Alert Severity Levels

| Level | Name | Icon | Color | Response Time | Example |
|-------|------|------|-------|---------------|---------|
| **P1** | CRITICAL | 🔴 | Red | Immediate (< 1 min) | Service completely down, data loss risk, security breach |
| **P2** | HIGH | 🟠 | Orange | 5 minutes | Performance degraded, partial outage |
| **P3** | MEDIUM | 🟡 | Yellow | 15 minutes | Warning signs, restart loops |
| **P4** | LOW | ⚪ | Gray | Next business day | Info, health mismatches, resource warnings |

### P1 — CRITICAL (Immediate Action Required)

**Definition:** Service completely down, data loss risk, or security breach.

**Examples:**
- Container in `dead`/`exited` state (non-immutable)
- Subdomain returning HTTP 000 (connection refused)
- Disk space < 5%
- GPU cryptojacking suspected (unknown process on GPU)
- Docker daemon unresponsive
- ZFS pool degraded

**Notification:**
- Telegram: `@will` + broadcast to alerting channel
- AlertManager: Routes to `telegram-critical` receiver

**Actions:**
1. SRE Monitor attempts container restart (if not immutable)
2. If restart fails → manual intervention required
3. Create incident in INCIDENTS.md
4. Escalate if not resolved in 10 minutes

---

### P2 — HIGH (5-Minute Response)

**Definition:** Performance degraded, partial outage, or service returning errors.

**Examples:**
- Container `unhealthy` (healthcheck failing)
- Subdomain returning HTTP 502/503
- CPU > 90% sustained 5 minutes
- Memory > 90% sustained 5 minutes
- GPU memory > 98% sustained 3 minutes
- GPU temperature > 80°C sustained 5 minutes

**Notification:**
- Telegram: `@will` only
- AlertManager: Routes to `telegram-warning` receiver

**Actions:**
1. SRE Monitor attempts container restart (if not immutable)
2. Check logs: `docker logs <container> --tail 50`
3. If restart loop detected (3 restarts in 30 min) → block healing, escalate to P1
4. Monitor for 15 minutes post-incident

---

### P3 — MEDIUM (15-Minute Response)

**Definition:** Warning signs, restart loops, or non-critical health mismatches.

**Examples:**
- Container restarting repeatedly (but below threshold)
- Health endpoint returning unexpected HTTP code
- Resource usage > threshold but below critical
- SRE Monitor skipped healing due to restart loop guard
- Container `restarting` state

**Notification:**
- Gotify: P3 channel (port 8050)
- Log only: `/srv/ops/logs/sre-monitor.log`

**Actions:**
1. Log to `/srv/ops/logs/healing.log` with reason
2. Run RCA via `rca_container` function
3. Monitor发展趋势 — if pattern worsens, escalate
4. No automatic restart (guarded by restart loop detection)

---

### P4 — LOW (Next Business Day)

**Definition:** Informational alerts, health mismatches, or minor issues.

**Examples:**
- Subdomain returning HTTP 301/302 (redirect, not an error)
- Container health `starting` (still initializing)
- Resource usage approaching threshold
- SRE Monitor completed with healed/failed counts
- Cloudflare tunnel latency spike

**Notification:**
- Grafana dashboard only
- Log to `/srv/ops/logs/sre-monitor.log`

**Actions:**
1. Log for trend analysis
2. No immediate action required
3. Review in weekly SRE review

---

## 2. Alert Sources & Routing

### 2.1 Prometheus + AlertManager Pipeline

```
Prometheus ──→ AlertManager ──→ alert-sender:8080/webhook ──→ Telegram
                                              │
                                     Gotify (P3/P4)
```

**AlertManager Config:**
```yaml
route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  routes:
    - match:
        severity: critical
      receiver: telegram-critical
      group_wait: 0s
    - match:
        severity: warning
      receiver: telegram-warning
    - match:
        severity: info
      receiver: gotify
    - match:
        severity: debug
      receiver: 'null'
```

### 2.2 SRE Monitor Cron (`sre-monitor.sh`)

**Schedule:** `*/5 * * * *` (every 5 minutes)

**Checks:**
1. Coolify apps (via Docker inspect)
2. Docker containers (all)
3. Health endpoints (HTTP checks)
4. Resource usage (CPU > 70%, Memory > 80%)
5. Subdomain tunnel status (HTTPS checks)

**Output:**
- `/srv/ops/logs/sre-monitor.log` — main log
- `/srv/ops/logs/healing.log` — heal attempts
- `/srv/ops/logs/resource-alerts.log` — resource warnings
- `/srv/ops/logs/rca.log` — root cause analysis

### 2.3 Cloudflare Health Checks

**Method:** `GET https://<subdomain>` with timeout 15s

| HTTP Code | Interpretation |
|-----------|---------------|
| 000 | Connection refused — service down |
| 200 | Healthy |
| 301/302 | Redirect (Cloudflare Access) — healthy |
| 502/503 | Backend error — degraded |
| Other | Investigate |

---

## 3. Escalation Policy

### 3.1 When to Escalate

| From | To | Trigger |
|------|-----|---------|
| P1 | — | Immediate, no auto-resolution |
| P2 | P1 | Not resolved in 10 minutes |
| P3 | P2 | Restart loop detected (3x in 30 min) |
| P4 | P3 | Pattern persists 24+ hours |

### 3.2 Escalation Chain

```
P1 Alert
    │
    ├──→ Telegram (@will + broadcast)
    ├──→ SRE Monitor attempts heal (if allowed)
    │         │
    │         ├──→ Success → Monitor for 15 min
    │         └──→ Failure → Manual intervention
    │                       ├──→ Check logs
    │                       ├──→ RCA
    │                       └──→ Create INC-XXX in INCIDENTS.md
    │
    └──→ Escalate if unresolved in 10 min
              │
              └──→ Page secondary on-call (future)
```

### 3.3 Immutable Services (Never Auto-Heal)

These services are never restarted automatically:

```
coolify-proxy cloudflared coolify-db prometheus grafana loki
alertmanager coolify-redis
```

**Action:** Log `CRITICAL IMMUTABLE — NO ACTION PERMITTED` and escalate immediately.

---

## 4. Healing Logic

### 4.1 Restart Loop Guard

**Threshold:** 3 heal attempts in 30-minute rolling window

**Behavior:**
- Count exceeds threshold → block healing, log `RESTART_LOOP_BLOCKED`
- Escalate to P2 for manual review

**Reset:** Successful healthy run clears the counter

### 4.2 Heal Verification

After each restart:
1. Wait 15 seconds
2. Check container state and health
3. If `running` + (`healthy` or `none`) → success
4. If `running` + `unhealthy` → partial success, monitor closely
5. If not `running` → failed, needs manual intervention

### 4.3 RCA Triggers

Run root cause analysis before healing:
- Container restart attempt
- Healthcheck failure
- Unexpected exit

**RCA Patterns:**
| Pattern | Cause | Suggestion |
|---------|-------|------------|
| `dockerd: not found` | DinD issue | Container requires Docker but daemon not available |
| `connection refused` | Backend not running | Service not started or port blocked |
| `permission denied` | Volume mount issue | Check permissions |
| `ENOENT` | Missing file | Missing dependency |
| `out of memory` | OOM | Increase memory limit |
| `404` | Misconfigured route | Check health endpoint |
| `500` | App error | Check application logs |

---

## 5. Notification Channels

### 5.1 Telegram

| Channel | Severity | URL |
|---------|----------|-----|
| `telegram-critical` | P1 | `@will` + homelab-alerts |
| `telegram-warning` | P2 | `@will` only |

**Via alert-sender:** `POST http://alert-sender:8080/webhook`

### 5.2 Gotify

| Channel | Severity | Port |
|---------|----------|------|
| Default | P3/P4 | 8050 |

### 5.3 Grafana

**Dashboards:**
- Homelab Overview (containers, GPU, subdomains)
- Rate Limiting (RPM per service)
- Alert State (firing/pending/none)

---

## 6. Runbooks

### RB-01: Container Down (P1)

```bash
# 1. Check container state
docker inspect <container> --format='{{.State.Status}}:{{.State.Health.Status}}'

# 2. Check logs
docker logs <container> --tail 50

# 3. If not immutable, attempt restart
docker restart <container>

# 4. Wait and verify
sleep 15
docker inspect <container> --format='{{.State.Status}}:{{.State.Health.Status}}'

# 5. If still failing, RCA
docker logs <container> --tail 20 2>&1 | grep -E "error|Error|ERROR|fatal|FATAL"

# 6. Document in INCIDENTS.md
```

### RB-02: Restart Loop Detected (P2→P1)

```bash
# 1. Check heal timestamps
cat /srv/ops/logs/.heal-timestamps.<container>

# 2. Run full RCA
docker logs <container> --tail 100

# 3. Check resource limits
docker stats <container> --no-stream

# 4. Check dependencies
docker ps --format '{{.Names}}\t{{.Status}}'

# 5. Manual intervention required — do NOT auto-heal
# 6. Document in INCIDENTS.md
```

### RB-03: Subdomain Down (P1)

```bash
# 1. Check tunnel status
docker ps | grep cloudflared

# 2. Check DNS
dig <subdomain>
# or
nslookup <subdomain>

# 3. Check cloudflared logs
docker logs cloudflared --tail 50

# 4. If cloudflared down, restart
docker restart cloudflared

# 5. Verify
curl -sk -o /dev/null -w "%{http_code}" https://<subdomain>
```

### RB-04: GPU Cryptojacking Suspected (P1)

```bash
# 1. Check GPU processes
nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv

# 2. Identify unknown process
ps aux | grep <pid>

# 3. Check if legitimate
docker ps --format '{{.Names}}' | grep <process_name>

# 4. If malicious:
#    - Kill process immediately
#    - docker stop <container>
#    - Document in INCIDENTS.md
#    - Investigate how attacker gained access
```

---

## 7. Alert Integration Matrix

| Source | P1 | P2 | P3 | P4 |
|--------|----|----|----|----|
| Prometheus/AlertManager | Telegram | Telegram | Gotify | Grafana |
| SRE Monitor | Telegram | Telegram | Gotify | Log only |
| Cloudflare Health | Telegram | Telegram | Log | Log |
| Manual (human) | PagerDuty (future) | Email | Log | Log |

---

## 8. Configuration

### 8.1 Thresholds

| Metric | Warning | Critical | Unit |
|--------|---------|----------|------|
| CPU | 70 | 90 | % |
| Memory | 80 | 90 | % |
| Disk | 15 | 5 | % |
| GPU Memory | 90 | 98 | % |
| GPU Temp | 80 | 85 | °C |
| GPU Util | 90 | 98 | % |

### 8.2 Timing

| Parameter | Value | Description |
|-----------|-------|-------------|
| `HEAL_WINDOW_SECONDS` | 1800 | 30-minute rolling window |
| `HEAL_THRESHOLD` | 3 | Max heal attempts in window |
| `SRE_MONITOR_INTERVAL` | 5 | Minutes between runs |
| `HEALTH_CHECK_TIMEOUT` | 10 | Seconds for HTTP checks |
| `SUBDOMAIN_CHECK_TIMEOUT` | 15 | Seconds for subdomain checks |

---

## 9. Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| SC-1 | P1 alerts reach Telegram < 30s | Container DOWN → Telegram notification |
| SC-2 | P2 alerts reach Telegram < 5 min | Unhealthy container → Telegram |
| SC-3 | Restart loop guard prevents infinite restarts | 4th restart in 30 min → blocked |
| SC-4 | Immutable services never restarted | coolify-proxy, grafana, etc. never touched |
| SC-5 | SRE Monitor heals non-immutable containers | Unhealthy → restart → healthy |
| SC-6 | RCA logged for every heal | Check `/srv/ops/logs/rca.log` |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-14 | will-zappro | Initial version based on SPEC-023, SPEC-040 |

---

**Next Review:** 2026-05-14
