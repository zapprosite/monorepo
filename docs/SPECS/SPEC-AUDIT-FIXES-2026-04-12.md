---
name: SPEC-AUDIT-FIXES
description: Fixes operacionais identificados na auditoria 12/04/2026
status: PROPOSED
priority: critical
author: will-zappro
date: 2026-04-12
specRef: SPEC-AUDIT-HOMELAB-2026-04-12.md
---

# SPEC-AUDIT-FIXES — Operacional Stability Fixes

## Objective

Aplicar os 5 fixes críticos identificados na auditoria homelab de 12/04/2026 para estabilizar o ambiente antes de continuar com features novas.

---

## Context

Auditoria com 15 agents identificou gaps operacionais críticos:
- TTS Bridge DOWN (OOM) — OpenClaw violando governance
- voice-pipeline-loop cron missing — sem auto-healing automático
- ZFS ARC conflitando com containers — 7.8GB/8GB swap usado
- chat.zappro.site sem Access policy — OpenWebUI exposto
- Gitea backup missing — só Qdrant tem no cron

---

## Fixes

### Fix 1: Restart TTS Bridge com Memory Limits

**Problema:** TTS Bridge exit 137 (OOM), OpenClaw usando Kokoro direto :8880 com pm_alex

**Solução:**
```bash
docker stop zappro-tts-bridge && docker rm zappro-tts-bridge
docker run -d --name zappro-tts-bridge \
  --memory=512m --memory-swap=512m \
  -p 127.0.0.1:8013:8013 \
  -v /srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge.py:/app/tts-bridge.py:ro \
  --network qgtzrmi6771lt8l7x8rqx72f \
  --restart unless-stopped \
  python:3.11-slim sh -c 'pip install fastapi uvicorn requests && python /app/tts-bridge.py'
curl -sf http://localhost:8013/health
```

**ACCEPTANCE CRITERIA:**
- [x] TTS Bridge responde 200 em localhost:8013/health
- [x] OpenClaw config usa Bridge (não :8880)
- [x] Voice pm_alex retorna 400 (governance enforced)

**Verification:**
- [DONE] 2026-04-12
- Evidence: `curl localhost:8013/health` → 200; `pm_alex` → 400; memory limit 512MB applied

---

### Fix 2: Ativar voice-pipeline-loop Cron

**Problema:** Script existe em tasks/smoke-tests/ mas não está no crontab

**Solução:**
```bash
mkdir -p /srv/monorepo/logs/voice-pipeline/
(crontab -l 2>/dev/null | grep -v voice-pipeline-loop; \
echo "*/5 * * * * /srv/monorepo/tasks/smoke-tests/voice-pipeline-loop.sh >> /srv/monorepo/logs/voice-pipeline/loop.log 2>&1") | crontab -
```

**ACCEPTANCE CRITERIA:**
- [x] Cron entry existe: `*/5 * * * *`
- [x] Script executa sem erro
- [x] Log file criado em /srv/monorepo/logs/voice-pipeline/loop.log

**Verification:**
- [DONE] 2026-04-12
- Evidence: `crontab -l` shows `*/5` entry; log file 75KB confirmed

---

### Fix 3: Fix ZFS ARC Memory Conflict

**Problema:** ZFS ARC tomando memória, 7.8GB/8GB swap usado

**Solução:**
```bash
sudo bash -c 'cat > /etc/modprobe.d/zfs-arc-limit.conf << EOF
options zfs zfs_arc_max=8589934592
options zfs zfs_arc_min=2147483648
EOF'
echo 8589934592 | sudo tee /sys/module/zfs/parameters/zfs_arc_max
cat /sys/module/zfs/parameters/zfs_arc_max
```

**ACCEPTANCE CRITERIA:**
- [x] zfs_arc_max = 8589934592 (8GB)
- [ ] swap usado < 50% após 1h (monitoring)
- [x] containers estáveis sem OOM

**Verification:**
- [DONE] 2026-04-12
- Evidence: `zfs_arc_max=8589934592` confirmed live; config persistent at `/etc/modprobe.d/zfs-arc-limit.conf`

---

### Fix 4: Verificar e Corrigir chat.zappro.site Access

**Problema:** OpenWebUI potencialmente exposto sem Cloudflare Access

**Solução:**
```bash
# Em /srv/ops — access.tf line 3
# ANTES: access_services = { for k, v in var.services : k => v if k != "bot" && k != "chat" }
# DEPOIS: access_services = { for k, v in var.services : k => v if k != "bot" }
cd /srv/ops/terraform/cloudflare && terraform plan && terraform apply
```

**ACCEPTANCE CRITERIA:**
- [x] curl https://chat.zappro.site/ retorna auth challenge ou redirect (302)
- [x] Terraform apply executado — Access App + Policy criados
- [x] Access policy existe em Cloudflare (ID 99c85419-ea36-464a-8d5b-64889889e2df)

**Verification:**
- [DONE] 2026-04-12
- Evidence: TF apply created `cloudflare_zero_trust_access_application.services["chat"]` + `cloudflare_zero_trust_access_policy.owners["chat"]`; 302 redirect confirmed on unauthenticated requests

---

### Fix 5: Adicionar Gitea e Infisical Backup ao Cron

**Problema:** Só Qdrant tem backup, Gitea e Infisical não têm

**Solução:**
```bash
# Gitea (02:30) — tar volume direto (git user não consegue gitea dump)
30 2 * * * sudo tar -czf /tmp/gitea-dump-$(date +\%Y\%m\%d).tar.gz -C /srv/data/gitea gitea/gitea.db git/repositories git/lfs gitea/attachments gitea/avatars gitea/sessions gitea/indexers gitea/conf gitea/queues gitea/actions_log gitea/actions_artifacts gitea/repo-archive gitea/repo-avatars gitea/packages 2>/dev/null && sudo cp /tmp/gitea-dump-$(date +\%Y\%m\%d).tar.gz /srv/backups/ 2>/dev/null && sudo rm /tmp/gitea-dump-$(date +\%Y\%m\%d).tar.gz; find /srv/backups/gitea-dump-*.tar.gz -mtime +7 -delete 2>/dev/null

# Infisical (02:45)
45 2 * * * docker exec infisical-db pg_dump -U infisical 2>/dev/null | sudo tee /srv/backups/infisical-db-$(date +\%Y\%m\%d).sql > /dev/null; find /srv/backups/infisical-db-*.sql -mtime +7 -delete 2>/dev/null
```

**ACCEPTANCE CRITERIA:**
- [x] Gitea dump executa sem erro
- [x] Arquivo .tar.gz aparece em /srv/backups/
- [x] Cron entry existe

**Verification:**
- [DONE] 2026-04-12
- Evidence: `gitea-dump-20260412.tar.gz` (4MB) + `infisical-db-20260412.sql` (911KB) em /srv/backups/

---

## Dependencies

Nenhum — todos fixes são independentes.

## Files Affected

- `docker-compose.yml` (TTS Bridge recreation)
- `crontab` (voice-loop + gitea-backup + infisical-backup)
- `/etc/modprobe.d/zfs-arc-limit.conf` (ZFS ARC)
- `/srv/ops/terraform/cloudflare/access.tf` (Access policy)
- `/srv/backups/` (Gitea dumps)
- `docs/SPECS/SPEC-AUDIT-FIXES-2026-04-12.md`
- `docs/SPECS/SPEC-AUDIT-HOMELAB-2026-04-12.md`

## Priority

CRITICAL — Estabilizar ambiente antes de continuar com SPECs novos.

---

## Verification Commands

```bash
docker ps | grep -E "tts-bridge|openwebui"
curl -sf http://localhost:8013/health
crontab -l | grep -E "voice-pipeline|gitea|infisical"
cat /sys/module/zfs/parameters/zfs_arc_max
curl -sf -o /dev/null -w "%{http_code}" https://chat.zappro.site/
ls -la /srv/backups/ | grep -E "gitea|infisical"
free -h
```
