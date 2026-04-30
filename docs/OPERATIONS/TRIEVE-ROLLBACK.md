# Rollback Procedures — Trieve RAG Server

Procedimentos de emergencia para recuperacao do servidor Trieve RAG.

---

## Prerequisitos

- Acesso SSH ao host com Trieve
- Permissao de leitura em `/srv/backups/trieve/`
- Docker e docker-compose instalados
- Variáveis de ambiente configuradas em `.env` (TRIEVE_POSTGRES_URL, QDRANT_URL, etc.)
- Acesso ao container registry (para rollback de imagens)

---

## Checklist Pre-Rollback

### Verificacoes obrigatorias antes de qualquer rollback

```bash
# 1. Verificar espaco em disco
df -h /srv/data

# 2. Confirmar existencia de backups
ls -lh /srv/backups/trieve/
ls -lh /srv/backups/postgres/
ls -lh /srv/backups/qdrant/

# 3. Verificar status atual dos containers
docker ps -a | grep -E "trieve|postgres|qdrant"

# 4. Registrar estado atual (logs, hashes, versoes)
docker logs --tail 50 trieve 2>&1 | tail -20
git -C /srv/monorepo log --oneline -5

# 5. Confirmar backups mais recentes
ls -lth /srv/backups/trieve/ | head -3
ls -lth /srv/backups/postgres/ | head -3
ls -lth /srv/backups/qdrant/ | head -3
```

---

## Cenarios de Rollback

---

## 1. Trieve Container Crash

### Sintoma
- Container Trieve em estado `Restarting` ou `Exited`
- Health checks falhando (`curl -sf http://localhost:6333/health` retorna erro)
- Logs mostram `panic`, `signal killed`, ou `out of memory`

### Comandos de Deteccao
```bash
# Verificar status do container
docker ps -a | grep trieve

# Verificar motivo da parada
docker logs --tail 100 trieve 2>&1 | grep -iE "error|fatal|panic|signal"

# Verificar recursos
docker stats --no-stream trieve 2>/dev/null || echo "Container nao rodando"
```

### Passos de Rollback

```bash
# 1. Parar container problemático
docker-compose -f /srv/monorepo/docker-compose.trieve.yml down

# 2. Verificar integridade do volume de dados
docker volume ls | grep trieve
docker volume inspect trieve_data 2>/dev/null

# 3. Limpar container fantasma
docker rm -f trieve 2>/dev/null || true

# 4. Realizar backup do estado atual (antes do rollback)
mkdir -p /srv/backups/trieve/pre-rollback-$(date +%Y%m%d-%H%M)
docker cp trieve:/app/data /srv/backups/trieve/pre-rollback-$(date +%Y%m%d-%H%M)/ 2>/dev/null || true

# 5. Puxar imagem anterior (se crash foi pos-upgrade)
docker pull ghcr.io/trieve/trieve:TAG_ANTERIOR

# 6. Subir com configuracao anterior
docker-compose -f /srv/monorepo/docker-compose.trieve.yml down
git checkout TAG_ANTERIOR -- docker-compose.trieve.yml
docker-compose -f /srv/monorepo/docker-compose.trieve.yml up -d

# 7. Se problema persistir: rollback total do stack
cd /srv/monorepo
git checkout TAG_ANTERIOR
docker-compose -f docker-compose.trieve.yml down
docker-compose -f docker-compose.trieve.yml up -d
```

### Verificacao
```bash
# Aguardar 30s e verificar health
sleep 30
curl -sf http://localhost:6333/health && echo "HEALTHY"
docker ps | grep trieve | grep "Up"

# Verificar logs por erros residuais
docker logs --tail 50 trieve 2>&1 | grep -iE "error|panic" || echo "SEM ERROS"
```

### Prevencao
- Monitorar health checks via Prometheus/Grafana
- Definir `restart: unless-stopped` no docker-compose
- Manter 3.tags anteriores como rollback targets
- Configurar alerts para OOM kills

---

## 2. Postgres Metadata Corruption

### Sintoma
- Queries Trieve retornando `relation does not exist` ou `duplicate key`
- Container Postgres em estado `unhealthy`
- Logs mostram `FATAL: database corruption` ou `WAL corruption`

### Comandos de Deteccao
```bash
# Verificar status Postgres
docker exec trieve-postgres pg_isready -U postgres

# Testar conexao
docker exec trieve-postgres psql -U postgres -d trierve -c "SELECT 1"

# Verificar integridade dos indices
docker exec trieve-postgres psql -U postgres -d trierve -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public';" | head -20

# Verificar tamanho das tabelas (anomalias)
docker exec trieve-postgres psql -U postgres -d trierve -c "SELECT pg_size_pretty(pg_total_relation_size('chunks'));" 2>/dev/null || echo "TABELA NAO EXISTE"
```

### Passos de Rollback

```bash
# 1. Parar Trieve (previne escrita durante recover)
docker-compose -f /srv/monorepo/docker-compose.trieve.yml stop trieve

# 2. Criar backup do estado corrupto
mkdir -p /srv/backups/postgres/corrupto-$(date +%Y%m%d-%H%M)
docker exec trieve-postgres pg_dump -U postgres trierve > /srv/backups/postgres/corrupto-$(date +%Y%m%d-%H%M)/trieve-backup-corrupto.sql 2>/dev/null || true

# 3. Identificar backup mais recente valido
ls -lth /srv/backups/postgres/ | head -5
BACKUP_FILE=$(ls -t /srv/backups/postgres/trieve-backup-*.sql.gz 2>/dev/null | head -1)

# 4. Parar Postgres
docker-compose -f /srv/monorepo/docker-compose.trieve.yml stop postgres

# 5. Restaurar volume do Postgres
docker volume inspect trieve_postgres_data 2>/dev/null
# Se usar volume bind mount:
# cp -r /srv/data/postgres /srv/backups/postgres/pre-restore-$(date +%Y%m%d)

# 6. Recriar container Postgres com backup
docker-compose -f /srv/monorepo/docker-compose.trieve.yml up -d postgres
sleep 10

# 7. Verificar integridade
docker exec trieve-postgres pg_isready -U postgres

# 8. Restaurar dados do backup (se backup valido existir)
if [ -n "$BACKUP_FILE" ]; then
  gunzip -c "$BACKUP_FILE" | docker exec -i trieve-postgres psql -U postgres -d trierve
fi

# 9. Subir Trieve
docker-compose -f /srv/monorepo/docker-compose.trieve.yml up -d trieve
```

### Verificacao
```bash
# Aguardar inicializacao
sleep 20

# Testar health do Postgres
docker exec trieve-postgres pg_isready -U postgres

# Testar health do Trieve
curl -sf http://localhost:6333/health && echo "HEALTHY"

# Verificar chunks
curl -sf http://localhost:6333/api/v1/chunk/search | jq '.results | length' 2>/dev/null || echo "SEM DADOS"

# Testar query basica
docker exec trieve-postgres psql -U postgres -d trierve -c "SELECT COUNT(*) FROM chunks;"
```

### Prevencao
- Configurar `pg_dump` diario com retencao de 7 dias
- Habilitar WAL archiving para Point-in-Time Recovery
- Monitorar uso de disco (postgres expande em caso de queries complexas)
- Testar restore de backups mensalmente

---

## 3. Qdrant Collection Loss

### Sintoma
- Trieve retorna vetores vazios ou `collection not found`
- Logs mostram `Error: No such collection: default`
- GET em `/collections` retorna array vazio

### Comandos de Deteccao
```bash
# Verificar status Qdrant
curl -sf http://localhost:6333/collections | jq '.result.collections'

# Listar todas as collections
curl -sf http://localhost:6333/collections | jq '.result.collections[].name'

# Verificar numero de pontos
curl -sf http://localhost:6333/collections/default/points | jq '.result.points | length' 2>/dev/null || echo "COLLECTION NAO EXISTE"

# Verificar logs Qdrant
docker logs --tail 50 qdrant 2>&1 | grep -iE "error|collection|storage"
```

### Passos de Rollback

```bash
# 1. Registrar estado atual (para analise posterior)
curl -sf http://localhost:6333/collections > /srv/backups/qdrant/collections-pre-rollback-$(date +%Y%m%d-%H%M).json

# 2. Parar Trieve (previne escrita)
docker-compose -f /srv/monorepo/docker-compose.trieve.yml stop trieve

# 3. Parar Qdrant
docker-compose -f /srv/monorepo/docker-compose.trieve.yml stop qdrant

# 4. Backup do estado atual
mkdir -p /srv/backups/qdrant/pre-rollback-$(date +%Y%m%d-%H%M)
cp -r /srv/data/qdrant/storage /srv/backups/qdrant/pre-rollback-$(date +%Y%m%d-%H%M)/ 2>/dev/null || true
cp -r /srv/data/qdrant/snapshots /srv/backups/qdrant/pre-rollback-$(date +%Y%m%d-%H%M)/ 2>/dev/null || true

# 5. Identificar backup de collection mais recente
ls -lth /srv/backups/qdrant/collections-*.json | head -3
SNAPSHOT=$(ls -t /srv/data/qdrant/snapshots/*.snapshot 2>/dev/null | head -1)

# 6. Restaurar collection do snapshot
if [ -n "$SNAPSHOT" ]; then
  docker-compose -f /srv/monorepo/docker-compose.trieve.yml up -d qdrant
  sleep 10

  # Extrair snapshot
  curl -X POST http://localhost:6333/collections/default/snapshots \
    -H "Content-Type: application/json" \
    -d "{\"location\": \"$SNAPSHOT\"}"
fi

# 7. Se snapshot nao existir: recriar collection vazia (ultimo recurso)
docker-compose -f /srv/monorepo/docker-compose.trieve.yml up -d qdrant
sleep 10
curl -X PUT http://localhost:6333/collections/default -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    }
  }' 2>/dev/null || true

# 8. Subir Trieve
docker-compose -f /srv/monorepo/docker-compose.trieve.yml up -d trieve
```

### Verificacao
```bash
# Aguardar inicializacao
sleep 30

# Verificar collections
curl -sf http://localhost:6333/collections | jq '.result.collections'

# Verificar numero de pontos
curl -sf http://localhost:6333/collections/default/points | jq '.result.points | length'

# Testar busca vetorial
curl -sf -X POST http://localhost:6333/collections/default/points/search \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.1]*768, "limit": 5}' | jq '.result | length'
```

### Prevencao
- Configurar snapshot automatico diario das collections
- Manter retencao de 7.snapshots localmente
- Sincronizar snapshots para storageoff-site (S3/GCS)
- Monitorar espaco em disco (`/srv/data/qdrant`)

---

## 4. Failed Upgrade

### Sintoma
- Deploy via CI/CD falhou apos atualizacao de versao
- Trieve retorna 502/503 apos upgrade
- Health checks falhando pos-migracao de schema
- Incompatibilidade entre versao da imagem e schema do banco

### Comandos de Deteccao
```bash
# Verificar ultima tag deployada
git -C /srv/monorepo describe --tags --abbrev=0

# Verificar logs de deploy
gh run view --log -limit 50 2>/dev/null | grep -iE "error|fail|abort"

# Verificar health
curl -sf http://localhost:6333/health || echo "UNHEALTHY"

# Comparar versao da imagem com release atual
docker images | grep trieve
```

### Passos de Rollback

```bash
# 1. Identificar ultima versao estavel
git -C /srv/monorepo tag -l --sort=-version:refname | head -10

# 2. Checkout da tag anterior
cd /srv/monorepo
git checkout TAG_ANTERIOR_ESTAVEL

# 3. Realizar backup pre-rollback
mkdir -p /srv/backups/trieve/pre-rollback-$(date +%Y%m%d-%H%M)
docker cp trieve:/app/data /srv/backups/trieve/pre-rollback-$(date +%Y%m%d-%H%M)/ 2>/dev/null || true

# 4. Parar stack atual
docker-compose -f /srv/monorepo/docker-compose.trieve.yml down

# 5. Puxar imagem da versao anterior
docker pull ghcr.io/trieve/trieve:TAG_ANTERIOR_ESTAVEL

# 6. Subir com configuracao da versao anterior
git checkout TAG_ANTERIOR_ESTAVEL -- docker-compose.trieve.yml .env
docker-compose -f /srv/monorepo/docker-compose.trieve.yml up -d

# 7. Verificar integridade
sleep 30
curl -sf http://localhost:6333/health && echo "HEALTHY"
docker ps | grep -E "trieve|postgres|qdrant" | grep "Up"
```

### Verificacao
```bash
# Testar health endpoint
curl -sf http://localhost:6333/health && echo "HEALTHY"

# Verificar containers
docker ps -a | grep -E "trieve|postgres|qdrant"

# Verificar logs por erros residuais
docker logs --tail 50 trieve 2>&1 | grep -iE "error|panic|fatal" || echo "SEM ERROS CRITICOS"

# Testar operacao basica (criar chunk)
curl -sf -X POST http://localhost:6333/api/v1/chunk \
  -H "Content-Type: application/json" \
  -d '{"text": "test", "collection_id": "default"}' | jq '.success' 2>/dev/null && echo "WRITE OK"

# Verificar versao corrigida
git -C /srv/monorepo describe --tags --abbrev=0
docker images | grep trieve
```

### Prevencao
- Sempre testar upgrade em staging antes de producao
- Manter 3.tags anteriores como rollback targets
- Usar blue-green deploy (2 ambientes alternados)
- Configurar smoke tests no CI/CD que validem health pos-deploy
- Migrar schema de forma backward-compatible

---

## Verificacao Pos-Rollback

### Checklist de validacao

```bash
# 1. Health check basico
curl -sf http://localhost:6333/health && echo "[OK] Trieve healthy"

# 2. Status dos containers
docker ps | grep -E "trieve|postgres|qdrant" | grep "Up" || echo "[ERRO] Container down"

# 3. Conectividade Postgres
docker exec trieve-postgres pg_isready -U postgres && echo "[OK] Postgres ready"

# 4. Conectividade Qdrant
curl -sf http://localhost:6333/collections | jq '.result.collections' > /dev/null && echo "[OK] Qdrant ready"

# 5. Verificar logs por erros criticos
docker logs --tail 100 trieve 2>&1 | grep -iE "error|panic|fatal" && echo "[ALERTA] Erros nos logs" || echo "[OK] Sem erros criticos"

# 6. Testar operacao de leitura
curl -sf http://localhost:6333/api/v1/chunk/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 1}' | jq '.results' > /dev/null 2>&1 && echo "[OK] Search funcional"

# 7. Testar operacao de escrita
curl -sf -X POST http://localhost:6333/api/v1/chunk \
  -H "Content-Type: application/json" \
  -d '{"text": "rollback-test", "collection_id": "default"}' | jq '.success' > /dev/null 2>&1 && echo "[OK] Write funcional"

# 8. Verificar espaco em disco
df -h /srv/data | tail -1 | awk '{print "[OK] Disco: " $5 " usado"}'
```

---

## Contatos de Emergencia

| Situacao | Responsavel | Contato |
|----------|-------------|---------|
| Infraestrutura | Platform Team | `#infra-emergency` (Slack) |
| Database Postgres | DBA On-Call | PagerDuty `postgres-oncall` |
| Trieve/App | Dev Team | `#dev-emergency` (Slack) |
| Backups | Backup Team | `#backup-recovery` (Slack) |

### Recursos Adicionais
- **Mapa de Rede**: `/srv/ops/ai-governance/NETWORK_MAP.md`
- **Segredos**: Nunca imprimir valores — usar `test -n` pattern
- **Rollback**: Sempre snapshot antes de mudancas destrutivas

---

## Quick Reference

| Cenario | Fix Rapido |
|---------|-----------|
| Container crash | `docker-compose -f docker-compose.trieve.yml down && git checkout TAG && docker-compose up -d` |
| Postgres corrompido | `docker-compose stop postgres && gunzip -c BACKUP.sql.gz \| psql` |
| Qdrant perdido | `docker-compose stop qdrant && cp -r BACKUP/storage /srv/data/qdrant/` |
| Upgrade falhou | `git checkout TAG_ANTERIOR && docker-compose down && docker-compose up -d` |