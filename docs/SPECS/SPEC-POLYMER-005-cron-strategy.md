# SPEC-POLYMER-005 — Cron Strategy
**Status:** ACTIVE
**Version:** 1.0.0
**Last Audit:** 2026-05-01

---

## Architecture Reality (Audited)

```
REAL SERVICES (2026-05-01):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service          Container              Port(s)    Auth          Collections/Stores
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Qdrant           hermes-qdrant (Docker) 6333/6334  API key req   12 collections:
                                                        • will (Mem0)
                                                        • second-brain
                                                        • claude-code-memory
                                                        • monorepo-context_staging
                                                        • hvac_manuals_v1
                                                        • hvac_field_experience_v1
                                                        • cursor-projects
                                                        • codex-repo
                                                        • skills
                                                        • learnings
                                                        • mem0migrations
                                                        • vscode-memory

Mem0             INSIDE hermes-orchestrator  N/A     runs in container
                 (NOT standalone at 8642)

PostgreSQL       crm-postgres (Docker)   5432/tcp   password      n8n + others

Second Brain     ~/Desktop/hermes-second-brain/  GIT  none         TREE.md, SOUL.md, CLAUDE.md

Ollama           native                  11434      none          qwen2.5vl:3b (3.2GB), qwen2.5:3b (1.9GB), nomic-embed-text (274MB)

Hermes Agent     hermes-orchestrator     8092       none          skills, memory, agents

Hermes API       FastAPI (new)          8093       none          rate limiter, task queue

HERMES PLATFORM @8642 → Hermes Agent platform (NOT Mem0 API)
  • /health → {"status": "ok", "platform": "hermes-agent"}
  • Real Mem0 runs INSIDE hermes-orchestrator container
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Cron Jobs Running (Systemd Timers)

### HERMES-OPS (Health + Self-Healing)
```
*/5min  hermes-ops-health.timer        → SRE check (all endpoints)
*/10min hermes-ops-docker-health.timer → Docker containers + self-heal
*/30min hermes-ops-disk-health.timer   → Auto-prune @ 85% disk
*/5min  hermes-ops-metrics.timer       → Metrics collection
Daily   hermes-ops-report.timer        → 6AM JSON report
```

### HERMES-BACKUP (Disaster Recovery)
```
Daily 3AM   hermes-backup-snapshot.timer     → ZFS snapshot
Daily 4AM   hermes-backup-incremental.timer  → ZFS incremental → tank/backup
Daily 5AM   hermes-backup-postgres.timer     → PostgreSQL (docker exec)
Daily 6AM   hermes-backup-qdrant.timer       → Qdrant all 12 collections
Daily 7AM   hermes-backup-ollama.timer       → Ollama model registry
Daily 8AM   hermes-backup-brain.timer        → Second Brain git archive
Sun 3AM      hermes-backup-weekly.timer       → ZFS scrub + prune 90d
```

### HERMES-SECURITY (Autonomous Audit)
```
*/15min hermes-security-fail2ban.timer  → fail2ban status + bans
*/30min hermes-security-deep.timer     → UFW + SSH + Docker + secrets scan
Daily    hermes-security-report.timer  → Daily security report
```

---

## Self-Healing Patterns

| Code | Trigger | Action |
|------|---------|--------|
| HEAL-001 | Docker container crashed/exited | Auto-restart |
| HEAL-002 | Disk > 85% | Docker system prune |
| HEAL-003 | Disk > 90% | Escalate |
| HEAL-004 | Service down | systemctl restart |
| HEAL-005 | ZFS degraded | zpool scrub |
| SEC-HEAL-001 | fail2ban down | Auto-restart |
| SEC-HEAL-002 | UFW inactive | Reactivate |
| SEC-HEAL-003 | Docker daemon.json missing | Recreate with security defaults |

---

## Escalation Path

```
Self-heal fails 3x
       ↓
POST http://localhost:8093/enqueue
       ↓
Hermes Supervisor (port 8093)
       ↓
Route by mode:
  EMERGENCY → security agent
  SENIOR    → security + docs agent  
  JUNIOR    → sre agent
  DEV       → dev agent
```

---

## Backup Verification

- ZFS snapshot count < 7 → escalate
- PostgreSQL dump < 1KB → escalate
- Qdrant collections < 12 → escalate
- Second Brain tarball missing → escalate
- Ollama models < 1 → log warning

---

## Scripts Location

```
/srv/ops/scripts/
├── hermes-ops.sh          # Master orchestration
├── hermes-ops-health.sh   # SRE health check
├── hermes-ops-docker.sh   # Docker self-heal
├── hermes-backup.sh       # Unified backup (FIXED)
├── hermes-security.sh     # Security audit
├── install-hermes-ops.sh   # Timer installer
└── install-hermes-backup.sh

Logs: /srv/ops/logs/{sre,backup,security}/
State: /srv/ops/state/
```

---

## Known Issues

1. **Mem0 @ 8642 is NOT Mem0** — The Mem0 runs inside hermes-orchestrator container. Port 8642 is Hermes Agent platform health. No standalone backup needed.
2. **Qdrant API key required** — All Qdrant operations use `QDRANT_API_KEY` from secrets.env
3. **PostgreSQL via docker exec** — `docker exec crm-postgres pg_dump` NOT native pg_dump
4. **Second Brain path** — `~/Desktop/hermes-second-brain/` NOT in monorepo

---

## Audit Trail

| Date | Auditor | Finding |
|------|---------|---------|
| 2026-05-01 | Hermes | Full architecture audit — found Mem0 @8642 is NOT Mem0, Second Brain never backed up, PostgreSQL backup wrong method |
