# Homelab AI Operations Runbook

> **Data de criação:** 2026-04-23
> **Versão:** 1.0.0
> **Owner:** Platform Engineering
> **Last Verified:** 2026-04-23

---

## Tabela de Conteúdo

1. [Daily Operations](#daily-operations)
2. [Common Incidents](#common-incidents)
3. [Maintenance Windows](#maintenance-windows)
4. [Capacity Planning](#capacity-planning)
5. [Emergency Procedures](#emergency-procedures)
6. [Key Contacts](#key-contacts)
7. [Monitoring Alerts](#monitoring-alerts)
8. [Service URLs and Ports](#service-urls-and-ports)

---

## Daily Operations

### Health Check Script

Execute o script de verificação diária:

```bash
bash /srv/monorepo/scripts/daily-health-check.sh
```

O script verifica:
- Todos os endpoints de saúde dos serviços
- Taxa de erros via Grafana
- Status dos backups
- Envia relatório para o bot Telegram

### Grafana Dashboard Review

Acesse o dashboard em `http://localhost:3000` (Grafana interno) ou via Cloudflare Tunnel.

**Métricas a verificar:**

| Métrica | Threshold | Ação |
|---------|-----------|------|
| Error Rate | < 5% | Investigar se > 5% |
| API Latency p95 | < 2s | Investigar se > 2s |
| Circuit Breaker | Fechado | Abrir tickets se > 5 min aberto |
| Disk Usage | < 80% | Planejar expansão se > 70% |
| Memory Usage | < 90% | Investigar se > 90% |

**Dashboards principais:**
- `Homelab AI Overview` - Visão geral de todos os serviços
- `LiteLLM Metrics` - Latência e taxa de erro por modelo
- `Qdrant Collections` - Tamanho e performance das collections
- `Hermes Agency` - Threads ativos e uso de tokens

### Log Review

Verifique logs de ERROR nas últimas 24 horas:

```bash
# Todos os serviços
docker logs --since 24h hermes-agency 2>&1 | grep -iE "error|fatal|panic"
docker logs --since 24h ai-gateway 2>&1 | grep -iE "error|fatal|panic"
docker logs --since 24h litellm 2>&1 | grep -iE "error|fatal|panic"
docker logs --since 24h qdrant 2>&1 | grep -iE "error|fatal|panic"

# Ou usar o script existente
bash /srv/monorepo/scripts/health-check.sh
```

**Locais de log:**
- `/srv/ops/logs/` - Logs operacionais
- Docker logs via `docker logs <container>`

### Backup Verification

Verifique se os backups foram executados:

```bash
# PostgreSQL - pg_dump
ls -la /srv/backups/postgres/
# Esperado: arquivos .sql ou .sql.gz das últimas 24h

# Qdrant snapshots
ls -la /srv/backups/qdrant/
# Esperado: snapshots das collections

# Redis RDB
ls -la /srv/backups/redis/
# Esperado: arquivos .rdb.gz

# Verificar data do último backup
find /srv/backups -type f -mtime -1 | head -20
```

---

## Common Incidents

### Circuit Breaker Open

**Sintomas:** Requisições falhando com erro de circuit breaker.

**Diagnóstico:**
```bash
# Identificar qual skill tem o circuit breaker aberto
curl -s http://localhost:4002/api/circuit-breakers | jq

# Ver logs do AI Gateway
docker logs ai-gateway --tail 100 | grep -i circuit

# Verificar qual provedor/modelo está afetado
curl -s http://localhost:4002/api/status | jq '.providers'
```

**Resolução:**
```bash
# Reset via /health endpoint (se disponível)
curl -X POST http://localhost:4002/circuit-breaker/reset -d '{"skill":"<skill-name>"}'

# Ou reiniciar o AI Gateway
docker restart ai-gateway
```

**Fallback:** Usar provedor alternativo enquanto o problema é resolvido.

---

### Qdrant Connection Refused

**Sintomas:** `Connection refused` ao conectar ao Qdrant.

**Diagnóstico:**
```bash
# Verificar se o container está rodando
docker ps | grep qdrant

# Verificar logs
docker logs qdrant --tail 50

# Testar endpoint de saúde
curl -sf http://localhost:6333/health && echo "OK" || echo "FAIL"
```

**Resolução:**
```bash
# Reiniciar Qdrant
docker restart qdrant
sleep 5

# Verificar se恢复了
curl -sf http://localhost:6333/health && echo "OK" || echo "FAIL"

# Se o problema persistir, verificar espaço em disco
df -h /srv/docker/qdrant
```

---

### Telegram Bot Not Responding

**Sintomas:** Bot não responde a comandos.

**Diagnóstico:**
```bash
# Verificar se o container do bot está rodando
docker ps | grep telegram

# Verificar token
docker exec <telegram-container> env | grep TELEGRAM_BOT_TOKEN

# Verificar logs
docker logs <telegram-container> --tail 50
```

**Resolução:**
```bash
# Reiniciar polling
docker restart <telegram-container>

# Ou verificar status do bot via API
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

---

### LLM API Down

**Sintomas:** Erro ao fazer requisições para modelos de IA.

**Diagnóstico:**
```bash
# Verificar status do LiteLLM
curl -sf http://localhost:4000/health && echo "OK" || echo "FAIL"

# Listar modelos disponíveis
curl -s http://localhost:4000/ollm/v1/model_list

# Verificar conexão com provedores
curl -s http://localhost:4000/ollm/v1/providers | jq
```

**Resolução:**
```bash
# Verificar fallback chain no config
cat /srv/docker/litellm/config.yaml

# Reiniciar LiteLLM se necessário
docker restart litellm

# Verificar chaves de API dos provedores
docker exec litellm env | grep -iE "openai|anthropic|api_key"
```

**Fallback Chain típica:**
1. OpenAI → Anthropic → Ollama local → Erro

---

### Rate Limit Hit

**Sintomas:** Erro 429 ao fazer requisições.

**Diagnóstico:**
```bash
# Identificar qual usuário está causando o rate limit
docker logs litellm --tail 100 | grep -i "rate.limit" | tail -10

# Ver configurações de rate limit
curl -s http://localhost:4000/rate_limits | jq
```

**Resolução:**
```bash
# Identificar abuso vs uso legítimo
docker logs litellm --since 1h | grep -oE "user=[^&]+" | sort | uniq -c | sort -rn

# Se abuso: bloquear usuário
# Se legítimo: aumentar limite no config.yaml

# Exemplo de aumento de limite no config.yaml:
# model: claude-3-5-sonnet
#   rate_limit:
#     requests_per_minute: 100  # aumentar de 60 para 100
```

---

## Maintenance Windows

### PostgreSQL Migrations

**Agendamento:** Durante baixo tráfego (idealmente 02:00-04:00 UTC).

**Procedimento:**
```bash
# 1. Criar snapshot ZFS antes da migração
sudo zfs snapshot srv/docker-data@pre-migration-$(date +%Y%m%d%H%M%S)

# 2. Fazer backup do banco
docker exec postgres pg_dump -U postgres -d monorepo > /srv/backups/postgres/pre-migration-$(date +%Y%m%d).sql

# 3. Executar migração em dry-run primeiro
docker exec postgres psql -U postgres -d monorepo -c "SELECT * FROM pg_migration_info()"

# 4. Executar migração
cd /srv/monorepo && bash scripts/db-migrate.sh

# 5. Verificar sucesso
docker exec postgres psql -U postgres -d monorepo -c "SELECT * FROM pg_migration_info()"
```

**Rollback:**
```bash
# Restaurar do snapshot ZFS
sudo zfs rollback srv/docker-data@pre-migration-<timestamp>

# Ou restaurar do backup SQL
docker exec -i postgres psql -U postgres -d monorepo < /srv/backups/postgres/pre-migration-<date>.sql
```

---

### Qdrant Reindexing

**Nota:** Pode ser feito online, sem downtime.

**Procedimento:**
```bash
# 1. Verificar collections atuais
curl -s http://localhost:6333/collections | jq '.result.collections[].name'

# 2. Criar snapshot da collection antes de reindexar
curl -X POST "http://localhost:6333/collections/<collection-name>/snapshots" | jq

# 3. Se for rebuild de index, fazer inline (Qdrant suporta online reindex)
curl -X PUT "http://localhost:6333/collections/<collection-name>/index" \
  -H "Content-Type: application/json" \
  -d '{"wait": true}'

# 4. Verificar status
curl -s http://localhost:6333/collections/<collection-name>/index | jq
```

---

### Trieve Dataset Rebuild

**Procedimento:**
```bash
# 1. Criar novo dataset
curl -X POST "http://localhost:6435/api/v1/datasets" \
  -H "Content-Type: application/json" \
  -d '{"name": "dataset-rebuild-$(date +%Y%m%d)"}'

# 2. Obter API key do novo dataset
NEW_DATASET_ID=<id>

# 3. Reindexar dados para o novo dataset
cd /srv/monorepo && bash scripts/rag-ingest.ts --dataset $NEW_DATASET_ID

# 4. Quando pronto, switch no config
# Atualizar config para usar novo dataset ID

# 5. Verificar funcionamento
curl -s "http://localhost:6435/api/v1/datasets/$NEW_DATASET_ID/search" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":{"q":"test query"}}'

# 6. Deletar dataset antigo após confirmação
curl -X DELETE "http://localhost:6435/api/v1/datasets/<old-dataset-id>"
```

---

### LiteLLM Config Changes

**reload sem restart:**

```bash
# LiteLLM suporta reload via sinal SIGHUP
docker exec litellm kill -SIGHUP 1

# Ou via API (se configurado)
curl -X POST http://localhost:4000/config/reload

# Verificar se config foi recarregada
docker logs litellm --tail 20 | grep -i "config"
```

---

## Capacity Planning

### Monitor Qdrant Collection Sizes

```bash
# Listar todas as collections e seus tamanhos
curl -s http://localhost:6333/collections | jq '.result.collections[] | {name, vectors_count, points_count}'

# Ver detalhes de uma collection específica
curl -s http://localhost:6333/collections/<collection-name> | jq '.result'
```

**Threshold:** Alertar quando qualquer collection atingir 80% da capacidade planejada.

### Monitor Token Usage per Provider

```bash
# Ver uso via LiteLLM
curl -s http://localhost:4000/ollm/v1/model_list | jq

# Ver logs para估算 usage
docker logs litellm --since 24h | grep -oE "model=[^&]+|tokens=[0-9]+" | head -100
```

### Plan for 2x Capacity at 80% Utilization

**Quando actuar:**
- Qualquer serviço atingindo > 70% utilização regular → planejar expansão
- Qualquer serviço atingindo > 80% → expandir imediatamente

**Qdrant:** Monitorar `/srv/docker/qdrant/data` tamanho
```bash
du -sh /srv/docker/qdrant/data/*
```

**Redis:** Monitorar memória
```bash
docker exec redis redis-cli INFO memory | grep used_memory_human
```

### Database Growth Estimation

```bash
# Ver tamanho atual do PostgreSQL
docker exec postgres psql -U postgres -d monorepo -c "SELECT pg_size_pretty(pg_database_size('monorepo'));"

# Ver crescimento por tabela
docker exec postgres psql -U postgres -d monorepo -c "
SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid)) as size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 10;
"
```

---

## Emergency Procedures

### Complete Outage

**Passo 1: Verificar Cloudflare Tunnel**
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared --since 10m | grep -iE 'error|disconnected'
```

**Passo 2: Verificar todos os health endpoints**
```bash
for service in hermes-agency ai-gateway litellm qdrant; do
  echo -n "$service: "
  curl -sf -m 5 http://localhost:${PORT}/health 2>/dev/null && echo "OK" || echo "FAIL"
done
```

**Passo 3: Verificar Docker status**
```bash
docker ps
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Passo 4: Verificar ZFS pools**
```bash
sudo zpool status
sudo zpool list
```

---

### Data Loss

**Se PITR disponível (ZFS + WAL):**
```bash
# Identificar snapshot mais recente com dados válidos
sudo zfs list -t snapshot -o name | grep <dataset> | sort -r | head -1

# Restaurar para ponto específico
sudo zfs rollback <dataset>@<snapshot-name>
```

**Se apenas backup simples:**
```bash
# Restaurar do pg_dump
docker exec -i postgres psql -U postgres -d monorepo < /srv/backups/postgres/latest.sql

# Restaurar Redis RDB
docker exec -i redis redis-cli RESTORE <key> 0 "<RDB blob>" REPLACE
```

---

### Security Incident

**Se suspeita de comprometimento:**

```bash
# 1. Rotacionar TODAS as API keys imediatamente
# Editar arquivos .env de todos os serviços

# 2. Audit logs de acesso
docker logs --since 24h <service> | grep -iE 'unauthorized|403|401|failed.auth'

# 3. Verificar acessos suspeitos
docker exec postgres psql -U postgres -d monorepo -c "
SELECT * FROM logs WHERE action = 'login' AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
"

# 4. Verificar Cloudflare access logs
sudo tail -100 /var/log/cloudflared/access.log

# 5. Notificar equipe de segurança
```

---

## Key Contacts

| Função | Nome | Contato | Horário |
|--------|------|---------|---------|
| Primary Oncall | Will Zappro | Telegram: @willzappro | 24/7 |
| Cloudflare Support | - | https://dash.cloudflare.com/ | Portal 24/7 |
| Coolify Support | - | https://cool.io/support | Portal + Comunidade |
| LiteLLM Support | - | https://github.com/BerriAI/litellm | GitHub Issues |

### Escalação

1. **Nível 1:** Oncall local (Telegram)
2. **Nível 2:** Platform Engineer
3. **Nível 3:** Infrastructure Lead

---

## Monitoring Alerts

Configure os seguintes alertas no Grafana:

| Alerta | Condição | Severidade | Ação |
|--------|----------|------------|------|
| Circuit Breaker | `circuit_breaker_open_duration > 5m` | Critical | Investigar imediatamente |
| Error Rate | `error_rate > 5%` por 5 min | Warning | Investigar |
| API Latency | `p95_latency > 2s` por 10 min | Warning | Investigar |
| Disk Usage | `disk_usage > 80%` | Warning | Planejar expansão |
| Memory Usage | `memory_usage > 90%` | Critical | Investigar imediatamente |
| Qdrant Down | `health_check == 0` por 1 min | Critical | Reiniciar Qdrant |
| LiteLLM Down | `health_check == 0` por 1 min | Critical | Reiniciar LiteLLM |

---

## Service URLs and Ports

| Serviço | URL Externa | Porta Local | Health Endpoint |
|---------|-------------|-------------|-----------------|
| Hermes Agency | https://hermes-agency.zappro.site | 3001 | http://localhost:3001/health |
| LiteLLM | https://llm.zappro.site | 4000 | http://localhost:4000/health |
| AI Gateway | https://ai-gateway.zappro.site | 4002 | http://localhost:4002/health |
| Qdrant | localhost | 6333 | http://localhost:6333/health |
| Qdrant Dashboard | localhost | 6334 | http://localhost:6334/dashboard |
| Redis | zappro-redis | 6379 | redis-cli PING |
| PostgreSQL MCP | localhost | 4017 | http://localhost:4017/health |
| Ollama | localhost | 11434 | http://localhost:11434/api/tags |
| Trieve | localhost | 6435 | http://localhost:6435/api/v1/health |
| Grafana | https://grafana.zappro.site | 3000 | http://localhost:3000/api/health |
| Coolify | https://coolify.zappro.site | 8000 | http://localhost:8000/api/health |

### Container Names (Docker)

```
zappro-hermes-agency
zappro-ai-gateway
zappro-litellm
zappro-qdrant
zappro-redis
coolify-redis
zappro-ollama
```

---

## Quick Reference

### Restart All AI Services

```bash
docker restart zappro-hermes-agency zappro-ai-gateway zappro-litellm zappro-qdrant
```

### Check All Health Endpoints

```bash
for port in 3001 4000 4002 6333 4017 11434 6435; do
  echo -n "Port $port: "
  curl -sf -m 3 http://localhost:$port/health 2>/dev/null && echo "OK" || echo "FAIL"
done
```

### View Recent Errors

```bash
docker logs --since 1h hermes-agency ai-gateway litellm qdrant 2>&1 | grep -iE "error|fatal|panic"
```

---

*Este runbook deve ser atualizado sempre que houver mudanças na infraestrutura.*
