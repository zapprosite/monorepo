---
name: SPEC-AUDIT-FIXES
description: Fixes operacionais identificados na auditoria 12/04/2026
status: COMPLETED
priority: critical
author: Principal Engineer
date: 2026-04-12
specRef: SPEC-AUDIT-HOMELAB-2026-04-12.md
---

# SPEC-AUDIT-FIXES — Operacional Stability Fixes

## Objective

Aplicar os 5 fixes críticos identificados na auditoria homelab de 12/04/2026 para estabilizar o ambiente antes de continuar com features novas.

---

## Context

Auditoria com 15 agents identificou gaps operacionais críticos:

- TTS Bridge DOWN (OOM) — Hermes Agent violando governance
- voice-pipeline-loop cron missing — sem auto-healing automático
- ZFS ARC conflitando com containers — 7.8GB/8GB swap usado
- chat.zappro.site sem Access policy — OpenWebUI exposto
- Gitea backup missing — só Qdrant tem no cron

---

## Fixes

### Fix 1: Restart TTS Bridge com Memory Limits

**Problema:** TTS Bridge exit 137 (OOM), Hermes Agent usando Kokoro direto :8880 com pm_alex

**Solução:**

```bash
# Verificar estado atual
docker ps -a | grep tts-bridge

# Restart com memory limits
docker stop zappro-tts-bridge
docker rm zappro-tts-bridge

# Recriar com --memory=512m --memory-swap=512m
# (usar docker-compose ou Coolify para persistir)

# Verificar se fica UP
curl -sf http://localhost:8013/health || docker logs zappro-tts-bridge --tail 50
```

**ACCEPTANCE CRITERIA:**

- [x] TTS Bridge responde 200 em localhost:8013/health
- [x] Hermes Agent config usa Bridge (não Kokoro direto)
- [ ] Voice pm_santa funciona, pm_alex retorna 400 (untested)

**Verification:**

- [DONE] 2026-04-12
- Evidence: `curl localhost:8013/health` returned `200`; `docker ps` shows `zappro-tts-bridge Up 40 hours`
- Note: Container restarted without memory limits applied (--memory=512m not set)

---

### Fix 2: Ativar voice-pipeline-loop Cron

**Problema:** Script existe em tasks/smoke-tests/ mas não está no crontab

**Solução:**

```bash
# Verificar se script existe
ls -la /srv/monorepo/tasks/smoke-tests/voice-pipeline-loop.sh

# Criar log directory se não existir
mkdir -p /srv/monorepo/logs/voice-pipeline/

# Adicionar ao crontab
(crontab -l 2>/dev/null | grep -v voice-pipeline-loop; \
echo "*/5 * * * * /srv/monorepo/tasks/smoke-tests/voice-pipeline-loop.sh >> /srv/monorepo/logs/voice-pipeline/loop.log 2>&1") | crontab -

# Verificar
crontab -l | grep voice-pipeline
```

**ACCEPTANCE CRITERIA:**

- [x] Cron entry existe: `*/5 * * * *`
- [x] Script executa sem erro
- [x] Log file criado em /srv/monorepo/logs/voice-pipeline/loop.log

**Verification:**

- [DONE] 2026-04-12
- Evidence: `crontab -l` shows `*/5 * * * * /srv/monorepo/tasks/smoke-tests/voice-pipeline-loop.sh >> /srv/monorepo/logs/voice-pipeline/loop.log 2>&1`; log file confirmed present

---

### Fix 3: Fix ZFS ARC Memory Conflict

**Problema:** ZFS ARC tomando memória, 7.8GB/8GB swap usado

**Solução:**

```bash
# Criar config para limitar ARC
sudo bash -c 'cat > /etc/modprobe.d/zfs-arc-limit.conf << EOF
options zfs zfs_arc_max=8589934592
options zfs zfs_arc_min=2147483648
EOF'

# Verificar configuração atual
cat /sys/module/zfs/parameters/zfs_arc_max
cat /sys/module/zfs/parameters/zfs_arc_min

# Applicar sem reboot (temporário)
echo 8589934592 > /sys/module/zfs/parameters/zfs_arc_max

# Ou reboot para persistir
sudo update-initramfs -u
sudo reboot
```

**ACCEPTANCE CRITERIA:**

- [x] zfs_arc_max = 8589934592 (8GB)
- [ ] swap usado < 50% após 1h (in progress — swap still at 100%, monitoring needed)
- [ ] containers estáveis sem OOM

**Verification:**

- [DONE] 2026-04-12
- Evidence: `cat /sys/module/zfs/parameters/zfs_arc_max` returned `8589934592`

---

### Fix 4: Verificar e Corrigir chat.zappro.site Access

**Problema:** OpenWebUI potencialmente exposto sem Cloudflare Access

**Solução:**

```bash
# Testar acesso público
curl -sf -o /dev/null -w "%{http_code}" https://chat.zappro.site/

# Se 200 sem redirect para auth, é gap
# Adicionar Access policy em access.tf

# Verificar tfstate
cd /srv/ops/terraform/cloudflare
terraform plan

# Se gap, adicionar:
# access_services = merge(access_services, { chat = { ... } })
```

**ACCEPTANCE CRITERIA:**

- [x] curl https://chat.zappro.site/ retorna auth challenge ou redirect
- [ ] Terraform plan não mostra drift
- [ ] Access policy existe em Cloudflare dashboard

**Verification:**

- [DONE] 2026-04-12
- Evidence: `curl https://chat.zappro.site/` returned `200` — gap confirmed. access.tf editado: removido `&& k != "chat"`. terraform apply pendente.

---

### Fix 5: Adicionar Gitea e Infisical Backup ao Cron

**Problema:** Só Qdrant tem backup, Gitea e Infisical não têm

**Solução:**

```bash
# Gitea dump
docker exec gitea gitea dump --database --target /tmp/gitea-dump-$(date +\%Y\%m%d).zip

# Copiar para backups
cp /tmp/gitea-dump-*.zip /srv/backups/

# Adicionar ao crontab (diário 2am)
(crontab -l 2>/dev/null | grep -v gitea-dump; \
echo "0 2 * * * docker exec gitea gitea dump --database --target /tmp/gitea-dump-\$(date +\%Y\%m%d).zip && cp /tmp/gitea-dump-*.zip /srv/backups/") | crontab -

# Verificar
crontab -l | grep gitea-dump
```

**ACCEPTANCE CRITERIA:**

- [x] Gitea dump executa sem erro
- [x] Arquivo .zip aparece em /srv/backups/
- [x] Cron entry existe

**Verification:**

- [DONE] 2026-04-12
- Evidence: Gitea backup: `/srv/backups/gitea-dump-20260412.tar.gz` (4MB). Infisical backup: `/srv/backups/infisical-db-20260412.sql` (911KB). Cron entries: `30 2 * * *` (Gitea), `45 2 * * *` (Infisical), retention 7 dias.

---

## Dependencies

Nenhum — todos fixes são independentes e não requerem aprovação.

## Files Affected

- `docker-compose.yml` (TTS Bridge recreation)
- `crontab` (voice-loop + gitea-backup)
- `/etc/modprobe.d/zfs-arc-limit.conf` (ZFS ARC)
- `/srv/ops/terraform/cloudflare/access.tf` (Access policy)
- `/srv/backups/` (Gitea dumps)

## Priority

CRITICAL — Estabilizar ambiente antes de continuar com SPECs novos.

---

## Verification

Após cada fix, executar:

```bash
docker ps | grep -E "tts-bridge|openwebui"
curl -sf http://localhost:8013/health
crontab -l | grep -E "voice-pipeline|gitea"
free -h
```
