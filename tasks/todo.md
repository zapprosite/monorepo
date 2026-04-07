# TODO — Home Lab Stabilization

**Host:** will-zappro
**Date:** 2026-04-07
**Goal:** "Quero um home lab estavel que eu não tenha que ficar me preocupando!"

---

## Phase 1: Alerting & Monitoring (Foundation)

- [ ] **TASK-1A:** Deploy AlertManager + Gotify
  - **Verification:** Alert fires on service down within 60 seconds
  - **Files:** `/srv/apps/monitoring/docker-compose.yml`, `/srv/apps/monitoring/alertmanager.yml`

- [ ] **TASK-1B:** Health check cron with AlertManager alerting
  - **Verification:** Cron runs every 5min, alerts fire on failure
  - **Files:** `/srv/ops/scripts/homelab-health-check.sh`

---

## Phase 2: Qdrant Backup System

- [ ] **TASK-2A:** Enhance Qdrant backup script
  - **Verification:** `tar -tzf` shows valid backup, old backups rotated
  - **Files:** `/srv/ops/scripts/backup-qdrant.sh`

- [ ] **TASK-2B:** Qdrant backup cron + weekly verification
  - **Verification:** Backup exists from today, weekly restore test passes
  - **Files:** cron entry, `/srv/ops/scripts/verify-qdrant-restore.sh`

---

## Phase 3: Internal DNS

- [ ] **TASK-3A:** Deploy CoreDNS
  - **Verification:** `curl http://qdrant:6333` works from any container
  - **Files:** `/srv/apps/dns/Corefile`, `/srv/apps/dns/docker-compose.yml`

- [ ] **TASK-3B:** Update service configs to use hostnames
  - **Verification:** `grep -r "10\.0\." /srv/apps/*/docker-compose.yml` returns nothing
  - **Files:** LiteLLM config.yaml, OpenClaw .env, n8n workflows

---

## Phase 4: Offsite Backup

- [ ] **TASK-4A:** Configure rclone to offsite target (Backblaze B2 or rsync.net)
  - **Verification:** `rclone listremotes` shows remote configured
  - **Files:** `/srv/ops/scripts/backup-offsite.sh`, `/root/.config/rclone/rclone.conf`

- [ ] **TASK-4B:** Offsite backup script + monitoring
  - **Verification:** Data exists offsite within 24h, Grafana shows backup age
  - **Files:** Prometheus alert rules for offsite backup

---

## Phase 5: Watchdog Stabilization

- [ ] **TASK-5A:** Diagnose watchdog cycling root cause
  - **Verification:** Root cause documented in `/srv/monorepo/docs/INFRASTRUCTURE/OPENCLAW_DEBUG.md`
  - **Files:** Investigation log

- [ ] **TASK-5B:** Stabilize Whisper STT endpoint
  - **Verification:** No cycling in 24h, STT responds consistently
  - **Files:** OpenClaw config, Whisper container config

---

## Critical Files Reference

| File | Phase | Purpose |
|------|-------|---------|
| `/srv/apps/monitoring/docker-compose.yml` | 1A | AlertManager + Gotify |
| `/srv/apps/monitoring/alertmanager.yml` | 1A | Alerting rules |
| `/srv/ops/scripts/homelab-health-check.sh` | 1B | Health check cron |
| `/srv/ops/scripts/backup-qdrant.sh` | 2A | Qdrant backup |
| `/srv/apps/dns/Corefile` | 3A | CoreDNS config |
| `/srv/apps/dns/docker-compose.yml` | 3A | CoreDNS service |
| `/home/will/zappro-lite/config.yaml` | 3B | LiteLLM config |
| `/srv/ops/scripts/backup-offsite.sh` | 4A | Offsite backup |
| `/root/.config/rclone/rclone.conf` | 4A | Rclone remote (secret) |
| `/data/.openclaw/openclaw.json` | 5B | OpenClaw STT config |

---

## Dependencies

```
Phase 1 (Alerting) ──► All other phases
Phase 2 (Qdrant) ─────► Phase 4 (offsite needs local first)
Phase 3 (DNS) ─────────► Phase 4, Phase 5
Phase 5 (Watchdog) ─────► Lowest priority, do last
```

---

**Last Updated:** 2026-04-07
