# Disaster Recovery — Trieve RAG System

**Scope:** Trieve (Qdrant + Postgres + API) RAG pipeline em `zappro.site`
**Last Updated:** 2026-04-30

---

## 1. RTO / RPO Targets

| Metric | Target | Descricao |
|--------|--------|-----------|
| **RTO** (Recovery Time Objective) | < 1 hora | Tempo maximo para restaurar servico operacional |
| **RPO** (Recovery Point Objective) | < 24 horas | Perda maxima de dados aceitavel |

| Servico | RTO Estimado | RPO Estimado |
|---------|--------------|--------------|
| Trieve API (qdrant + postgres) | 30 min | < 24h |
| Collections (embeddings vetoriais) | 20 min | < 24h |
| Dados relacionais (chunks, tags, sessions) | 30 min | < 24h |
| Search service (fallback) | 15 min | N/A |

---

## 2. Estrategia de Backup

### Assets Críticos

| Asset | Path | Descricao | Prioridade |
|-------|------|-----------|------------|
| Qdrant collections | `/srv/data/qdrant/` | Embeddings vetoriais, indice de busca | P0 |
| Postgres Trieve | `/srv/docker-data/` ou volume Docker | Chunks, tags, sessions, configs | P0 |
| Trieve config | `/srv/monorepo/trieve/` ou `/srv/data/trieve/` | API keys, env, mappings | P1 |
| Snapshots de collecao | `/srv/backups/trieve/collections/` | Export periodico das collections | P1 |

### Agenda de Backup

| Tipo | Frequencia | Retencao | Local |
|------|-----------|----------|-------|
| Qdrant snapshots | Diario as 03:00 | 7 dias | `/srv/backups/trieve/qdrant/` |
| Postgres dump | Diario as 02:30 | 7 dias | `/srv/backups/trieve/postgres/` |
| Collections export (snapshot API) | Diario as 03:30 | 7 dias | `/srv/backups/trieve/collections/` |
| Config files | Semanal (Domingo 04:30) | 4 semanas | `/srv/backups/trieve/config/` |

### Cron Jobs Ativos

```cron
# Qdrant snapshot
0 3 * * * bash /srv/ops/scripts/backup-trieve-qdrant.sh >> /srv/ops/logs/backup-trieve-qdrant.log 2>&1

# Postgres dump
30 2 * * * bash /srv/ops/scripts/backup-trieve-postgres.sh >> /srv/ops/logs/backup-trieve-postgres.log 2>&1

# Collections snapshot via Trieve API
30 3 * * * bash /srv/ops/scripts/backup-trieve-collections.sh >> /srv/ops/logs/backup-trieve-collections.log 2>&1

# Config (Sunday)
30 4 * * 0 tar -czf /srv/backups/trieve/config/config-$(date +\%Y\%m\%d).tar.gz -C /srv/data/trieve .
```

### Verificacao de Backup

```bash
# Listar backups recentes
ls -la /srv/backups/trieve/qdrant/
ls -la /srv/backups/trieve/postgres/
ls -la /srv/backups/trieve/collections/

# Verificar checksum
sha256sum /srv/backups/trieve/qdrant/qdrant-backup-*.tar.gz

# Confirmar idade (max 7 dias)
find /srv/backups/trieve/ -type f -mtime -7 | sort
```

---

## 3. Procedimentos de Recovery

### 3.1 Restaurar Qdrant (collections vetoriais)

**Premissa:** Backup em `/srv/backups/trieve/qdrant/`.

```bash
# 1. Parar Trieve / Qdrant
docker stop trieve 2>/dev/null || true
docker stop qdrant 2>/dev/null || true

# 2. Identificar backup mais recente
latest=$(ls -t /srv/backups/trieve/qdrant/qdrant-backup-*.tar.gz | head -1)
echo "Restaurando: $latest"

# 3. Verificar checksum
sha256sum "$latest"

# 4. Extrair para diretorio temporario
mkdir -p /srv/backups/trieve/qdrant/restore/
tar -xzf "$latest" -C /srv/backups/trieve/qdrant/restore/

# 5. Copiar para volume de dados
cp -r /srv/backups/trieve/qdrant/restore/* /srv/data/qdrant/

# 6. Iniciar Qdrant
docker start qdrant

# 7. Aguardar startup e verificar
sleep 5
curl -s http://localhost:6333/collections | jq '.result.collections'

# 8. Iniciar Trieve
docker start trieve
```

### 3.2 Restaurar Postgres (dados relacionais)

**Premissa:** Dump em `/srv/backups/trieve/postgres/`.

```bash
# 1. Identificar dump mais recente
latest=$(ls -t /srv/backups/trieve/postgres/trieve-postgres-*.sql.gz | head -1)
echo "Restaurando: $latest"

# 2. Verificar existencia
test -f "$latest" && echo "Backup encontrado" || echo "ERRO: backup nao encontrado"

# 3. Verificar checksum
sha256sum "$latest"

# 4. Descomprimir
gunzip -k "$latest"
sql_file="${latest%.gz}"

# 5. Identificar container Postgres
PG_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
echo "Container Postgres: $PG_CONTAINER"

# 6. Restaurar (sobrescreve database)
docker exec -i "$PG_CONTAINER" psql -U trieve -d trieve < "$sql_file"

# 7. Verificar
docker exec -i "$PG_CONTAINER" psql -U trieve -d trieve -c "SELECT COUNT(*) FROM chunks;"
```

### 3.3 Restaurar Collections via Snapshot API

**Premissa:** Snapshot gerado pela API do Trieve/Qdrant.

```bash
# 1. Identificar snapshot
latest=$(ls -t /srv/backups/trieve/collections/collection-snapshot-*.tar.gz | head -1)

# 2. Verificar checksum
sha256sum "$latest"

# 3. Extrair
mkdir -p /srv/backups/trieve/collections/restore/
tar -xzf "$latest" -C /srv/backups/trieve/collections/restore/

# 4. Listar collections no snapshot
ls /srv/backups/trieve/collections/restore/

# 5. Restaurar via API do Trieve
# Substituir YOUR_INSTANCE pelo endereco correto
curl -X POST "http://localhost:6333/collections/{collection_name}/points/upload" \
  -H "Content-Type: application/json" \
  --data-binary @/srv/backups/trieve/collections/restore/points.jsonl

# 6. Verificar collections restauradas
curl -s http://localhost:6333/collections | jq '.result.collections[].name'
```

---

## 4. Procedimentos de Failover

**Cenario:** Host primario do Trieve fora do ar (hardware falha, rede, etc.).

### 4.1 Avaliacao Inicial

```bash
# 1. Confirmar indisponibilidade
curl -s --max-time 5 http://localhost:6333/ || echo "Qdrant fora"
curl -s --max-time 5 http://localhost:4000/health || echo "Trieve API fora"

# 2. Verificar se e problema de container ou host
docker ps | grep -E "qdrant|trieve|postgres"
systemctl status docker

# 3. Listar backups disponiveis
ls -lh /srv/backups/trieve/qdrant/
ls -lh /srv/backups/trieve/postgres/
```

### 4.2 Failover para Host Alternativo

**Premissa:** Host alternativo com Docker e acesso a `/srv/data/` ou discos montados.

```bash
# 1. Montar discos do host primario (se幸存)
mount /dev/sdX /srv/data
mount /dev/sdY /srv/backups

# 2. Verificar backups no host alternate
ls -lh /srv/backups/trieve/qdrant/
ls -lh /srv/backups/trieve/postgres/

# 3. Restaurar Qdrant
docker run -d --name qdrant \
  -v /srv/data/qdrant:/qdrant/storage \
  -p 6333:6333 -p 6334:6334 \
  qdrant/qdrant:latest

sleep 10
curl -s http://localhost:6333/ | jq '.result.ok'

# 4. Restaurar Postgres
docker run -d --name postgres-trieve \
  -v /srv/data/postgres-trieve:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:15-alpine

sleep 10
gunzip -c /srv/backups/trieve/postgres/trieve-postgres-latest.sql.gz | \
  docker exec -i postgres-trieve psql -U trieve -d trieve

# 5. Restaurar Trieve API
docker run -d --name trieve \
  -v /srv/data/trieve:/data \
  -p 4000:4000 \
  trieve/trieve:latest

# 6. Verificar health de todos os servicos
curl -s http://localhost:6333/ | jq '.result.ok'
curl -s http://localhost:4000/health
docker exec postgres-trieve psql -U trieve -d trieve -c "SELECT 1;"

# 7. Atualizar DNS / proxy se necessario
# apontar para novo host via Cloudflare API
```

### 4.3 Rollback para Host Primario

Quando o host primario voltar:

```bash
# 1. Garantir que nao ha divergencia de dados
# Comparar contagem de pontos entre primario e failover

# 2. Parar servicos no failover
docker stop trieve qdrant postgres-trieve

# 3. Dump dos dados do failover (se houveram writes)
docker exec postgres-trieve pg_dump -U trieve trieve > /srv/backups/trieve/postgres/pre-failover-$(date +%Y%m%d%H%M%S).sql

# 4. Restaurar no primario
# Seguir procedimentos da secao 3

# 5. Reiniciar servicos no primario
docker start qdrant
docker start postgres-trieve
docker start trieve

# 6. Verificar
curl -s http://localhost:6333/ | jq '.result.ok'
curl -s http://localhost:4000/health

# 7. Atualizar DNS para primario
# Reverter qualquer mudanca de DNS feita durante failover
```

---

## 5. Agenda de Testes

### Teste Mensal de DR

**Frequencia:** Todo dia 15 do mes (ou primeiro dia util seguinte).

**Equipe necessaria:** 1 operador.

**Duracao estimada:** 2 horas.

#### Checklist de Teste

```bash
# Fase 1 — Simular perda de dados
# 1. Criar snapshot de referencia
curl -s http://localhost:6333/collections | jq '.result.collections' > /tmp/collections-before.json
docker exec postgres-trieve psql -U trieve -d trieve -c "SELECT COUNT(*) FROM chunks;" > /tmp/chunks-before.txt

# 2. Simular falha (parar containers)
docker stop qdrant trieve postgres-trieve

# 3. Apagar dados (CUIDADO — ambiente de teste)
# rm -rf /srv/data/qdrant/*
# docker exec postgres-trieve psql -U trieve -d trieve -c "TRUNCATE chunks;"

# Fase 2 — Recovery
# 4. Executar procedimentos de recovery (secao 3)
# 5. Verificar integridade pos-restauracao
curl -s http://localhost:6333/collections | jq '.result.collections' > /tmp/collections-after.json
docker exec postgres-trieve psql -U trieve -d trieve -c "SELECT COUNT(*) FROM chunks;" > /tmp/chunks-after.txt

# 6. Comparar antes/depois
diff /tmp/collections-before.json /tmp/collections-after.json
diff /tmp/chunks-before.txt /tmp/chunks-after.txt

# 7. Testar search functionality
curl -s -X POST "http://localhost:6333/collections/default/points/search" \
  -H "Content-Type: application/json" \
  -d '{"vector":[0.1,0.2,0.3],"limit":5}' | jq '.result'
```

#### Documentacao do Teste

Apos cada teste, registrar em `/srv/monorepo/docs/OPERATIONS/TRIEVE-DR-TEST-LOG.md`:

```
Data: YYYY-MM-DD
Operador: nome
Resultado: SUCESSO / FALHA PARCIAL / FALHA TOTAL
Tempo de recovery: X minutos
Divergencias encontradas: (sim/nao + detalhes)
Acoes corretivas: (se aplicavel)
```

#### Falhas Comuns e Mitigacoes

| Falha | Mitigacao |
|-------|-----------|
| Backup corrompido | Verificar checksum antes de restaurar; manter 2备份 simultaneos |
| Tempo de restore > 1h | Pre-allocar recursos no host alternate; otimizar tamanho dos backups |
| Collections com dados faltantes | Usar snapshot API alem de backup de arquivos; verificar pos-restauracao |
| Postgres com schema desatualizado | Validar dump contra versao atual do schema antes de restore |

---

## 6. Assets Criticos — Referencia Rapida

| Asset | Path | Backup | RTO | RPO |
|-------|------|--------|-----|-----|
| Qdrant storage | `/srv/data/qdrant/` | `/srv/backups/trieve/qdrant/` | 20 min | 24h |
| Postgres (chunks, tags, sessions) | volume Docker | `/srv/backups/trieve/postgres/` | 30 min | 24h |
| Collection snapshots | `/srv/backups/trieve/collections/` | N/A (e backup) | 15 min | 24h |
| Config / env | `/srv/data/trieve/` | `/srv/backups/trieve/config/` | 10 min | 1 sem |
| Trieve API binary | Docker image | N/A (re-download) | 5 min | N/A |

### Contatos de Emergencia

| Servico | Contato |
|---------|---------|
| Cloudflare (DNS) | `CF_GLOBAL_KEY` em `.env` — usar para mudancas de DNS |
| Trieve docs | https://docs.trieve.ai/ |
| Qdrant docs | https://qdrant.tech/documentation/ |

---

## Appendix — Comandos Rapidos

```bash
# Verificar saude do Trieve
curl -s http://localhost:6333/ | jq '.result.ok'
curl -s http://localhost:4000/health

# Listar collections
curl -s http://localhost:6333/collections | jq '.result.collections[].name'

# Contagem de chunks no Postgres
docker exec $(docker ps --filter "name=postgres" --format "{{.Names}}") \
  psql -U trieve -d trieve -c "SELECT COUNT(*) FROM chunks;"

# Forcar backup manual
bash /srv/ops/scripts/backup-trieve-qdrant.sh
bash /srv/ops/scripts/backup-trieve-postgres.sh

# Verificar logs de backup
tail -20 /srv/ops/logs/backup-trieve-qdrant.log
tail -20 /srv/ops/logs/backup-trieve-postgres.log
```