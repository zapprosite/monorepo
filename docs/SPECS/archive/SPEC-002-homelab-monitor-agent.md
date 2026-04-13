---
archived: true
superseded_by: SPEC-023 (unified monitoring and self-healing)
see_also:
  - SPEC-023
  - SPEC-023-unified-monitoring-self-healing.md
  - SPEC-023-unified-healing-cli.md
---

> ⚠️ ARCHIVED — This spec is historical. See [SPEC-023](./SPEC-023.md) for the current implementation.

# Spec: HomeLab Monitor Agent

## Objective

Agente de monitorização para o homelab will-zappro — agrega estado de Docker, Ollama, Coolify, LiteLLM, ZFS e detecta anomalias. Executa em loop contínuo via cron, indexa estado no Qdrant (`rag_governance`), e alerta via Telegram quando detecta drift.

**User:** Principal Engineer — monitorização proactiva, não reactiva.

---

## Tech Stack

- **Runtime:** Python 3.12 + `asyncio`
- **Ollama:** `http://localhost:11434` (local)
- **LiteLLM proxy:** `http://localhost:4000` (já instalado)
- **Docker:** socket `/var/run/docker.sock`
- **Coolify:** API em `http://localhost:3000` (ou cooler DNS)
- **Qdrant:** `http://localhost:6333` — estado indexado
- **Telegram:** Bot alerts via `TELEGRAM_BOT_TOKEN` (vault)
- **Vault:** Infisical — todas as credenciais

---

## Rate Limits & Performance — Findings

### Ollama
- **GPU memory:** alocação estática por modelo — carregar + descarregar custa ~1-3s
- **Quantization:** Q4_K_M é standard — 7B ≈ 4.5GB, 13B ≈ 8GB
- **Parallelism:** controlada por `OLLAMA_NUM_PARALLEL` (default 1)
- **Keep alive:** `OLLAMA_KEEP_ALIVE` env var (default 5min) — controlar para evitar OOM
- **Strategy:** manter 1-2 modelos carregados, evitar thrashing

### LiteLLM
- **Auth:** Bearer token required — `sk-test` funciona para health/model read-only checks
- **Endpoints:** `/health` (Bearer auth), `/model/list` (Bearer auth)
- **TPM + RPM:** rate limits combined (TPM é o mais crítico para burst)
- **Sub-ms overhead:** LiteLLM target <1ms proxy overhead
- **Priority quota:** `priority_reservation` disponível desde v1.77.3
- **Budget per key:** `model_max_budget` configurável por virtual key
- **Strategy:** TPM 200-400 para modelos pequeños, monitorizar burst

### Docker
- **healthcheck:** cada container tem `HEALTHCHECK` no compose — não é automático
- **docker stats:** streaming, pode ser pesado — usar `--format` para filtrar
- **Coolify managed:** containers têm labels `coolify.managed=true`
- **Autoheal:** `willfarrell/docker-autoheal` (benchmark 90.9) — sidecar que auto-restarta containers unhealthy
- **Strategy:** polling a cada 60s, não streaming + Docker Autoheal como add-on para auto-recovery

### Coolify
- **Managed containers:** accessíveis via API ou `docker ps` com labels
- **Health:** `coolify.serviceId`, `coolify.type`, `coolify.name`
- **Strategy:** ler labels + docker stats, não invocar API Coolify directamente

---

## Commands

```bash
# Run once (cron)
python3 agent.py --once

# Run continuous (dev)
python3 agent.py --loop --interval=60

# Test scan
python3 agent.py --scan docker
python3 agent.py --scan ollama
python3 agent.py --scan litellm
python3 agent.py --scan zfs
python3 agent.py --scan all

# Health check
python3 agent.py --health
```

---

## Project Structure

```
/srv/ops/homelab-monitor/
├── agent.py              # Entry point, CLI, loop
├── scanners/
│   ├── __init__.py
│   ├── docker.py         # docker ps, stats, healthchecks
│   ├── ollama.py         # Ollama API, model stats, memory
│   ├── litellm.py        # LiteLLM /health, /key/list, /model/list
│   ├── coolify.py        # Coolify containers via docker labels
│   └── zfs.py            # zpool status, snapshot count
├── alerts/
│   ├── __init__.py
│   └── telegram.py       # Telegram bot alerts
├── qdrant.py             # Index state snapshots to Qdrant
├── config.py             # Load from vault (Infisical SDK)
├── requirements.txt
└── tests/
    ├── test_docker.py
    ├── test_ollama.py
    └── test_litellm.py
```

---

## Code Style

- **Async everywhere** — `asyncio`, `aiohttp` para HTTP calls
- **Type hints** — Python 3.12 nativo
- **Structured logging** — `structlog`, output JSON para `/srv/ops/ai-governance/logs/`
- **Error handling** — cada scanner tem retry 3x com backoff exponencial
- **DRY** — base `Scanner` class com `async def scan() → dict`

---

## Testing Strategy

| Test | Scope | Framework |
|------|-------|-----------|
| Unit | Cada scanner isolado | `pytest` + `pytest-asyncio` |
| Integration | Against real services | `pytest --integration` |
| Smoke | Cron job quick check | `pytest --smoke` |

Mock Ollama/Docker responses para unit tests. Integration tests correm nohost.

---

## Boundaries

**Always:**
- Ler credenciais só do vault (Infisical SDK)
- Output JSON estruturado para logs
- Healthcheck antes de cada scan — skip se serviço down
- Graceful degradation — se um scanner falha, os outros continuam

**Ask first:**
- Alterar estado (restart container, kill process)
- Gerar alertas que enviam para serviços externos
- Modificar ZFS pools ou snapshots

**Never:**
- Hardcoded credentials
- `curl` sem timeout
- Escrever para caminhos fora `/srv/ops/homelab-monitor/`
- Ignorar erros silenciosamente

---

## Acceptance Criteria

1. ✅ `python3 agent.py --scan all` devolve JSON com estado de todos os serviços em <5s
2. ✅ Docker scanner detecta containers sem `healthcheck` configurado
3. ✅ Ollama scanner detecta modelos sem GPU carregados vs loaded
4. ✅ LiteLLM scanner lê `/health` e `/model/list` sem crash
5. ✅ ZFS scanner detecta `zpool health` em estado `DEGRADED`
6. ✅ Alertas Telegram chegam ao bot quando scanner detecta anomalia
7. ✅ Estado indexado no Qdrant `rag_governance` com metadata completo
8. ✅ Cron job corre a cada 60s sem memory leaks
9. ✅ Zero hardcoded secrets — tudo lido do vault

---

## Open Questions

1. ~~Telegram group ou DM?~~ → **DM**
2. ~~Limiar de alerta~~ → **WARNING + CRITICAL**
3. ~~Qdrant retention~~ → **3 dias**

---

## Alert Thresholds

| Event | Severity | Action |
|-------|----------|--------|
| Container without healthcheck | WARNING | Log + Qdrant |
| Container exited/crashed | CRITICAL | Telegram DM |
| zpool DEGRADED | CRITICAL | Telegram DM |
| zpool OFFLINE | CRITICAL | Telegram DM |
| Ollama model OOM | WARNING | Log + Qdrant |
| LiteLLM /health returns non-200 | CRITICAL | Telegram DM |
| Coolify container restarted recently | WARNING | Log + Qdrant |
| ZFS snapshot age > 24h | WARNING | Log + Qdrant |

---

## Qdrant Retention

Snapshots de estado guardados em `rag_governance` com TTL de **3 dias**.

```python
# On index: set payload with created_at
# On scan: delete points where created_at < now() - timedelta(days=3)
```
