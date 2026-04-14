# Runbook: Referência Oficial de Comandos

**Host:** homelab
**Atualizado:** 2026-04-04

Comandos seguros e testados para operações. Operações somente-leitura podem ser executadas livremente.

## STATUS & INSPEÇÃO (SEGURO — sem aprovação)

```bash
# Service status
docker compose -f /srv/apps/platform/docker-compose.yml ps

# Service logs (last 50 lines)
docker compose -f /srv/apps/platform/docker-compose.yml logs --tail=50

# Follow logs (live)
docker compose -f /srv/apps/platform/docker-compose.yml logs -f

# Service health checks
curl http://localhost:6333/health                    # Qdrant
curl http://localhost:5678/api/v1/health             # n8n
docker exec n8n-postgres pg_isready -U n8n          # PostgreSQL

# ZFS pool status
zpool status tank
zfs list
zfs list -r tank
zfs list -t snapshot

# Disk usage
df -h /srv
du -sh /srv/*

# Docker resource usage
docker stats --no-stream

# System load
htop
btop
```

---

## BACKUP (SEGURO — sem aprovação)

**Scripts de backup são somente-leitura nas fontes. Seguro executar a qualquer hora.**

```bash
# PostgreSQL backup
/srv/ops/scripts/backup-postgres.sh

# Qdrant backup
/srv/ops/scripts/backup-qdrant.sh

# n8n backup
/srv/ops/scripts/backup-n8n.sh

# ZFS snapshot (planning checkpoint)
/srv/ops/scripts/snapshot-zfs.sh daily

# View backup files
ls -lh /srv/backups/*/
du -sh /srv/backups/

# Verify backup integrity
tar -tzf /srv/backups/qdrant/*.tar.gz | head  # Check tar contents
gunzip -t /srv/backups/postgres/*.sql.gz      # Verify gzip integrity
```

---

## GERENCIAMENTO DE SERVIÇOS (REQUER APROVAÇÃO)

**⚠️ Alteram estado do sistema. Perguntar antes de executar.**

```bash
# Restart single service
docker compose -f /srv/apps/platform/docker-compose.yml restart qdrant
docker compose -f /srv/apps/platform/docker-compose.yml restart n8n

# Stop single service
docker compose -f /srv/apps/platform/docker-compose.yml stop qdrant

# Start single service
docker compose -f /srv/apps/platform/docker-compose.yml start qdrant

# Restart all services
docker compose -f /srv/apps/platform/docker-compose.yml restart

# Stop all services (preserves data)
docker compose -f /srv/apps/platform/docker-compose.yml stop

# Start all services
docker compose -f /srv/apps/platform/docker-compose.yml up -d

# Full restart (clean shutdown + restart)
docker compose -f /srv/apps/platform/docker-compose.yml down
docker compose -f /srv/apps/platform/docker-compose.yml up -d

# View container details
docker inspect n8n
docker inspect qdrant
docker inspect n8n-postgres
```

---

## OPERAÇÕES ZFS (REQUER APROVAÇÃO)

**⚠️ Mudanças estruturais. Snapshot primeiro, aprovação depois.**

```bash
# BEFORE any ZFS change:
sudo zfs snapshot -r tank@pre-20260316-140000-change-description

# List snapshots
zfs list -t snapshot

# Create snapshot (planning)
sudo zfs snapshot -r tank@manual-20260316-140000

# Rollback to snapshot (CAUTION: destroys newer changes)
sudo zfs rollback -r tank@snapshot-name

# View dataset properties
zfs get all tank

# Set compression (example)
sudo zfs set compression=lz4 tank

# Set atime (example)
sudo zfs set atime=off tank

# Check compression ratio
zfs list -o name,used,compressratio tank
```

---

## OPERAÇÕES DOCKER (COM CUIDADO)

**Somente-leitura: seguro. Alterações: requer aprovação.**

```bash
# View images
docker images

# View containers
docker ps -a

# View volumes
docker volume ls

# View networks
docker network ls

# Pull new image
docker pull qdrant/qdrant:latest

# Build custom image
docker build -t myimage:tag .

# Remove unused images (ask first!)
docker image prune -a

# Remove container
docker rm container-name

# Remove volume
docker volume rm volume-name

# View container logs
docker logs container-name

# Enter container (interactive)
docker exec -it container-name /bin/bash

# Run command in container
docker exec container-name command
```

---

## OPERAÇÕES DE BANCO DE DADOS (PostgreSQL)

**Somente-leitura: seguro. Modificações: requer aprovação.**

```bash
# Check database status
docker exec n8n-postgres pg_isready -U n8n

# Dump database (backup)
docker exec n8n-postgres pg_dump -U n8n -d n8n | gzip > /tmp/backup.sql.gz

# List databases
docker exec n8n-postgres psql -U n8n -l

# Connect to database (interactive)
docker exec -it n8n-postgres psql -U n8n -d n8n

# Query database size
docker exec n8n-postgres psql -U n8n -d n8n -c "SELECT pg_database_size('n8n');"

# Reset database (DESTRUCTIVE - approval required!)
docker exec n8n-postgres dropdb -U n8n n8n
docker exec n8n-postgres createdb -U n8n n8n
```

---

## OPERAÇÕES QDRANT

**Somente-leitura: seguro. Operações destrutivas: requer aprovação.**

```bash
# Check health
curl http://localhost:6333/health

# View API docs
curl http://localhost:6333/docs

# List collections
curl http://localhost:6333/collections

# View collection info
curl http://localhost:6333/collections/collection-name

# Backup storage (read-only)
tar -czf /tmp/qdrant-backup.tar.gz -C /srv/data qdrant

# Check disk usage
du -sh /srv/data/qdrant
```

---

## REDE & CONECTIVIDADE

**Somente-leitura: seguro.**

```bash
# View IP configuration
ip addr show

# View routing table
ip route show

# Test local service
curl http://localhost:6333/health
curl http://localhost:5678/api/v1/health
netstat -tlnp | grep -E "6333|5678|5432"

# Test Tailscale (if authenticated)
tailscale status

# Test DNS
nslookup example.com

# Ping test
ping 8.8.8.8

# Trace route
traceroute 8.8.8.8
```

---

## OPERAÇÕES MONOREPO (SEGURO — Desenvolvimento)

```bash
# Navigate to monorepo
cd /srv/monorepo

# Install dependencies
pnpm install

# Development mode (all apps)
pnpm dev

# Build all apps
pnpm build

# Lint all code
pnpm lint

# Type check all apps
pnpm type-check

# Test all apps
pnpm test

# Specific app development
cd apps/api && pnpm dev

# Clean node_modules and pnpm lock
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

---

## INSPEÇÃO DO SISTEMA (SEGURO)

```bash
# Kernel version
uname -a

# Ubuntu version
lsb_release -a

# Hostname
hostname

# System uptime
uptime

# CPU info
nproc              # Number of CPUs
lscpu

# Memory info
free -h

# Disk info
lsblk
fdisk -l /dev/nvme0n1
fdisk -l /dev/nvme1n1

# Processes
ps aux
ps aux | grep docker
ps aux | grep n8n

# System logs
journalctl -n 100 --no-pager
journalctl -u docker --no-pager
journalctl -u docker -f            # Follow

# User info
whoami
id
```

---

## SEGURANÇA & FIREWALL (COM CUIDADO)

**Somente-leitura: seguro. Alterações: requer aprovação.**

```bash
# Firewall status
ufw status
ufw status verbose

# List firewall rules
ufw show added

# Show SSH access
grep "Accepted\|Failed" /var/log/auth.log | tail -20

# Check sudo access
sudo visudo -c                      # Verify sudoers syntax

# List sudo users
getent group sudo

# View sudo logs
journalctl _SYSTEMD_UNIT=sudo.service
```

---

## PROCEDIMENTOS DE EMERGÊNCIA

**SOMENTE se serviços estão fora e não se recuperam.**

```bash
# Check Docker service
systemctl status docker

# View Docker logs
journalctl -u docker -f

# Check disk space (if Docker can't start)
df -h
du -sh /srv/docker-data

# Check ZFS pool
zpool status tank
zfs list tank

# Force container cleanup (if corrupted)
docker system prune --force

# View specific service logs for errors
docker logs qdrant | tail -100
docker logs n8n | tail -100
docker logs n8n-postgres | tail -100
```

---

## EXEMPLO DE SESSÃO TMUX (Monitoramento)

```bash
# Start monitoring session
tmux new-session -d -s monitor

# Open split panes
tmux split-window -h
tmux split-window -v

# Run different logs in each pane
tmux send-keys -t monitor.0 'docker logs -f qdrant' Enter
tmux send-keys -t monitor.1 'docker logs -f n8n' Enter
tmux send-keys -t monitor.2 'htop' Enter

# Attach to session
tmux attach -t monitor

# Detach (Ctrl-b d)
# Kill session: tmux kill-session -t monitor
```

---

## GPU & VRAM (RTX 4090 — SAFE)

```bash
# VRAM atual (usado / livre)
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader

# VRAM detalhado por processo
nvidia-smi

# Modelos Ollama carregados na VRAM agora
curl -s http://localhost:11434/api/ps | python3 -m json.tool

# CDI spec (GPU no Docker sem reiniciar daemon)
ls -la /etc/cdi/nvidia.yaml
sudo nvidia-ctk cdi list

# Budget VRAM referência:
#   Desktop fixo:          ~1 GB
#   Speaches Whisper v3:   ~4 GB  (voice stack ativo)
#   Chatterbox TTS:        ~5 GB  (voice stack ativo)
#   Qwen 3.5 (sob demanda): ~6.5 GB
#   BGE-M3  (sob demanda):  ~1.2 GB
#   Pior caso total:       ~17.7 GB  → 6.3 GB livres
```

---

## VOICE STACK — STT/TTS (SAFE - leitura)

```bash
# Status containers
docker ps --filter "name=voice-proxy" --filter "name=speaches" --filter "name=chatterbox"

# Health checks
curl http://localhost:8010/health         # STT proxy (speaches)
curl http://localhost:8011/               # TTS proxy (chatterbox)

# Logs
docker logs voice-proxy --tail=50         # Nginx + rate limit hits
docker logs speaches --tail=50            # Whisper STT
docker logs chatterbox-tts --tail=50      # Chatterbox TTS

# Rate limit logs (429 = limite atingido)
docker logs voice-proxy --tail=100 | grep "429\|limiting"

# Modelos STT disponíveis
curl -s http://localhost:8010/v1/models | python3 -m json.tool

# Vozes TTS disponíveis
curl -s http://localhost:8011/get_predefined_voices | python3 -m json.tool

# Teste rápido STT (requer arquivo .wav)
# curl http://localhost:8010/v1/audio/transcriptions \
#   -F file=@audio.wav -F model=Systran/faster-whisper-large-v3 -F language=pt

# Teste rápido TTS
# python3 -c "
# import urllib.request, json
# data = json.dumps({'model':'tts-1','input':'Teste de voz.','voice':'Gabriel.wav'}).encode()
# req = urllib.request.Request('http://localhost:8011/v1/audio/speech',
#       data=data, headers={'Content-Type':'application/json'})
# with urllib.request.urlopen(req) as r, open('/tmp/out.wav','wb') as f: f.write(r.read())
# print('OK - /tmp/out.wav')
# "
```

**Guia completo:** `/home/will/Desktop/guide-audio-tts-stt.md`

---

## VOICE STACK MANAGEMENT (REQUIRES APPROVAL)

```bash
# Compose file: /srv/apps/voice/docker-compose.yml

# Restart voice stack
docker compose -f /srv/apps/voice/docker-compose.yml restart

# Parar voice stack
docker compose -f /srv/apps/voice/docker-compose.yml stop

# Iniciar voice stack
docker compose -f /srv/apps/voice/docker-compose.yml up -d

# Reload nginx (rate limits) sem derrubar speaches/chatterbox
docker exec voice-proxy nginx -s reload

# Recriar CDI spec (se NVIDIA driver atualizado)
sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml
```

---

## OLLAMA — LLM Local (systemd)

**Endpoint:** http://localhost:11434

```bash
# Status do serviço
systemctl status ollama

# Modelos instalados no disco
ollama list

# Modelos carregados na VRAM agora
curl -s http://localhost:11434/api/ps | python3 -m json.tool

# Logs (últimas 50 linhas)
journalctl -u ollama -n 50 --no-pager

# Seguir logs em tempo real
journalctl -u ollama -f

# Testar LLM (completion)
curl -s http://localhost:11434/api/generate \
  -d '{"model":"qwen3.5","prompt":"Olá","stream":false}' | python3 -m json.tool

# Testar embedding
curl -s http://localhost:11434/api/embed \
  -d '{"model":"bge-m3","input":"Teste de embedding"}' | python3 -m json.tool

# Baixar novo modelo
# ollama pull <modelo>

# Remover modelo (APPROVAL)
# ollama rm <modelo>
```

**Modelos disponíveis:**

- `gemma4` — 12B Q4_K_M, instruction-tuned, ~7 GB VRAM
- `qwen2.5-vl` — 7B Q4_K_M, vision model, ~4.5 GB VRAM
- `nomic-embed-text` — embedding model, lazy load

**Skills de diagnóstico:**

- `ollama-health-check.md` — verificação completa
- `litellm-health-check.md` — LiteLLM proxy
- `kokoro-health-check.md` — Kokoro TTS

---

## LITELLM — Proxy LLM (Ollama + OpenRouter)

**Endpoint:** `localhost:4000` (processo Python em `/home/will/litellm-venv`)
**Config:** `/home/will/zappro-lite/config.yaml`

```bash
# Status processo
ps aux | grep litellm | grep -v grep

# Testar health
curl -s -H "Authorization: Bearer sk-test" http://localhost:4000/health

# Testar gemma4 via Ollama
curl -s -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test" \
  -d '{"model":"gemma4","messages":[{"role":"user","content":"hi"}],"max_tokens":10}'

# Logs
tail -f /tmp/litellm.log 2>/dev/null || journalctl --user -u litellm -f
```

**Nota:** LiteLLM sem database (`no_db` no health) é normal — sem persistência de cache.

---

## KOKORO TTS — Text-to-Speech GPU

**Container:** `zappro-kokoro` | **Port:** `localhost:8012` | **Proxy nginx:** `localhost:4001`

```bash
# Status container
docker ps --filter "name=kokoro"

# Health
curl -s http://localhost:8012/health

# Listar vozes
curl -s http://localhost:8012/v1/audio/voices | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Voices: {len(d[\"voices\"])}')"

# Testar TTS
curl -s -X POST http://localhost:8012/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"teste","voice":"af_bella"}' --output /tmp/test.wav
ls -lh /tmp/test.wav

# Redis cache
docker exec zappro-redis redis-cli -a [REDIS_PASSWORD] ping
```

---

## SUPABASE STACK

```bash
# Compose file: /srv/apps/supabase/docker/docker-compose.yml

# Status (13 containers)
docker-compose -f /srv/apps/supabase/docker/docker-compose.yml ps

# Health principal
curl http://localhost:8000/              # kong (API gateway, 401 esperado sem auth)

# Studio UI: http://localhost:54323

# Logs principais
docker logs supabase-kong --tail=30
docker logs supabase-db --tail=30
docker logs supabase-auth --tail=30

# PostgreSQL Supabase (via pooler)
# psql postgresql://postgres:password@localhost:5433/postgres
```

---

## CAPROVER STACK

```bash
# Compose file: /srv/apps/caprover/docker-compose.yml

# Status
docker ps --filter "name=captain"

# Dashboard local: http://localhost:3000
# Dashboard publico: https://cap.zappro.site
# Nginx (reverse proxy público): http://localhost:80

# Logs
docker logs captain-captain --tail=30
docker logs captain-nginx --tail=30

# captain-certbot pode aparecer como "exited" — normal quando não há renovação pendente
```

---

## TAILSCALE & CLOUDFLARE

```bash
# Tailscale status
tailscale status

# IP Tailscale do host
tailscale ip

# Ping de outro nó via Tailscale
# tailscale ping <nome-do-dispositivo>

# Cloudflare Tunnel status
systemctl status cloudflared

# Logs do tunnel
journalctl -u cloudflared -n 50 --no-pager
```

**IPs:**

- Tailscale: 100.83.45.79 (autenticado)
- Cloudflare Tunnel: ativo via systemd cloudflared.service

---

## MONITORING STACK (Grafana + Prometheus + Exporters)

**Stack location:** `/srv/apps/monitoring/`
**Compose:** `docker compose -f /srv/apps/monitoring/docker-compose.yml`

```bash
# Status completo da stack
docker ps -a --filter "name=grafana" --filter "name=prometheus" \
  --filter "name=node-exporter" --filter "name=nvidia-gpu-exporter" --filter "name=cadvisor"

# Health checks
curl -s http://localhost:3100/api/health && echo " ✓ grafana"
curl -s http://localhost:9090/-/healthy && echo " ✓ prometheus"
curl -s http://localhost:9100/metrics 2>/dev/null | head -1 && echo " ✓ node-exporter"
curl -s http://localhost:9250/healthz 2>/dev/null | head -1 && echo " ✓ cadvisor"

# Prometheus targets (ver se exporters estao a fazer scrape)
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import json,sys
d=json.load(sys.stdin)
for t in sorted(d.get('data',{}).get('activeTargets',[]), key=lambda x: x['labels']['job']):
    err = t.get('lastError','')
    status = 'UP' if t['health']=='up' else 'DOWN'
    print(f'  {t[\"labels\"][\"job\"]}: {status} {\"( \"+err[:50]+\")\" if err else \"\"}')"

# Query GPU metric diretamente
curl -s "http://localhost:9090/api/v1/query?query=nvidia_smi_utilization_gpu_ratio" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('data',{}).get('result',[]):
    print(f'GPU: {r[\"value\"][1]} ({r[\"metric\"].get(\"uuid\",\"?\")})')"

# Grafana login (via CLI)
docker exec grafana grafana cli admin reset-admin-password --user-id 1 --password-from-stdin <<< "NovaSenha123!"

# Ver redes dos containers
for c in grafana prometheus nvidia-gpu-exporter cadvisor; do
  NET=$(docker inspect $c --format '{{range $n:=.NetworkSettings.Networks}}{{$n}} {{end}}' 2>/dev/null)
  echo "$c: $NET"
done

# Logs
docker logs grafana --tail=30
docker logs prometheus --tail=30
```

**Problemas comuns:**

- `Created-not-Started` → `docker start nvidia-gpu-exporter`
- Network mismatch → `docker network connect aurelia-net grafana`
- Prometheus DOWN → `docker restart prometheus`

**Skills de diagnóstico:**

- `monitoring-health-check.md` — verificação completa
- `monitoring-diagnostic.md` — árvore de decisão
- `monitoring-zfs-snapshot.md` — snapshot antes de changes

---

## STATUS COMPLETO — Todos os Stacks

```bash
# Ver todos os 22 containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Health rápido de todos os endpoints expostos
curl -s http://localhost:6333/health && echo " ✓ qdrant"
curl -s http://localhost:5678/api/v1/health && echo " ✓ n8n"
curl -s http://localhost:8010/health && echo " ✓ voice-proxy STT"
curl -s http://localhost:8011/ && echo " ✓ voice-proxy TTS"
curl -s http://localhost:8000/ && echo " ✓ supabase-kong"
curl -s http://localhost:11434/api/tags && echo " ✓ ollama"

# GPU
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader,nounits

# ZFS
zpool status tank
zfs list -o name,used,avail
```

---

**Last Updated:** 2026-03-17
**Review:** When adding services or troubleshooting
