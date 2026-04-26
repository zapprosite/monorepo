# Manual de Operações do Homelab — zappro.site

**Versão:** 1.0.0
**Data:** 2026-04-23
**Host:** Ubuntu Desktop (Ryzen + RTX 4090)
**Pool ZFS:** `tank`
**Última verificação:** 2026-04-23

---

## 1. Hardware Profile

### Host Principal: Ubuntu Desktop

| Componente | Especificação | Observação |
|------------|---------------|------------|
| CPU | AMD Ryzen (Consumer) | **NÃO é Xeon/Epyc — homelab usa Ryzen** |
| GPU | NVIDIA RTX 4090 | CUDA-capable, alocada para Ollama |
| RAM | Verificar com `free -h` | Tipicamente 64GB-128GB em homelab |
| Boot | NVMe SSD | Ryzen iGPU **não serve** como alternate boot device |
| BMC | **NENHUM** | Homelab = sem IPMI/iLO/DRAC enterprise |
| Pool ZFS | `tank` (RAID-Z, ~3.62TB total) | 41.8GB allocated |

### ZFS Pool — Datasets

```
tank/
├── tank/data              # Dados gerais (3.5T)
├── tank/monorepo          # /srv/monorepo - git repos, agent skills (1.7G used)
├── tank/qdrant            # Vector DB storage (1.2M used)
├── tank/models            # LLM model cache (6.5G used)
├── tank/backups           # Backup destination (8.4G used)
├── tank/docker-data       # Docker volumes (13G used)
├── tank/coolify           # Coolify persistent data (256K used)
└── tank/data/zappro-router # API router data (128K used)
```

### Limitações de Homelab vs Enterprise

| Aspecto | Homelab (Ryzen) | Enterprise (Xeon) |
|---------|-----------------|-------------------|
| BMC | Nenhum | IPMI/iLO/DRAC |
| Remote Management | Manual | KVM over IP |
| ECC RAM | Tipicamente não | Sim |
| Hot-swap bays | Limitado | Full hot-swap |
| iGPU boot device | Não suportado | Suportado |

---

## 2. Princípios de Operações Enterprise Adaptados para Homelab

### 2.1 RTO/RPO Targets

| Métrica | Target Enterprise | Homelab | Justificativa |
|---------|------------------|---------|---------------|
| **RTO** (Recovery Time Objective) | 4h | **4h** | Tempo para recuperação completa |
| **RPO** (Recovery Point Objective) | 1h | **1h** | Máxima perda de dados aceitável |

### 2.2 Change Management (CAB Equivalente)

Para homelab single-admin, aplica-se processo simplificado:

**ANTES de qualquer mudança:**

1. Verificar se há snapshot recente do dataset afetado
2. Documentar o impacto no grupo Telegram
3. Executar em janela de manutenção (idealmente 02:00-04:00 UTC)
4. Ter plano de rollback

**Critérios de Mudança Crítica (que necessitam snapshot):**
- Modificação em `/srv/data` ou sub-volumes
- Migração de dados entre datasets
- Alteração de configuração de serviços em produção
- Delete ou rename de datasets

### 2.3 Incident Management — Classificação P1-P4

| Prioridade | Definição | Tempo de Resposta | Exemplo Homelab |
|------------|-----------|-------------------|-----------------|
| **P1 Critical** | Outage completo, perda de dados | Imediato (24/7) | ZFS pool falhou, perda total |
| **P2 High** | Serviço degradado, features indisponíveis | 4h | LiteLLM down, Qdrant corrompido |
| **P3 Medium** | Issue não-crítico, workaround disponível | 24h | Circuit breaker aberto |
| **P4 Low** | Cosmético, documentação | Próxima janela manutenção | UI bug, texto incorreto |

### 2.4 SRE Principles Adaptados

**The Three Signals (monitorados):**
- **Availability:** `up` status dos containers + health endpoints
- **Latency:** p95 latency < 2s para APIs
- **Error Rate:** < 5% de erros

**Error Budget:** Se error rate > 5% por 5 min, investigar imediatamente.

**Toil Reduction:** Automação via scripts em `/srv/ops/scripts/`:
- `homelab-health-check.sh` — verificação diária automatizada
- `backup-*.sh` — backups automatizados (cron)
- `hermes-sre-monitor.sh` — monitor SRE para Hermes

---

## 3. Catálogo de Serviços

### 3.1 Containers Docker — Status (2026-04-22)

**Total: 31 containers | Unhealthy: 1 (zappro-ai-gateway)**

| Container | Porta | Status | Health | Rede |
|----------|-------|--------|--------|------|
| mcp-memory | 4016 | UP | — | mcp-memory |
| zappro- | — | UP | — | bridge |
| coolify-sentinel | — | UP | healthy | coolify |
| painel-organism | — | UP | — | bridge |
| prometheus | 9090 | UP | healthy | monitoring_monitoring |
| zappro-gitea | 3300 | UP | — | gitea_default |
| pgadmin-* | 4050 | UP | healthy | bridge |
| zappro-litellm | 4000 | UP | — | litellm_default |
| zappro-litellm-db | — | UP | healthy | litellm_default |
| node-exporter | 9100 | UP | healthy | monitoring_monitoring |
| mcp-coolify-mcp-coolify-1 | 4012 | UP | — | mcp-coolify |
| mcp-ollama-mcp-ollama-1 | 4013 | UP | — | mcp-ollama |
| mcp-system-mcp-system-1 | 4014 | UP | — | mcp-system |
| mcp-cron-mcp-cron-1 | 4015 | UP | — | mcp-cron |
| mcp-qdrant | 4011 | UP | — | mcp-qdrant |
| qwen2-vl7b | 11436 | UP | — | bridge |
| edge-tts-server | — | UP | — | bridge |
| obsidian-web | 4081 | UP | healthy | bridge |
| qdrant | 6333 | UP | healthy | coolify |
| static-web | — | UP | healthy | bridge |
| gitea-runner | — | UP | healthy | bridge |
| openwebui | 3456 | UP | healthy | openwebui_net |
| opencode-searxng | 8888 | UP | — | bridge |
| perplexity-agent | — | UP | healthy | bridge |
| coolify-redis | 6381 | UP | healthy | coolify |
| coolify-realtime | 6001/6002 | UP | healthy | coolify |
| coolify-proxy | 80/443 | UP | healthy | coolify |
| zappro-redis | 6379 | UP | healthy | litellm_default |
| redis-opencode | — | UP | healthy | bridge |
| **zappro-ai-gateway** | 4002 | UP | **UNHEALTHY** | ai-gateway_default |

### 3.2 Serviços Principais

| Serviço | Porta | Container | Subdomínio | Owner | SLO | Dependências |
|--------|-------|----------|-----------|-------|-----|---------------|
| LiteLLM Proxy | 4000 | zappro-litellm | api.zappro.site / llm.zappro.site | Platform | 99.9% | Redis, Ollama, External APIs |
| Qdrant | 6333 | qdrant | qdrant.zappro.site | Platform | 99.5% | Coolify net |
| ai-gateway | 4002 | zappro-ai-gateway | llm.zappro.site | Platform | 99% | LiteLLM |
| Gitea | 3300 | zappro-gitea | git.zappro.site | Platform | 99% | Docker volumes |
| OpenWebUI | 3456 | openwebui | chat.zappro.site | Platform | 99% | LiteLLM |
| Ollama | 11434 | (host) | — | Platform | 99% | RTX 4090 GPU |
| Coolify | 8000 | coolify-sentinel | coolify.zappro.site | Platform | 99% | coolify-redis |
| Redis | 6379 | zappro-redis | — | Platform | 99.9% | LiteLLM |
| Grafana | 3100 | grafana | grafana.zappro.site (DNS removido) | Platform | 99% | Prometheus |
| Prometheus | 9090 | prometheus | — | Platform | 99% | node-exporter |
| Node Exporter | 9100 | node-exporter | — | Platform | 99% | — |
| Hermes Gateway | 8642 | (host bare metal) | hermes.zappro.site | Platform | 99% | Brain state |
| Hermes MCP | 8092 | (host bare metal) | — | Platform | 99% | MCPO bridge |

### 3.3 MCP Servers

| Porta | Status | Serviço | Propósito |
|-------|--------|---------|----------|
| 4011 | UP | mcp-qdrant | Vector search |
| 4012 | DOWN (404) | mcp-coolify | Container management |
| 4013 | DOWN (404) | mcp-ollama | Model management |
| 4014 | DOWN (404) | mcp-system | ZFS/Docker/System |
| 4015 | DOWN (404) | mcp-cron | Cron jobs |
| 4016 | UP | mcp-memory | Memory + Qdrant + LiteLLM |

**Nota:** MCP servers 4012-4015 retornam 404 no /health — pode indicar rota missing ou serviço indisponível.

---

## 4. Operações Diárias

### 4.1 Script de Health Check

```bash
bash /srv/monorepo/scripts/daily-health-check.sh
# OU
bash /srv/ops/scripts/homelab-health-check.sh
```

**O script verifica:**
- Endpoints de saúde dos serviços (3001, 4000, 4002, 6333, 4017, 11434, 6435)
- Taxa de erros via Grafana
- Status dos backups
- Envia relatório para Telegram

### 4.2 Verificação Manual de Health Endpoints

```bash
for port in 3001 4000 4002 6333 4016 11434 6435; do
  echo -n "Port $port: "
  curl -sf -m 3 http://localhost:$port/health 2>/dev/null && echo "OK" || echo "FAIL"
done
```

### 4.3 Verificação de Backups

```bash
# Verificar backups recentes (últimas 24h)
find /srv/backups -type f -mtime -1 | head -20

# Backup Redis
ls -la /srv/backups/redis/
# Esperado: redis-YYYYMMDD_HHMMSS.rdb.gz + .sha256 + .manifest

# Backup Qdrant
ls -la /srv/backups/qdrant/
# Esperado: qdrant-backup-YYYYMMDD-HHMMSS.tar.gz + .sha256 + .meta

# Backup Gitea
ls -la /srv/backups/
# Esperado: gitea-dump-YYYYMMDD.tar.gz

# Backup Models (LLM)
ls -la /srv/backups/models/
# Esperado: models-YYYYMMDD_HHMMSS.tar.gz
```

**Status dos backups (2026-04-23):**

| Tipo | Status | Último Backup | Idade |
|------|--------|--------------|-------|
| Redis | OK | Apr 22 22:20 | <1 dia |
| Models | OK | Apr 22 22:23 | <1 dia |
| Qdrant | OK | Apr 22 03:16 | <1 dia |
| Gitea | OK | Apr 22 02:30 | <1 dia |
| Coolify DB | **WARNING** | Apr 08 13:23 | **14 dias** |

**Issue:** Coolify DB backup com 14 dias — verificar se bi-weekly intencional.

### 4.4 Review de Logs (ERRORs últimas 24h)

```bash
# Ver todos os serviços
docker logs --since 24h zappro-ai-gateway 2>&1 | grep -iE "error|fatal|panic"
docker logs --since 24h zappro-litellm 2>&1 | grep -iE "error|fatal|panic"
docker logs --since 24h qdrant 2>&1 | grep -iE "error|fatal|panic"

# Locais de log
# - /srv/ops/logs/
# - Docker logs via: docker logs <container>
```

### 4.5 Grafana Dashboard Review

**Dashboard URL:** `http://localhost:3100` (via tunnel: `https://grafana.zappro.site`)

**Métricas a verificar:**

| Métrica | Threshold | Ação se Acima |
|---------|-----------|---------------|
| Error Rate | < 5% | Investigar se > 5% |
| API Latency p95 | < 2s | Investigar se > 2s |
| Circuit Breaker | Fechado | Abrir ticket se > 5 min |
| Disk Usage | < 80% | Planejar expansão se > 70% |
| Memory Usage | < 90% | Investigar se > 90% |

**Dashboards principais:**
- `Homelab AI Overview` — Visão geral
- `LiteLLM Metrics` — Latência e error rate por modelo
- `Qdrant Collections` — Tamanho e performance
- `AI Agency` — Threads ativos e uso de tokens

---

## 5. Operações Semanais

### 5.1 ZFS Scrub

```bash
# Executar scrub no pool tank
sudo zpool scrub tank

# Verificar progresso
sudo zpool status -v

# Ver resultado do último scrub
sudo zpool status
```

**Agendamento:** Domingo 04:00 UTC (via cron)

### 5.2 Backup Restore Tests

#### 5.2.1 Redis Restore

```bash
# 1. Verificar backup mais recente
ls -la /srv/backups/redis/ | tail -5

# 2. Verificar checksum
sha256sum /srv/backups/redis/redis-*.rdb.gz

# 3. Restore (substituir o arquivo RDB)
# Parar Redis primeiro
docker stop zappro-redis

# 4. Backup do arquivo atual
cp /srv/docker-data/redis.rdb /srv/backups/redis/redis-pre-restore-$(date +%Y%m%d).rdb

# 5. Descompactar e restaurar
zcat /srv/backups/redis/redis-YYYYMMDD_HHMMSS.rdb.gz > /srv/docker-data/redis.rdb

# 6. Reiniciar Redis
docker start zappro-redis

# 7. Verificar
docker exec zappro-redis redis-cli PING
```

#### 5.2.2 Qdrant Restore

**Método:** tar archive (preferível ao snapshot API — ver QDRANT-RESTORE-TEST.md)

```bash
# 1. Verificar backup
ls -la /srv/backups/qdrant/

# 2. Parar Qdrant
docker stop qdrant

# 3. Restaurar (tar method)
tar -xzf /srv/backups/qdrant/qdrant-backup-YYYYMMDD-HHMMSS.tar.gz -C /srv/data

# 4. Reiniciar Qdrant
docker start qdrant

# 5. Verificar collections
curl -s http://localhost:6333/collections -H "api-key: YOUR_API_KEY" | jq
```

**Nota:** Restore via snapshot API está quebrado (relative URL error). Usar método tar.

#### 5.2.3 PostgreSQL Restore

```bash
# 1. Verificar backup
ls -la /srv/backups/postgres/

# 2. Restore
docker exec -i postgres psql -U postgres -d monorepo < /srv/backups/postgres/pre-migration-YYYYMMDD.sql

# OU para backup compactado
zcat /srv/backups/postgres/backup.sql.gz | docker exec -i postgres psql -U postgres -d monorepo
```

#### 5.2.4 Gitea Restore

```bash
# 1. Verificar backup
ls -la /srv/backups/gitea-dump-*.tar.gz

# 2. Parar Gitea
docker stop zappro-gitea

# 3. Criar diretório temporário
mkdir -p /tmp/gitea-restore

# 4. Extrair backup
tar -xzf /srv/backups/gitea-dump-YYYYMMDD.tar.gz -C /tmp/gitea-restore

# 5. Verificar conteúdo
ls -la /tmp/gitea-restore/

# 6. Restaurar (seguir instruções do dump)
# typically: docker exec zappro-gitea bash /path/to/restore.sh

# 7. Reiniciar Gitea
docker start zappro-gitea
```

### 5.3 Análise de Uso de Disco

```bash
# Uso do pool ZFS
sudo zpool list -o name,size,alloc,free,cap

# Uso por dataset
sudo zfs list -o name,used,referenced,mountpoint -r tank

# Docker volumes
docker system df

# Dados específicos
du -sh /srv/data/*
du -sh /srv/backups/*
```

### 5.4 Verificação de Expiração de Certificados

```bash
# Cloudflare tunnel certificates
sudo journalctl -u cloudflared --since 24h | grep -iE "certificate|tls|ssl"

# Containers com HTTPS
for container in $(docker ps --format "{{.Names}}"); do
  echo "=== $container ==="
  docker exec $container ls -la /etc/ssl/certs/*.pem 2>/dev/null | head -3
done
```

---

## 6. Operações Mensais

### 6.1 Security Patch Review

```bash
# Verificar updates disponíveis
apt list --upgradable

# Ver histórico de segurança
grep -i security /var/log/dpkg.log | tail -20

# Ver containers com images desatualizadas
docker images | grep -v REPOSITORY
```

### 6.2 Relatório de Capacity Planning

**CPU (Ryzen):**
```bash
# Ver uso por core (Ryzen tem boost clocks + SMT)
top -bn1 | head -20
cat /proc/cpuinfo | grep "model name" | head -1

# Per-core utilization
watch -n 1 "cat /proc/interrupts | head -5"
```

**RAM:**
```bash
free -h
docker stats --no-stream
```

**Storage Tiering:**
```bash
# Hot (SSD NVMe)
lsblk -d -o NAME,SIZE,TYPE | grep nvme

# Warm/Cold (HDDs no pool ZFS)
sudo zpool status tank

# Dataset sizes
sudo zfs list -o name,used,referenced,mountpoint -r tank | sort -k2 -rn | head -20
```

**GPU (RTX 4090):**
```bash
# GPU utilization for Ollama
nvidia-smi --query-gpu=utilization.gpu,utilization.memory,temperature.gpu --format=csv

# Ollama models loaded
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

### 6.3 Update de Documentação

**Checklist:**
- [ ] Atualizar SERVICES-HEALTH.md se mudou algo
- [ ] Atualizar BACKUP-STATUS.md se mudou schedule
- [ ] Verificar se OPERATIONS/SERVICE_MAP.md está sincronizado com PORTS.md
- [ ] Verificar se aliases em ~/.bashrc estão atualizados
- [ ] Revisar tickets/incidentes do mês

### 6.4 Dependency Update Review

```bash
# Docker images atualizáveis
docker pull <image> for each service

# NPM packages (se aplicável)
cd /srv/monorepo && npm outdated

# Python packages (se aplicável)
pip list --outdated
```

---

## 7. Resposta a Incidentes

### 7.1 P1 — Critical (Resposta Imediata)

**Definição:** Outage completo, perda de dados, ou comprometimento de segurança.

**Ações:**
1. Verificar ZFS pool status imediatamente
   ```bash
   sudo zpool status
   sudo zpool list
   ```
2. Verificar cloudflared tunnel
   ```bash
   sudo systemctl status cloudflared
   sudo journalctl -u cloudflared --since 10m
   ```
3. Documentar timeline do incidente
4. Comunicar no Telegram (se breach de segurança, não comunicar detalhes)
5. Executar disaster recovery se necessário

### 7.2 P2 — High (Resposta 4h)

**Definição:** Serviço degradado, algumas features indisponíveis.

**Exemplo:** LiteLLM down, Qdrant corrompido.

**Ações:**
1. Identificar causa raiz com logs
   ```bash
   docker logs --since 1h <container> 2>&1 | grep -iE "error|fatal"
   ```
2. Verificarhealth endpoint
   ```bash
   curl -sf http://localhost:<PORT>/health
   ```
3. Tentar restart do serviço
   ```bash
   docker restart <container>
   ```
4. Se não resolver, verificar recursos (disk, memory, GPU)

### 7.3 P3 — Medium (Resposta 24h)

**Definição:** Issue não-crítico, workaround disponível.

**Exemplo:** Circuit breaker aberto, rate limit atingido.

**Ações:**
1. Identificar circuito afetado
   ```bash
   curl -s http://localhost:4002/api/circuit-breakers | jq
   ```
2. Verificar logs para causa
3. Implementar workaround
4. Agendar fix permanente para próxima janela de manutenção

### 7.4 P4 — Low (Próxima janela manutenção)

**Definição:** Cosmético, documentação desatualizada, UI bug.

**Ações:**
1. Documentar em lista de TODOs
2. Arrumar na próxima sessão de maintenance

---

## 8. Arquitetura de Backup

### 8.1 Jobs de Backup — Cron Schedule

| Schedule | Task | Script | Destination |
|----------|------|--------|-------------|
| Daily 02:00 | Memory/SQLite | `/srv/ops/scripts/backup-memory-keeper.sh` | `/srv/backups/` |
| Daily 02:30 | Gitea | Inline tar | `/srv/backups/` |
| Daily 02:45 |  PostgreSQL | `/srv/ops/scripts/backup-.sh` | `/srv/backups/` |
| Daily 03:00 | Redis | `/srv/ops/scripts/backup-redis.sh` | `/srv/backups/redis/` |
| Daily 03:00 | Qdrant | `/srv/ops/scripts/backup-qdrant.sh` | `/srv/backups/qdrant/` |
| Sunday 04:00 | Models (Ollama) | `/srv/ops/scripts/backup-models.sh` | `/srv/backups/models/` |

### 8.2 Verificação de Backups

```bash
# Script de verificação
bash /srv/ops/scripts/verify-redis-backup.sh <arquivo>

# Verificação SHA256 checksum
sha256sum /srv/backups/redis/redis-*.rdb.gz
cat /srv/backups/redis/redis-*.sha256
```

### 8.3 Procedimentos de Restore

#### Redis
```bash
# 1. Parar Redis
docker stop zappro-redis

# 2. Backup atual
cp /srv/docker-data/redis.rdb /srv/backups/redis/redis-pre-restore-$(date +%Y%m%d).rdb

# 3. Descompactar backup
zcat /srv/backups/redis/redis-YYYYMMDD_HHMMSS.rdb.gz > /srv/docker-data/redis.rdb

# 4. Reiniciar
docker start zappro-redis

# 5. Verificar
docker exec zappro-redis redis-cli PING
```

#### Qdrant (tar method)
```bash
# 1. Parar Qdrant
docker stop qdrant

# 2. Restaurar
tar -xzf /srv/backups/qdrant/qdrant-backup-YYYYMMDD-HHMMSS.tar.gz -C /srv/data

# 3. Reiniciar
docker start qdrant
```

#### Gitea
```bash
# 1. Parar Gitea
docker stop zappro-gitea

# 2. Extrair dump
mkdir -p /tmp/gitea-restore
tar -xzf /srv/backups/gitea-dump-YYYYMMDD.tar.gz -C /tmp/gitea-restore

# 3. Restaurar (seguir documentação do dump)
docker exec zappro-gitea bash /path/to/restore.sh

# 4. Reiniciar
docker start zappro-gitea
```

### 8.4 Estratégia Off-site

**O que vai para cloud:**
- Backups Gitea (git repos — críticos)
- Backups PostgreSQL (se aplicável)
- Backups Qdrant (vector store)

**O que fica local:**
- Models Ollama (muito grandes — 6.5GB, verificar conectividade)
- ZFS snapshots (via script `backup-zfs-snapshot.sh`)

---

## 9. Disaster Recovery

### 9.1 Outage Completo — Runbook

**Passo 1: Verificar Cloudflare Tunnel**
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared --since 10m | grep -iE "error|disconnected"
```

**Passo 2: Verificar Docker**
```bash
docker ps
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Passo 3: Verificar ZFS Pool**
```bash
sudo zpool status
sudo zpool list
```

**Passo 4: Verificar Health Endpoints**
```bash
for service in zappro-ai-gateway zappro-litellm qdrant; do
  echo -n "$service: "
  curl -sf -m 5 http://localhost:${PORT}/health 2>/dev/null && echo "OK" || echo "FAIL"
done
```

### 9.2 Recovery de Data Loss

**Se ZFS snapshot disponível:**
```bash
# Listar snapshots
sudo zfs list -t snapshot -r tank

# Restaurar snapshot
sudo zfs rollback -r tank@<snapshot-name>
```

**Se apenas backup simples:**
```bash
# Redis RDB restore (ver seção 8.3)
# PostgreSQL restore
docker exec -i postgres psql -U postgres -d monorepo < /srv/backups/postgres/latest.sql
```

### 9.3 Recovery de ZFS Pool Failure

**Se pool degradado:**
```bash
# Ver status
sudo zpool status -v

# Se um disco falhou e há hot spare:
sudo zpool replace tank <old-disk> <new-disk>

# Se pool está readonly (erro de checksum):
# 1. Identificar qual disco tem erro
sudo zpool status -v

# 2. Substituir disco
sudo zpool replace tank <failed-disk-guid> <new-disk>

# 3. Verificar rebuild
sudo zpool status
```

**Se pool completamente perdido:**
- Último recurso: full rebuild from source
- Verificar se há off-site backups para restaurar

### 9.4 Recovery de Cloudflare Tunnel Failure

```bash
# 1. Verificar status do cloudflared
sudo systemctl status cloudflared

# 2. Verificar logs
sudo journalctl -u cloudflared --since 10m

# 3. Reiniciar tunnel
sudo systemctl restart cloudflared

# 4. Se falhar, verificar credenciais
cat /home/will/.cloudflared/aee7a93d-c2e2-4c77-a395-71edc1821402.json

# 5. Verificar DNS records no dashboard Cloudflare
```

**Tunnel Credential File:**
`/home/will/.cloudflared/aee7a93d-c2e2-4c77-a395-71edc1821402.json`

### 9.5 Full Rebuild — Last Resort

Se tudo falhar:

1. **Reinstall Ubuntu Desktop** no host
2. **Instalar ZFS** e recriar pool `tank`
3. **Restaurar backups** na seguinte ordem:
   - Gitea dump
   - Qdrant (tar)
   - Redis RDB
   - PostgreSQL
4. **Recriar containers** via Docker Compose / Coolify
5. **Restaurar tunnel** Cloudflare
6. **Recriar DNS records** via Terraform

---

## 10. Capacity Planning

### 10.1 CPU Monitoring (Ryzen)

**Características do Ryzen:**
- Boost clocks dinâmicos (clock varia com carga)
- SMT (Simultaneous Multithreading) ativo
- Monitorar per-core utilization é importante

```bash
# Ver modelo CPU
cat /proc/cpuinfo | grep "model name" | head -1

# Monitorar uso por core
mpstat -P ALL 1

# Ver load average
uptime

# Top consumers
top -bn1 | head -20
```

**Alertas:**
- CPU > 80% sustained por > 30 min → planejar expansão
- CPU > 95% sustained → investigar imediatamente

### 10.2 RAM Planning

**Tipicamente homelab:** 64GB-128GB

```bash
# Uso atual
free -h

# Docker containers que mais usam RAM
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"

# Por dataset ZFS
sudo zfs list -o name,used,mountpoint -r tank | sort -k2 -rn | head -10
```

**Alertas:**
- Memory > 90% → investigar imediatamente
- Memory > 80% sustained → planejar expansão RAM

### 10.3 Storage Tiering

| Tier | Tipo | Location | Conteúdo |
|------|------|----------|----------|
| Hot | NVMe SSD | `/tank/data` (pool) | Qdrant, Docker volumes, frequent access |
| Warm | HDD | ZFS pool `tank` | Backups, models, less frequent |
| Cold | Snapshots ZFS | `tank/backups` | Historical data, point-in-time recovery |

### 10.4 GPU Utilization (Ollama + RTX 4090)

```bash
# GPU usage
nvidia-smi --query-gpu=utilization.gpu,utilization.memory,temperature.gpu --format=csv -l 1

# Ollama models
curl -s http://localhost:11434/api/tags | jq '.models[].name'

# GPU exporter metrics
curl -s http://localhost:9835/metrics | grep nvidia
```

**Alertas:**
- GPU > 90% sustained → Ollama com carga pesada, normal
- GPU memory > 90% → muitos modelos carregados, considere cleanup

---

## 11. Stack de Monitoring

### 11.1 Prometheus Targets

| Target | Port | Container | Metrics |
|--------|------|-----------|---------|
| prometheus | 9090 | prometheus | TSDB |
| node-exporter | 9100 | node-exporter | Host metrics |
| nvidia-gpu-exporter | 9835 | nvidia-gpu-exporter | GPU metrics |
| cadvisor | 9250 | cadvisor | Container metrics |
| alertmanager | 9093 | alertmanager | Alert routing |
| loki | 3101 | loki | Log aggregation |

### 11.2 Grafana Dashboards

| Dashboard | Purpose | URL |
|-----------|---------|-----|
| Homelab AI Overview | Visão geral de todos os serviços | localhost:3100 |
| LiteLLM Metrics | Latência e error rate por modelo | localhost:3100 |
| Qdrant Collections | Tamanho e performance das collections | localhost:3100 |
| AI Agency | Threads ativos e uso de tokens | localhost:3100 |
| Node Exporter | CPU, RAM, disk do host | localhost:3100 |
| GPU Metrics | NVIDIA RTX 4090 utilization | localhost:3100 |

**Access:** `http://localhost:3100` ou via tunnel `https://grafana.zappro.site`

### 11.3 Alert Routing

**Channel:** Telegram Bot (@willzappro)

**Alertas configurados:**

| Alerta | Condição | Severidade |
|--------|----------|------------|
| Circuit Breaker | `circuit_breaker_open_duration > 5m` | Critical |
| Error Rate | `error_rate > 5%` por 5 min | Warning |
| API Latency | `p95_latency > 2s` por 10 min | Warning |
| Disk Usage | `disk_usage > 80%` | Warning |
| Memory Usage | `memory_usage > 90%` | Critical |
| Qdrant Down | `health_check == 0` por 1 min | Critical |
| LiteLLM Down | `health_check == 0` por 1 min | Critical |

### 11.4 Health Endpoints

| Service | Port | Endpoint | Expected Response |
|---------|------|----------|-------------------|
| AI Agency | 3001 | `/health` | `{"status": "healthy", ...}` |
| LiteLLM | 4000 | `/health` | Auth required (401 OK) |
| ai-gateway | 4002 | `/health` | Auth required (401 OK) |
| Qdrant | 6333 | `/health` | Auth required (401 OK) |
| MCP Memory | 4016 | `/health` | `{"status": "healthy", ...}` |
| Ollama | 11434 | `/api/tags` | JSON com models |
| mcp-qdrant | 4011 | (MCP protocol) | MCP response |

---

## 12. Network & Security

### 12.1 Cloudflare Tunnel Management

**Tunnel Name:** `will-zappro-homelab`
**Credential File:** `/home/will/.cloudflared/aee7a93d-c2e2-4c77-a395-71edc1821402.json`

**Ingress Routes:**

| Subdomain | Target | Purpose |
|-----------|--------|---------|
| api.zappro.site | localhost:4000 | LiteLLM proxy |
| hermes.zappro.site | localhost:8642 | Hermes Gateway |
| chat.zappro.site | 10.0.5.3:8080 | OpenWebUI |
| coolify.zappro.site | localhost:8000 | Coolify PaaS |
| git.zappro.site | localhost:3300 | Gitea Git |
| grafana.zappro.site | localhost:3100 | Monitoring (DNS removido) |
| list.zappro.site | localhost:4080 | Tools list |
| llm.zappro.site | localhost:4002 | ai-gateway |
| md.zappro.site | localhost:4081 | Obsidian vault |
| qdrant.zappro.site | localhost:6333 | Vector DB |
| pgadmin.zappro.site | localhost:4050 | PostgreSQL admin |

**Verificar status:**
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared --no-pager -n 20
```

**Restart:**
```bash
sudo systemctl restart cloudflared
```

### 12.2 Firewall (UFW)

**Regras ativas:**

```bash
# Verificar status
sudo ufw status verbose

# Regra padrão: negar entrada, permitir saída
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH (cuidado para não perder acesso!)
sudo ufw allow 22/tcp

# Docker network — containers têm suas próprias regras
# Não bloquear via UFW as redes bridge dos containers
```

**Ports que DEVEM estar abertos no host:**

| Port | Service | Access |
|------|---------|--------|
| 22 | SSH | host |
| 53 | DNS resolver | localhost |
| 2222 | Gitea SSH | host |
| 3000 | zappro-web | 0.0.0.0 |
| 4003 | zappro-api | 0.0.0.0 |
| 8000 | Coolify | via tunnel |
| 8642 | Hermes Gateway | loopback only |
| 8092 | Hermes MCP | loopback only |
| 11434 | Ollama | localhost + docker0 |
| 9100 | node-exporter | host |

### 12.3 Docker Network Isolation

| Network | Subnet | Purpose | Containers |
|---------|--------|---------|------------|
| bridge | 10.0.1.0/24 | Default | General |
| coolify | Auto | Coolify PaaS | coolify-*, qdrant |
| litellm_default | Auto | LiteLLM cluster | litellm, litellm-db, redis |
| openwebui_net | Auto | OpenWebUI | openwebui |
| monitoring_monitoring | Auto | Prometheus/Grafana | prometheus, grafana, loki |
| ai-gateway_default | Auto | ai-gateway | ai-gateway |
| gitea_default | Auto | Gitea Git | gitea, gitea-runner |
| mcp-* (per server) | Auto | MCP servers | mcp-* containers |

### 12.4 API Key Rotation Schedule

| Key | Rotation | Last Rotated | Notes |
|-----|----------|--------------|-------|
| LiteLLM API keys | 90 dias | — | Provider keys (OpenAI, Anthropic, etc.) |
| Cloudflare API token | 180 dias | — | Para Terraform |
| Qdrant API key | 90 dias | — | Collection access |
| Telegram Bot token | 180 dias | — | Se alterado, atualizar em todos os serviços |

---

## 13. Appendices

### 13.1 Quick Reference Commands

```bash
# Status de todos os containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Ver todos os health endpoints
for port in 3001 4000 4002 6333 4016 11434 6435; do
  echo -n "Port $port: "
  curl -sf -m 3 http://localhost:$port/health 2>/dev/null && echo "OK" || echo "FAIL"
done

# Restart all AI services
docker restart zappro-ai-gateway zappro-litellm zappro-qdrant

# Ver erros recentes
docker logs --since 1h ai-gateway litellm qdrant 2>&1 | grep -iE "error|fatal|panic"

# ZFS status
sudo zpool status
sudo zfs list -r tank

# Disk usage
df -h
docker system df

# GPU usage
nvidia-smi
```

### 13.2 Port Reference Table

| Port | Service | Container | Access |
|------|---------|-----------|--------|
| 3000 | zappro-web | (bun process) | 0.0.0.0 |
| 3300 | Gitea | zappro-gitea | localhost |
| 3456 | OpenWebUI | openwebui | localhost |
| 4000 | LiteLLM | zappro-litellm | host |
| 4002 | ai-gateway | zappro-ai-gateway | host |
| 4003 | zappro-api | (python process) | 0.0.0.0 |
| 4011 | mcp-qdrant | mcp-qdrant | localhost |
| 4012 | mcp-coolify | mcp-coolify-mcp-coolify-1 | localhost |
| 4013 | mcp-ollama | mcp-ollama-mcp-ollama-1 | localhost |
| 4014 | mcp-system | mcp-system-mcp-system-1 | localhost |
| 4015 | mcp-cron | mcp-cron-mcp-cron-1 | localhost |
| 4016 | mcp-memory | mcp-memory | localhost |
| 4050 | pgAdmin | pgadmin-* | localhost |
| 4080 | list-web | list-web | host |
| 4081 | obsidian-web | obsidian-web | host |
| 5173-5180 | Vite dev | vite | localhost |
| 6333 | Qdrant | qdrant | Coolify net |
| 6334 | Qdrant gRPC | qdrant | localhost |
| 6379 | Redis | zappro-redis | host |
| 6381 | Coolify Redis | coolify-redis | host |
| 8000 | Coolify | coolify-sentinel | localhost |
| 8080 | Coolify proxy | coolify | localhost |
| 8092 | Hermes MCP | (systemd) | localhost |
| 8642 | Hermes Gateway | (systemd) | localhost |
| 8888 | SearXNG | opencode-searxng | host |
| 9090 | Prometheus | prometheus | localhost |
| 9091 | Prometheus | prometheus | host |
| 9100 | node-exporter | node-exporter | host |
| 11434 | Ollama | (systemd) | localhost + docker0 |
| 11436 | Qwen2-VL | qwen2-vl7b | localhost |

### 13.3 Container Restart Matrix

| Container | Restart Policy | Auto-restart | Notas |
|-----------|---------------|--------------|-------|
| zappro-litellm | unless-stopped | Yes | |
| zappro-ai-gateway | unless-stopped | Yes | Currently UNHEALTHY |
| qdrant | unless-stopped | Yes | |
| zappro-redis | unless-stopped | Yes | |
| coolify-sentinel | unless-stopped | Yes | |
| zappro-gitea | unless-stopped | Yes | |
| openwebui | unless-stopped | Yes | |
| prometheus | unless-stopped | Yes | |
| grafana | unless-stopped | Yes | |
| node-exporter | unless-stopped | Yes | |
| mcp-* | unless-stopped | Yes | |

### 13.4 Useful Aliases (adicionar a ~/.bashrc)

```bash
# Containers
alias dps='docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
alias dlogs='docker logs --since 1h'
alias docker-restart-ai='docker restart zappro-ai-gateway zappro-litellm zappro-qdrant'

# Health check
alias health-all='for port in 3001 4000 4002 6333 4016 11434 6435; do echo -n "Port $port: "; curl -sf -m 3 http://localhost:$port/health 2>/dev/null && echo "OK" || echo "FAIL"; done'

# ZFS
alias zfs-status='sudo zpool status && sudo zfs list -r tank'
alias zfs-scrub='sudo zpool scrub tank'

# Backups
alias backup-verify='find /srv/backups -type f -mtime -1 | head -20'

# GPU
alias gpu='nvidia-smi --query-gpu=utilization.gpu,utilization.memory,temperature.gpu --format=csv'

# Logs
alias logs-error='docker logs --since 1h 2>&1 | grep -iE "error|fatal|panic"'

# Network
alias tunnel-status='sudo systemctl status cloudflared'
alias tunnel-logs='sudo journalctl -u cloudflared --since 10m'

# Ollama
alias ollama-models='curl -s http://localhost:11434/api/tags | jq ".models[].name"'
```

---

## Documentos Relacionados

- [NETWORK_MAP.md](./NETWORK_MAP.md) — Topologia de rede completa
- [PORTS.md](./PORTS.md) — Alocação de portas
- [SUBDOMAINS.md](./SUBDOMAINS.md) — DNS records Cloudflare
- [SERVICES-HEALTH.md](./SERVICES-HEALTH.md) — Status dos containers
- [BACKUP-STATUS.md](./BACKUP-STATUS.md) — Status dos backups
- [OPS_RUNBOOK.md](./OPS_RUNBOOK.md) — Runbook operacional
- [ZFS-POLICY.md](./ZFS-POLICY.md) — Política de snapshots ZFS
- [CLOUDFLARED-STATUS.md](./CLOUDFLARED-STATUS.md) — Status do tunnel

---

**Última atualização:** 2026-04-23
**Próxima revisão:** 2026-05-23
**Owner:** Platform Engineering — Will Zappro
