# SPEC-POLYMER-002 — Docker Organization by Application

**Data:** 2026-04-30
**Status:** IN PROGRESS
**Owner:** William Rodrigues / Hermes
**Depends on:** SPEC-POLYMER-001 (FASE 1-2 completed)

---

## Objectivo

Organizar todos os containers Docker por aplicação, com networks dedicados, volumes com prefixo por app, e compose project names consistentes. Eliminar duplicações e órfãos.

---

## Arquitectura Final — Stacks por Aplicação

### Stack 1: TRIEVE (Search/RAG)
```
Network: monorepo_trieve-net (existing)
Volume:  trieve-postgres-data  (prefix: trieve_)
Compose Project: trieve

Services:
  - trieve           (trieve/server)
  - trieve-postgres  (postgres:15-alpine)
  - trieve-proxy     (nginx:alpine, port 6435)
  - keycloak         (keycloak:26.0, auth)
  - hermes-qdrant (shared Qdrant instance, connected to monorepo_trieve-net)
```

### Stack 2: MONITORING (Observability)
```
Network: monitoring_monitoring (existing)
Volume:  monitoring_prometheus-data, monitoring_grafana-data, monitoring_alertmanager-data
Compose Project: monitoring

Services:
  - prometheus       (prom/prometheus:latest)
  - grafana          (grafana/grafana:10.2.0)
  - alertmanager     (prom/alertmanager:latest)
  - node-exporter    (prom/node-exporter:latest, host network)
```

### Stack 3: INFRA (LLM Gateway + Cache)
```
Network: zappro-infra (existing)
Volume:  zappro-redis-data, zappro-litellm-db-data
Compose Project: infra

Services:
  - zappro-redis     (redis:7.2.4-alpine, port 6379)
  - zappro-litellm   (ghcr.io/berriai/litellm:main-stable, port 4000)
  - zappro-litellm-db (postgres:15-alpine)
```

### Stack 4: COOLIFY (Self-Hosted Deploy)
```
Network: coolify (existing)
Volume:  coolify-db, coolify-redis
Compose Project: coolify

Services:
  - coolify           (ghcr.io/coollabsio/coolify:latest, port 8000/8443)
  - coolify-db        (postgres:15-alpine)
  - coolify-redis     (redis:7-alpine)
  - coolify-realtime  (ghcr.io/coollabsio/coolify-realtime:1.0.13, port 6001-6002)
```

### Stack 5: GITEA (Git)
```
Network: gitea_default (existing)
Volume:  gitea-data (bind mount: /srv/data/gitea)
Compose Project: gitea

Services:
  - zappro-gitea      (gitea/gitea:latest, port 3300/2222)
```

### Stack 6: CRM-MVP (Customer Management)
```
Network: crm-mvp_default (existing)
Volume:  crm-mvp_pgdata, crm-mvp_redisdata
Compose Project: crm-mvp

Services:
  - crm-api           (crm-mvp-api, port 4088)
  - crm-web           (crm-mvp-web)
  - crm-postgres      (postgres:16-alpine)
  - crm-redis         (redis:7-alpine)
```

### Stack 7: HERMES (Voice/TTS)
```
Network: zappro-tts (existing)
Volume:  zappro-tts-data (bind mount: /srv/data/tts)
Compose Project: hermes

Services:
  - zappro-edge-tts   (edge-tts-edge-tts, port 8012)
```

### Standalone Services (não-Docker ou legados)
```
- searxng:    Native process (host network, ports 8080/4444)
- openwebui-hvac: Docker container (host network, port 3000)
```

---

## Issues Resolvidos

### Issue 1: Trieve Workers Órfãos (RESOLVED 2026-04-30)
- **Problema:** bold_northcutt e elated_mendeleev estavam como "Created" (não iniciados), duplicados do kind_easley e competent_heyrovsky
- **Fix:** Containers removidos. Workers reais são kind_easley e competent_heyrovsky (trieve/search em bridge)
- **Residual:** Todos os 4 workers estão agora em bridge + monorepo_trieve-net (conectados para poder pingar trieve API se precisarem)

### Issue 2: Network Duplication (RESOLVED 2026-04-30)
- **Problema:** trieve-net e monorepo_trieve-net eram a mesma coisa com nomes diferentes
- **Fix:** Padronizado em monorepo_trieve-net em todos os lugares

### Issue 3: Qdrant Duplication (RESOLVED 2026-04-30)
- **Problema:** trieve-qdrant (empty) + hermes-second-brain-qdrant-1 (12 collections)
- **Fix:** hermes-second-brain-qdrant-1 conectado à monorepo_trieve-net via `docker network connect --alias qdrant`. trieve-qdrant removido.

### Issue 4: Prometheus Docker Target DOWN (RESOLVED 2026-04-30)
- **Problema:** Docker daemon metrics em 127.0.0.1:9323 não alcançável pelo Prometheus
- **Fix:** /etc/docker/daemon.json → metrics-addr: 0.0.0.0:9323

### Issue 5: Trieve h2 Protocol Error (NON-BLOCKING)
- **Problema:** qdrant-client 1.12.1 (Trieve) vs qdrant-server 1.17.1 — HTTP/2 incompatibility
- **Impacto:** Trieve não consegue criar collections automaticamente (erro no startup)
- **Workaround:** Collections já existem (12 em hermes-second-brain-qdrant-1). Trieve API continua funcionando.
- **Status:** Deferido — não bloqueia operação

---

## Ações Executadas

| Data | Acção | Estado |
|---|---|---|
| 2026-04-30 | ZFS snapshot pre-polymer | ✅ tank@pre-polymer-20260430-192000 |
| 2026-04-30 | Qdrant consolidation (trieve-qdrant removed) | ✅ |
| 2026-04-30 | Workers bridge → monorepo_trieve-net | ✅ |
| 2026-04-30 | Docker metrics fix (0.0.0.0:9323) | ✅ |
| 2026-04-30 | Orphans removed (bold_northcutt, elated_mendeleev) | ✅ |

---

## Ações Pendentes

### PENDING: Compose Project Names
Adicionar `COMPOSE_PROJECT_NAME` a cada compose file para garantir prefixação consistente:
- `docker-compose.trieve.yml` → COMPOSE_PROJECT_NAME=trieve
- `docker-compose.monitoring.yml` → COMPOSE_PROJECT_NAME=monitoring (se existir)
- `docker-compose.litellm.yml` → COMPOSE_PROJECT_NAME=infra
- `docker-compose.coolify.yml` → COMPOSE_PROJECT_NAME=coolify
- `docker-compose.gitea.yml` → COMPOSE_PROJECT_NAME=gitea
- `docker-compose.crm-mvp.yml` → COMPOSE_PROJECT_NAME=crm-mvp

### PENDING: Orphan Volumes Cleanup
Volumes órfãos para remover após confirmação:
- `3d1532b9116af49d1a54d5cf04bbee49553e6c3c3dcf408aeb27e53c31743190` (searxng etc)
- `f3311abb0bcaa7b2cac9a9039cb6d87e96a6fc30934ef257d9e9f7367a4add80` (searxng cache)
- `monorepo_monorepo_openwebui-data` (duplicate)
- `monorepo_openwebui-data` (duplicate)
- `monorepo_trieve-ollama-data` (ollama do trieve, não usado)
- `monorepo_trieve-postgres-data` (renamed to trieve_postgres_data)
- `monorepo_trieve-qdrant-data` (removed with trieve-qdrant)
- `pgadmin_pgadmin-data` (zappro-pgadmin standalone)
- `zappro-lite_litellm-db-data` (duplicate name, actual is zappro-litellm-db)

### PENDING: Orphan Network Cleanup
- `monorepo_default` (unused)
- `hermes-second-brain_default` (only qdrant container uses it)

### PENDING: Native Services Documentation
- searxng: native process, port 8080 — need to containerize or document
- openwebui-hvac: Docker on host network — needs proper compose

---

## Rollback

```bash
sudo zfs rollback -r tank@pre-polymer-20260430-192000
```

---

## Notas Técnicas

### Docker Network DNS
- `--alias` flag é necessário em `docker network connect` para adicionar DNS name
- Sem `--alias`, container só recebe IP, sem hostname

### Network Modes
- `host`: bypass Docker network — usa rede do host diretamente
- `bridge`: rede Docker default (172.17.0.0/16)
- custom bridge: rede definida por compose/network

### Qdrant API Key (hermes-second-brain)
```
e64203b5e25d941f39ece20df63e37b1f05a036615fd6168f2115c3194884da1
```
