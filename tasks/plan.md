# Home Lab Stabilization Plan

**Host:** will-zappro
**Date:** 2026-04-07
**Goal:** "Quero um home lab estavel que eu não tenha que ficar me preocupando!"

---

## Executive Summary

O home lab tem uma base sólida (Coolify, ZFS, GPU, Cloudflare Tunnel) mas sofre de 5 gaps críticos que causam trabalho contínuo. Este plano endereça cada gap com slices verticais completos e verificáveis.

**Ordem de Prioridade:**
1. **Alerting** — Saber quando algo quebra ANTES dos usuários reclamarem
2. **Backup Qdrant** — Proteger o banco vetorial (o cérebro do sistema AI)
3. **DNS Interno** — Eliminar IPs hardcoded (fonte deQuebras futuras)
4. **Backup Offsite** — Recuperação de desastre
5. **Watchdog** — Parar o cycling entre Whisper/Deepgram

---

## Phase 1: Alerting & Monitoring Foundation

### TASK-1A: Deploy AlertManager + Gotify

**O que fazer:**
- Deploy AlertManager (Prometheus alerting) consumindo alertas do Prometheus
- Deploy Gotify (push notification server self-hosted)
- Configurar AlertManager para forwardar para Gotify
- Integrar com Telegram bot (@CEO_REFRIMIX_bot)

**Arquivos a criar/modificar:**
- `/srv/apps/monitoring/docker-compose.yml` — adicionar alertmanager, gotify
- `/srv/apps/monitoring/alertmanager.yml` — regras de alerting

**Critério de Aceite:**
- AlertManager recebe alertas do Prometheus
- Gotify recebe e exibe push notifications
- Telegram recebe alertas de serviços críticos

**Verificação:**
```bash
# Teste: parar um serviço e verificar se alerta dispara
docker stop qdrant
# Deve receber notificação Telegram em 60 segundos
docker start qdrant
```

---

### TASK-1B: Health Check Cron com Alerting

**O que fazer:**
- Criar/editar `/srv/ops/scripts/homelab-health-check.sh` para usar AlertManager
- Adicionar regras Prometheus para:
  - Container down (healthcheck failing)
  - ZFS pool degraded
  - GPU memory > 90%
  - Disk space < 10%
  - Service health endpoints failing

**Critério de Aceite:**
- Cron roda a cada 5 minutos
- Alertas disparam em até 5 minutos após falha
- Sem alert storms (deduplication)

**Verificação:**
```bash
# Verificar cron existe e ativo
crontab -l | grep health-check
# Verificar regras Prometheus carregadas
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.type=="alerting") | .name'
```

---

## Phase 2: Qdrant Backup System

### TASK-2A: Enhance Qdrant Backup Script

**O que fazer:**
- Melhorar `/srv/ops/scripts/backup-qdrant.sh` com:
  - Pre-backup health check (recusar backup se Qdrant unhealthy)
  - Suporte a backup incremental via Qdrant snapshot API
  - Verificação de backup (listar collections após restore dry-run)
  - Compressão otimizada
  - Retention policy (últimos 7 diários, 4 semanais, 12 mensais)

**Critério de Aceite:**
- Script produz backup válido que pode ser listado
- Backups antigos são rotacionados
- Backup roda sem lockar o banco

**Verificação:**
```bash
./backup-qdrant.sh
tar -tzf /srv/backups/qdrant/qdrant-backup-*.tar.gz | head
```

---

### TASK-2B: Qdrant Backup Cron + Verification

**O que fazer:**
- Agendar backup: diário às 03:00 (baixa atividade)
- Adicionar verificação semanal: domingo às 04:00
- Criar script de restore test:
  1. Sobe container Qdrant temporário
  2. Restaura do backup
  3. Verifica collections existem
  4. Destrói container temporário

**Critério de Aceite:**
- Backup roda diário sem intervenção
- Verificação semanal confirma backup restaurável
- Alerta dispara se backup está missing ou corrupto

**Verificação:**
```bash
ls -la /srv/backups/qdrant/
grep qdrant /var/log/syslog | tail -5
```

---

## Phase 3: Internal DNS (CoreDNS)

### TASK-3A: Deploy CoreDNS

**O que fazer:**
- Deploy CoreDNS como servidor DNS local
- Configurar resolução:
  - `qdrant` → IP do container
  - `litellm` → LiteLLM
  - `kokoro` → Kokoro TTS
  - `ollama` → Ollama
  - `openclaw` → OpenClaw
  - `n8n` → n8n
- Configurar systemd-resolved para usar CoreDNS
- Manter Cloudflare e DNS público como fallback

**Arquivos a criar:**
- `/srv/apps/dns/Corefile` — configuração CoreDNS
- `/srv/apps/dns/docker-compose.yml` — serviço CoreDNS

**Critério de Aceite:**
- `host qdrant` resolve do qualquer container
- `curl http://qdrant:6333/health` funciona de qualquer rede Docker
- DNS queries fazem fallback para DNS público se CoreDNS down

**Verificação:**
```bash
nslookup qdrant localhost:53
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f getent hosts qdrant
curl -s http://qdrant:6333/health
```

---

### TASK-3B: Update Service Configs to Use Hostnames

**O que fazer:**
- Atualizar todos Docker Compose files para usar DNS names ao invés de IPs:
  - LiteLLM config.yaml: `ollama_base_url: http://ollama:11434`
  - OpenClaw .env: `OPENAI_TTS_BASE_URL=http://kokoro:8880/v1`
- Atualizar `/etc/hosts` como fallback

**Critério de Aceite:**
- Nenhum serviço referencia IP em configuração
- Serviços continuam funcionando após migração

**Verificação:**
```bash
grep -r "10\.0\." /srv/apps/*/docker-compose.yml
grep -r "10\.0\." /srv/data/coolify/services/*/.env
```

---

## Phase 4: Offsite Backup

### TASK-4A: Configure rclone to Offsite Target

**O que fazer:**
- Avaliar offsite targets:
  - **Backblaze B2**: $0.006/GB/mo, S3-compatible, integração rclone
  - **rsync.net**: $0.05/GB/mo, rsync nativo, ZFS-friendly
- Configurar rclone com remote backup target
- Criar script backup-offsite.sh que:
  1. Roda ZFS snapshot (`tank@offsite-YYYYMMDD`)
  2. Replica snapshot para offsite via rclone
  3. Prunes snapshots offsite mais antigos que 30 dias

**Arquivos a criar:**
- `/srv/ops/scripts/backup-offsite.sh`
- `/root/.config/rclone/rclone.conf` (secreto!)

**Critério de Aceite:**
- Dados existem offsite em até 24h do backup local
- Dados offsite são encriptados at rest
- Restore offsite funciona (testado quarterly)

**Verificação:**
```bash
rclone listremotes
rclone sync --dry-run tank/bckups remote:bucket/backup
```

---

### TASK-4B: Offsite Backup Monitoring

**O que fazer:**
- Adicionar métricas Prometheus para status backup offsite
- Alerta se backup offsite tem mais de 48h
- Alerta se sync offsite falha

**Critério de Aceite:**
- Dashboard Grafana mostra idade do backup offsite
- Alerta Telegram dispara se backup está stale

**Verificação:**
```bash
rclone ls remote:bucket/backup --max-age 48h
```

---

## Phase 5: Watchdog Stabilization (OpenClaw STT)

### TASK-5A: Diagnose Watchdog Cycling Root Cause

**O que fazer:**
- O watchdog está fazendo cycling entre Whisper local e Deepgram cloud
- Causas raiz para investigar:
  1. Whisper API endpoint (:8201) não reachável do OpenClaw
  2. Whisper API retornando erros (timeout, OOM, modelo não carregado)
  3. Threshold do watchdog muito agressivo
  4. Problema de roteamento de rede

**Comandos de investigação:**
```bash
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f curl -s http://whisper-api-gpu:8201/health
curl -s http://localhost:8201/health
docker logs whisper-api-gpu --tail 50
docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f | grep -i watchdog
```

**Critério de Aceite:**
- Causa raiz identificada (não só sintomas)
- Documentada em `/srv/monorepo/docs/INFRASTRUCTURE/OPENCLAW_DEBUG.md`

---

### TASK-5B: Stabilize Whisper STT Endpoint

**O que fazer:**
- Se Whisper API inacessível:
  - Opção A: Mover Whisper API para dentro da rede Coolify
  - Opção B: Usar LiteLLM whisper-stt endpoint
  - Opção C: Usar Deepgram cloud permanentemente ($$$ mas可靠)
- Se Whisper API retornando erros:
  - Adicionar memory limits
  - Adicionar healthcheck com timeout correto
  - Adicionar restart policy com cooldown

**Critério de Aceite:**
- OpenClaw usa exatamente um provider STT consistentemente
- Sem watchdog cycling por 24 horas
- STT funciona quando triggered manualmente

**Verificação:**
```bash
docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f --since 5m | grep -iE "watchdog|deepgram|whisper|stt"
```

---

## Dependencies Entre Fases

```
Phase 1 (Alerting) ──────┬── Sem dependências ─────────────────
                          └── Alerting deve existir antes de Phase 2-5
                          └── Alerting habilita monitoramento para todas as outras fases

Phase 2 (Qdrant Backup) ─┬── Phase 1 recomendada (alertas em falha de backup)
                          └── Pode rodar standalone

Phase 3 (Internal DNS) ──┬── Phase 1 recomendada (alertas em falha DNS)
                          └── Phase 4 precisa de DNS names
                          └── Deve completar antes de Phase 5

Phase 4 (Offsite Backup) ─┬── Phase 2 (backup local deve funcionar primeiro)
                          └── Phase 3 (usa DNS names)
                          └── Phase 1 (alertas em falha offsite)

Phase 5 (Watchdog) ───────┬── Phase 1 (alertas se STT falha)
                          └── Phase 3 (DNS ajuda roteamento)
                          └── Pode rodar a qualquer momento, mas prioridade baixa
```

---

## Ordem de Implementação Recomendada

1. **Phase 1A** (AlertManager + Gotify) — foundation
2. **Phase 2** (Qdrant Backup) — protege o cérebro AI
3. **Phase 3** (Internal DNS) — previne Quebras futuras
4. **Phase 4** (Offsite Backup) — recuperação de desastre
5. **Phase 5** (Watchdog) — polish final

Cada phase é projetado para completar em 1-2 sessões de 2-3 horas cada.
