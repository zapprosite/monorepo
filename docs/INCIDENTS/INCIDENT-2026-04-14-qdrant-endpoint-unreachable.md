# INCIDENT-2026-04-14: Qdrant Endpoint Unreachable via localhost:6333

**Date:** 2026-04-14
**Severity:** 🟡 Medium
**Status:** IDENTIFIED (not resolved)
**Duration:** Ongoing
**Author:** 12-agent investigation team + Claude Code

---

## Resumo

Qdrant está a funcionar corretamente, mas o health check `http://localhost:6333/healthz` falha porque:
1. O container Docker Qdrant **não expõe portas ao host** (sem port binding)
2. O `.env` tem a **API key errada**
3. Existe um processo Qdrant nativo (PID 12200) a competir pelos ports

---

## Timeline

| Hora | Evento |
|------|--------|
| 04:45 | SRE Monitor reporting qdrant endpoint as DOWN (HTTP 000) |
| 04:45-05:00 | 12-agent investigation launched |
| ~05:00 | Root cause identified: container port not mapped, wrong API key |

---

## Root Cause

**3 problemas combinados:**

### 1. Container Sem Port Binding
O container `qdrant-c95x9bgnhpedt0zp7dfsims7` foi deployed pela Coolify **sem expor portas ao host**:
```yaml
# Container config mostra:
"PortBindings": {}  # VAZIO — portas não mapeadas
"ExposedPorts": {"6333/tcp": {}, "6334/tcp": {}}
```
O Qdrant está a ouvir dentro da network Docker, não no host.

**Redes do container:**
- `c95x9bgnhpedt0zp7dfsims7` → IP 10.0.4.3
- `qgtzrmi6771lt8l7x8rqx72f` → IP 10.0.19.2 (sem alias DNS curto)

### 2. API Key Errada no .env
```
.env: QDRANT_API_KEY = 71cae77676e2a5fd552d172caa1c3200  ← ERRADO
Container: QDRANT__SERVICE__API_KEY = [REDACTED-QDRANT-API-KEY]  ← CORRETO
```

### 3. Processo Nativo Competindo
Há um processo Qdrant nativo (PID 12200) a correr diretamente nos ports 6333/6334 do host. Existe **port conflict potencial** entre o nativo e o container.

---

## Investigação — Access Points

### Qdrant Container (Docker/Coolify)
| Atributo | Valor |
|----------|-------|
| Container | `qdrant-c95x9bgnhpedt0zp7dfsims7` |
| Version | 1.17.1 |
| Status | ✅ Running (healthy, 3 days) |
| REST API | 10.0.4.3:6333 (network `c95x9bgnhpedt0zp7dfsims7`) |
| REST API | 10.0.19.2:6333 (network `qgtzrmi6771lt8l7x8rqx72f`) |
| gRPC | 6334 (interno) |
| API Key | `[REDACTED-QDRANT-API-KEY]` |
| Health | `/healthz` é público (não requer auth) |

### Qdrant Nativo (Host)
| Atributo | Valor |
|----------|-------|
| PID | 12200 |
| Portas | 0.0.0.0:6333, 0.0.0.0:6334 |
| Status | ✅ Running |
| Started | 2026-04-10 |

---

## Collections Presentes

Com API key correta (`[REDACTED-QDRANT-API-KEY]`):
- `knowledge`
- `campaigns`
- `clients`
- `hvac_service_manuals`
- `brand-guides`

---

## Impacto

| Componente | Impacto |
|-----------|---------|
| SRE Monitor | Health check fails (HTTP 000) |
| Prometheus | Não está a fazer scrape de Qdrant (nem estava planeado) |
| mcp-qdrant (4011) | ✅ Funcional — conecta internamente |
| list-web | Soft break — URL `10.0.19.7:6333` não funciona |

---

## Soluções Possíveis

### Opção A: Mapear Portas no Container (Recomendado)
Recriar o container com port binding:
```bash
docker stop qdrant-c95x9bgnhpedt0zp7dfsims7
# Editar docker-compose ou Coolify config para adicionar:
# ports:
#   - "6333:6333"
#   - "6334:6334"
docker start qdrant-c95x9bgnhpedt0zp7dfsims7
```

### Opção B: Usar IP Interno no Health Check
Mudar o SRE Monitor para fazer health check via IP interno:
```bash
curl -s http://10.0.19.2:6333/healthz
```
**Problema:** Não funciona do host se o container não estiver no mesmo network.

### Opção C: Adicionar Qdrant à Network monitoring
Conectar Qdrant à network `monitoring_monitoring`:
```bash
docker network connect monitoring_monitoring qdrant-c95x9bgnhpedt0zp7dfsims7
```

---

## Ações Imediatas

- [ ] Corrigir `QDRANT_API_KEY` no `.env` para `[REDACTED-QDRANT-API-KEY]`
- [ ] Decidir: manter processo nativo OU container Docker (evitar conflito)
- [ ] Mapear portas do container OU usar health check interno
- [ ] Atualizar PORTS.md com IPs e networks corretos
- [ ] Atualizar sre-monitor.sh para health check correto

---

## Ficheiros a Modificar

| Ficheiro | Modificação |
|----------|-------------|
| `/srv/monorepo/.env` | `QDRANT_API_KEY=[REDACTED-QDRANT-API-KEY]` |
| `/srv/monorepo/.claude/skills/coolify-sre/scripts/sre-monitor.sh` | Mudar health check para IP interno |
| `/srv/ops/ai-governance/PORTS.md` | Documentar IPs e networks |
| `/srv/monorepo/docs/INFRASTRUCTURE/NETWORK_MAP.md` | Atualizar Qdrant network info |

---

## Referências

- Investigação: 12 agentes parallel
- Container: `qdrant-c95x9bgnhpedt0zp7dfsims7`
- Docker network: `qgtzrmi6771lt8l7x8rqx72f`, `c95x9bgnhpedt0zp7dfsims7`

---

**Actualizado:** 2026-04-14 05:00
