---
name: SPEC-HOMELAB-SEGURO-ESTAVEL
description: Estabilização e segurança do homelab após auditoria 12/04/2026
status: IN_PROGRESS
priority: critical
author: will-zappro
date: 2026-04-12
specRef: SPEC-AUDIT-HOMELAB-2026-04-12.md, SPEC-AUDIT-FIXES-2026-04-12.md
---

# SPEC-HOMELAB-SEGURO-ESTAVEL — Homelab Security & Stability

## Objective

Estabilizar e proteger o homelab após auditoria de 12/04/2026 com 15 agents. Implementar governance, auto-healing, backups e monitoring como pilares de estabilidade operacional.

---

## Context

### Audit Findings Summary

| Finding | Severity | Status |
|---------|----------|--------|
| TTS Bridge OOM | Critical | ✅ Fixed |
| voice-pipeline-loop cron missing | High | ✅ Fixed |
| ZFS ARC conflicting with containers | Critical | ✅ Fixed |
| chat.zappro.site Access policy missing | Critical | ✅ Fixed (terraform) |
| Gitea backup missing | High | ✅ Fixed |
| OpenClaw usando Kokoro direto | Critical | ✅ Fixed |
| Infisical backup missing | Medium | ✅ Fixed |
| GH_TOKEN no .env | High | 🔄 In Progress |

---

## Components

### 1. Audio Stack Governance (SPEC-009)

**Problema:** OpenClaw Kokoro direto TTS Bridge

**Regras Imutáveis:**
- STT: wav2vec2 :8201 (nunca Deepgram direto)
- TTS: TTS Bridge :8013 (nunca Kokoro direto)
- Vozes: pm_santa (padrao), pf_dora (fallback) — todas outras 400
- LLM primario: MiniMax M2.7 direto (nao via LiteLLM)
- Vision: litellm/qwen2.5-vl

**Verification:**
```bash
curl -sf http://localhost:8013/health
curl -X POST http://localhost:8013/tts -d "text=ola&voice=pm_santa" | head -c 100
curl -X POST http://localhost:8013/tts -d "text=ola&voice=pm_alex" | grep -q "400" && echo "BLOCKED"
```

---

### 2. Memory Management

**ZFS ARC Limit:**
```
zfs_arc_max = 8589934592 (8GB)
zfs_arc_min = 2147483648 (2GB)
```

**Verification:**
```bash
cat /sys/module/zfs/parameters/zfs_arc_max  # deve mostrar 8589934592
free -h | grep -E "Swap|Mem"
```

**TTS Bridge Memory Limit:**
```
--memory=512m --memory-swap=512m
```

---

### 3. Backup Strategy

| Service | Schedule | Retention | Location |
|---------|----------|-----------|----------|
| Gitea | 02:30 daily | 7 dias | /srv/backups/gitea-dump-YYYYMMDD.tar.gz |
| Infisical | 02:45 daily | 7 dias | /srv/backups/infisical-db-YYYYMMDD.sql |
| Qdrant | 03:00 daily | 7 dias | /srv/backups/qdrant-YYYYMMDD.snap |
| ZFS pools | weekly | 4 semanas | zfs snapshot |

**Cron entries:**
```bash
30 2 * * * docker exec gitea gitea dump --database --target /tmp/gitea-dump-$(date +\%Y\%m%d).zip && cp /tmp/gitea-dump-*.zip /srv/backups/
45 2 * * * docker exec infisical infisical dump --env production > /srv/backups/infisical-db-$(date +\%Y\%m\%d).sql
```

---

### 4. Auto-Healing Pipeline

**voice-pipeline-loop.sh** executa a cada 5 minutos:
- Smoke test: TTS Bridge, OpenClaw, wav2vec2
- Auto-restart containers falhados
- Log em /srv/monorepo/logs/voice-pipeline/loop.log

**docker-autoheal** (container):
- Restart containers com HEALTHCHECK fallidos
- Rate limit: 3 restarts por hora por container

**Verification:**
```bash
docker ps | grep -E "autoheal|tts-bridge|openwebui|openclaw"
crontab -l | grep voice-pipeline
```

---

### 5. Monitoring Stack

**Prometheus targets (all UP ✅):**
- node-exporter :9100
- cadvisor :8080
- prometheus :9090
- grafana :3000
- alertmanager :9093

**Dashboards:**
- Grafana: http://10.0.5.1:3000 (admin configurado)
- Prometheus: http://10.0.5.1:9090

**Critical gaps (SPEC-023):**
- node-exporter HEALTHCHECK missing
- loki HEALTHCHECK missing
- restart loop protection
- cadvisor scrape timeout 30s

---

### 6. Cloudflare Access Policy

**chat.zappro.site:**
- App ID: 99c85419
- Policy ID: 4a668d84
-: `curl -sf -o /dev/null -w "%{http_code}" https://chat.zappro.site/` deve retornar auth challenge

---

### 7. Secrets Management

**GH_TOKEN:**
- Currently in /srv/monorepo/.env (not committed)
- Need: PAT with `repo` scope for merge operations
- Token atual: `ghp_...` (read-only, insufficient for merge)

**Infisical:**
- 144 secrets catalogued
- CLI login requires interactive session
- Secrets: COOLIFY_API_KEY, COOLIFY_URL, GH_TOKEN, etc.

---

## TODO

- [ ] Store GH_TOKEN with `repo` scope in Infisical
- [ ] Push /srv/ops terraform changes to git
- [ ] Apply memory limits to TTS Bridge container
- [ ] Fix node-exporter HEALTHCHECK
- [ ] Fix loki HEALTHCHECK
- [ ] Add restart loop protection
- [ ] Test cadvisor scrape timeout

---

## Dependencies

- SPEC-AUDIT-HOMELAB-2026-04-12.md
- SPEC-AUDIT-FIXES-2026-04-12.md
- SPEC-009-openclaw-persona-audio-stack.md
- SPEC-023-unified-monitoring-self-healing.md

---

## Files Affected

- `/srv/monorepo/.claude/scheduled_tasks.json`
- `/srv/ops/terraform/cloudflare/access.tf`
- `/etc/modprobe.d/zfs-arc-limit.conf`
- crontab entries (voice-pipeline, gitea-backup, infisical-backup)
- docker-compose.yml (TTS Bridge memory limits)

---

## Success Criteria

1. TTS Bridge responds 200 + pm_alex returns 400 ✅
2. ZFS ARC capped at 8GB ✅
3. voice-pipeline-loop cron active ✅
4. chat.zappro.site Access policy active ✅
5. Gitea + Infisical backups in cron ✅
6. Prometheus all targets UP ✅
7. GH_TOKEN stored in Infisical (PAT repo scope)
8. All containers stable >48h without OOM