# Debug Quick Reference

Quick reference for debugging the homelab environment. Based on blueprint configuration.

---

## Docker

### Verificar status dos serviços principais

```bash
# Lista todos os containers em execução
docker ps

# Lista containers dos serviços principais
docker ps | grep -E "qdrant||gitea|coolify"

# Ver logs em tempo real de um container
docker logs -f <container>

# Acessar shell dentro do container
docker exec -it <container> sh

# Ver status com docker compose
docker compose -f /srv/apps/platform/docker-compose.yml ps
```

**Exemplo prático:**
```bash
# Verificar se Qdrant está respondendo
docker exec -it qdrant curl -s localhost:6333

# Ver logs do LiteLLM
docker logs -f litellm --tail=100
```

---

## System

### Journalctl - logs do sistema

```bash
# Logs de um serviço desde a última hora
journalctl -u <service> --since "1 hour ago"

# Logs de um serviço com follow
journalctl -u <service> -f

# Todos os logs desde ontem
journalctl --since "yesterday"

# Reinicializações do sistema
journalctl -b -1
```

**Exemplo prático:**
```bash
# Logs do Hermes Gateway
journalctl --user -u hermes-gateway -n 50

# Logs do usuário desde a última hora
journalctl --user --since "1 hour ago"
```

### Systemctl - status de serviços

```bash
# Status de um serviço
systemctl status <service>

# Verificar se está ativo (running)
systemctl is-active <service>

# Ver todos os serviços falhados
systemctl --failed
```

### ss - portas em uso

```bash
# Verificar se uma porta está em uso
ss -tlnp | grep :<port>

# Listar todas as portas TCP ouvindo
ss -tlnp

# Verificar porta específica (ex: 6333 Qdrant)
ss -tlnp | grep :6333
```

**Exemplo prático:**
```bash
# Verificar se LiteLLM está ouvindo na 4000
ss -tlnp | grep :4000

# Ver todas as portas dos serviços principais
ss -tlnp | grep -E ":3000|:4000|:5678|:6333|:8000|:3001"
```

---

## GPU

### nvidia-smi - status da GPU

```bash
# Status geral da GPU
nvidia-smi

# Query detalhada em XML
nvidia-smi -q -x

# Ver uso de VRAM por processo
nvidia-smi

# Reset da GPU (após troubleshooting)
sudo nvidia-smi --gpu-reset
```

**Exemplo prático:**
```bash
# Verificar VRAM disponível (Gemma4 usa ~22GB)
nvidia-smi --query-gpu=memory.free,memory.total --format=csv

# Ver processos usando GPU
nvidia-smi

# Query rápida de GPU
nvidia-smi -q -i 0 -y
```

---

## ZFS

### zpool - status do pool

```bash
# Status geral do pool
zpool status

# Status detalhado
zpool status -v tank

# Ver health do pool
zpool health tank
```

### zfs - snapshots e rollback

```bash
# Listar snapshots
zfs list -t snapshot

# Listar todos os datasets
zfs list

# Criar snapshot manual
zfs snapshot <pool>@<name>

# Rollback para snapshot
zfs rollback <pool>@<name>

# Rollback recursivo
zfs rollback -r <pool>@<name>
```

**Exemplo prático:**
```bash
# Snapshot antes de mudança
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-feature-x

# Ver snapshots do tank
zfs list -t snapshot -r tank

# Rollback se algo quebrar
sudo zfs rollback -r tank@pre-20260422-143000-feature-x

# Snapshot do tank inteiro
zfs snapshot tank@pre-$(date +%Y%m%d)-backup
```

---

## Network

### curl - testar endpoints

```bash
# Testar endpoint HTTP
curl -I https://<endpoint>

# GET com follow redirect
curl -L https://<endpoint>

# Timeout rápido (2s)
curl -I --connect-timeout 2 https://<endpoint>

# Verificar LiteLLM health
curl http://localhost:4000/health
```

**Exemplo prático:**
```bash
# Health check do LiteLLM
curl http://localhost:4000/health

# Health check do Qdrant
curl -s http://localhost:6333/health

# Testar API externa
curl -I https://api.minimax.chat --connect-timeout 3
```

### ping - conectividade

```bash
# Ping para host
ping <host>

# Ping com contagem
ping -c 4 <host>

# Ping para Google DNS (teste de rede)
ping 8.8.8.8
```

### nslookup - DNS

```bash
# DNS lookup
nslookup <domain>

# Verificar resolução de domínio
nslookup .local
```

---

## Logs

### tail - seguir logs

```bash
# Seguir syslog
tail -f /var/log/syslog

# Últimas 100 linhas
tail -n 100 /var/log/syslog

# Múltiplos arquivos
tail -f /var/log/syslog /var/log/auth.log
```

### grep - buscar em logs

```bash
# Buscar ERROR em todos os logs
grep -r "ERROR" /srv/ops/logs/

# Buscar com contexto (3 linhas antes/depois)
grep -r -C 3 "ERROR" /srv/ops/logs/

# Buscar em arquivo específico
grep "ERROR" /var/log/syslog

# Buscar múltiplos padrões
grep -E "ERROR|WARN|CRIT" /var/log/syslog
```

**Exemplo prático:**
```bash
# Buscar erros no monorepo
grep -r "ERROR" /srv/monorepo/.claude/skills/orchestrator/logs/

# Buscar em logs de serviços
journalctl -u coolify | grep -E "ERROR|WARN"

# Ver logs do pipeline
tail -n 200 /srv/monorepo/orchestrator/logs/pipeline.log | grep -E "ERROR|fail"
```

---

## Quick Health Check

```bash
# Verificação rápida de todos os serviços
docker ps | grep -E "qdrant||gitea|coolify|litellm" && \
nvidia-smi --query-gpu=memory.free --format=csv,noheader && \
zpool status tank && \
curl -s http://localhost:4000/health
```

---

## Troubleshooting Flow

1. **GPU Issues:** `nvidia-smi` → check VRAM → process usage
2. **Service Down:** `docker ps` → `docker logs` → `journalctl`
3. **Rede:** `ping` → `curl` → `ss -tlnp`
4. **ZFS:** `zpool status` → `zfs list -t snapshot` → rollback se necessário
5. **Performance:** `htop` → `nvidia-smi` → `docker stats`

---

**Atualizado:** 2026-04-22
**Baseado em:** Claude Code Blueprint v1.0
