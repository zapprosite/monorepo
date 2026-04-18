# SPEC-071 — Enterprise Monorepo & Homelab Datacenter Architecture

**Data:** 2026-04-18
**Versão:** 2.0 (COMPLETED)
**Status:** COMPLETED ✅ (mergeado main, tag v202604180957)
**Branch:** `feature/iron-engine-1776514537` → `9027dd43e` → mergeado
**Especialista:** Brainstormer (Hermes counsel)
**SPEC Base:** SPEC-070 (ORCHESTRATOR-ENTERPRISE-18april2026.md)

---

## 1. VISION & OVERVIEW

### 1.1 Objetivo

Criar uma arquitectura enterprise sólida para o monorepo/homelab com **todas as versões pinned**, eliminando drift de dependências, e adicionando observabilidade, rollback, capacity planning e cost control ao sistema de 14 agentes.

### 1.2 Problema (Why)

O sistema actual (SPEC-070) tem lacunas críticas:
- **VERSION LOCK** fragmentado em múltiplos docs
- **ORCHESTRATOR** sem circuit breaker, reentrancy protection, ou métricas
- **OBSERVABILITY** zero para o próprio orchestrator
- **ROLLBACK** inexistente (só cria issue)
- **SELF-HEALING** genérico sem runbooks concretos
- **CAPACITY PLANNING** ausente
- **DISASTER RECOVERY** vago
- **COST CONTROL** LLM zero

### 1.3 Solução (What)

Arquitectura de 7 domínios complementares ao SPEC-070:
1. **VERSION LOCK ENTERPRISE** — Ficheiro único + drift detection
2. **ORCHESTRATOR v2** — Critical Path Engine com circuit breaker
3. **OBSERVABILITY LAYER** — Prometheus metrics + Grafana dashboard
4. **ROLLBACK ENGINE** — State snapshots + rollback commands
5. **CAPACITY PLANNER** — Resource calculator + auto-throttle
6. **COST ENGINE** — Budget por pipeline + model fallback
7. **SELF-HEALING RUNBOOKS** — Runbook registry com P1-P4

---

## 2. TECH STACK (Pinned Versions)

### 2.1 Core Stack

| Componente | Tool | Versão Pinned | Lock Mechanism | Justification |
|-----------|------|---------------|---------------|---------------|
| Monorepo | pnpm | **9.0.0** | `packageManager` field | Locked by monorepo template |
| Build | Turbo | **2.9.6** | `packageManager` field | SPEC-025 locked |
| Runtime | Node.js | **22.x LTS** | `.nvmrc` | Latest LTS stable |
| Backend | Fastify | **5.x** | `package.json` | SPEC locked |
| ORM | Drizzle | **0.38.x** | `package.json` | Locked |
| Frontend | React | **19.x** | `package.json` | SPEC locked |
| UI | MUI | **6.x** | `package.json` | SPEC locked |
| Validation | Zod | **3.x** | `package.json` | Shared schema |
| Lint | Biome | **1.9.x** | `package.json` | SPEC locked |
| Test | Vitest | **3.x** | `package.json` | SPEC locked |
| Types | TypeScript | **5.7.x** | `package.json` | Latest stable |

### 2.2 Infrastructure Stack

| Componente | Tool | Versão Pinned | Lock Mechanism | Justification |
|-----------|------|---------------|---------------|---------------|
| Container | Docker | **27.x** | Coolify managed | Pinned in Coolify |
| Infra | Coolify | **latest** | Helm/Deploy | Pinned by install |
| Firewall | UFW | **latest** | System package | Immutable |
| Proxy | Traefik | **3.x** | Coolify managed | Immutable |
| CI | Gitea Actions | **latest** | Container tag | Latest stable |

### 2.3 Data & AI Stack

| Componente | Tool | Versão Pinned | Lock Mechanism | Justification |
|-----------|------|---------------|---------------|---------------|
| Vector DB | Qdrant | **1.7.x** | Docker tag | SPEC locked |
| LLM Proxy | LiteLLM | **1.54.x** | Docker tag | SPEC locked |
| STT | faster-whisper | **1.0.x** | Docker tag | SPEC locked |
| TTS | Kokoro | **latest** | Immutable | No version |
| Embedding | bge-m3 | **latest** | Docker tag | Immutable |
| Cache | Redis | **7.x** | Docker tag | Latest stable |
| Database | PostgreSQL | **16.x** | Docker tag | LTS stable |

### 2.4 Monitoring Stack

| Componente | Tool | Versão Pinned | Lock Mechanism | Justification |
|-----------|------|---------------|---------------|---------------|
| Monitoring | Prometheus | **2.54.x** | Docker tag | Stable |
| Alerting | AlertManager | **0.27.x** | Docker tag | Stable |
| Visualisation | Grafana | **11.x** | Docker tag | Stable |
| Logs | Loki | **3.x** | Docker tag | Stable |
| Exporters | node_exporter | **1.8.x** | Docker tag | Stable |

### 2.5 Agent Stack

| Componente | Tool | Versão Pinned | Lock Mechanism | Justification |
|-----------|------|---------------|---------------|---------------|
| Orchestrator | Claude Code | **latest** | CLI install | Pinned by install |
| Hermes Agent | hermes-agent | **latest** | Docker tag | SPEC locked |
| Voice Pipeline | whisper + Kokoro | **latest** | Immutable | SPEC locked |

---

## 3. ARCHITECTURE — 7 DOMAINS

### 3.1 Domain 1: VERSION LOCK ENTERPRISE

#### Estrutura do Ficheiro

```
VERSION-LOCK.md  # ÚNICA FONTE DE VERDADE para todas as versões
```

**Conteúdo:**

```markdown
# VERSION-LOCK.md — Enterprise Version Pinning
# Generated: 2026-04-18
# SPEC: SPEC-071

## Core Runtime
node: 22.x LTS       # .nvmrc: node_version=22
pnpm: 9.0.0          # packageManager: "pnpm@9.0.0"
turbo: 2.9.6         # packageManager: "turbo@2.9.6"

## Application
typescript: 5.7.x
fastify: 5.x
react: 19.x
@mui/material: 6.x
drizzle-orm: 0.38.x
zod: 3.x
biome: 1.9.x
vitest: 3.x

## Infrastructure
docker: 27.x
postgres: 16.x
redis: 7.x

## AI/ML
qdrant: 1.7.x
litellm: 1.54.x
faster-whisper: 1.0.x

## Monitoring
prometheus: 2.54.x
alertmanager: 0.27.x
grafana: 11.x
loki: 3.x
node_exporter: 1.8.x

## Checksum Verification (SHA256)
node_22_LTS.tar.gz: a3f5c8d9e...
pnpm_9.0.0.sh: b7c2d8f3a1...
turbo_2.9.6.tgz: c9e4f7b2d8...
```

#### Comandos

| Comando | Descrição | Ficheiro |
|---------|-----------|----------|
| `/versions` | Lista todas as versões pinned | — |
| `/versions-check` | Verifica drift vs actual | `scripts/versions-check.sh` |
| `/versions-update` | Propõe update de versões | `scripts/versions-update.sh` |

#### CI Integration

```yaml
# .gitea/workflows/versions-check.yml
- name: Version Drift Check
  run: |
    bash scripts/versions-check.sh
    # Fail if drift detected
```

#### Filedeltas

| Ficheiro | Acção | Descrição |
|----------|--------|-----------|
| `VERSION-LOCK.md` | CREATE | Única fonte de verdade para pins |
| `scripts/versions-check.sh` | CREATE | Verifica drift de versões |
| `scripts/versions-update.sh` | CREATE | Proposta de update de versões |
| `docs/SPECS/SPEC-071-enterprise-monorepo-datacenter-architecture.md` | CREATE | Esta spec |
| `docs/INFRASTRUCTURE/VERSION-LOCK.md` | CREATE | Link para VERSION-LOCK.md |

---

### 3.2 Domain 2: ORCHESTRATOR v2 — Critical Path Engine

#### Arquitetura

```
orchestrator/
├── run_agents.sh              # Spawn 14 agentes
├── agent_wrapper.sh          # Wrapper individual
├── wait_for_completion.sh    # Poll states
├── circuit_breaker.sh        # Retry com exp backoff
├── reentrancy_lock.sh        # PID lock por pipeline
├── dead_letter.sh            # Dead letter queue
└── metrics_collector.sh      # Observability
```

#### Circuit Breaker Pattern

```bash
# MAX_RETRIES=3, BACKOFF=2 (exponential)
retry_with_backoff() {
  local agent=$1
  local max_retries=3
  local backoff=2
  local attempt=0

  while [ $attempt -lt $max_retries ]; do
    if run_agent $agent; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep $((backoff ** attempt))
  done
  return 1
}
```

#### Reentrancy Lock

```bash
# Bloquear execução duplicada do mesmo agente na mesma pipeline
LOCKFILE="/tmp/orchestrator/${PIPELINE_ID}/${AGENT}.lock"
if [ -f "$LOCKFILE" ]; then
  OLD_PID=$(cat "$LOCKFILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "ERROR: Agent $AGENT already running (PID $OLD_PID)"
    exit 1
  fi
fi
echo $$ > "$LOCKFILE"
```

#### Dead Letter Queue

```bash
# Ficheiro: tasks/dead_letter/{PIPELINE_ID}/{AGENT}.dlq
{
  "pipeline_id": "pipeline-20260418-001",
  "agent": "CODER-1",
  "attempts": 3,
  "last_error": "timeout after 300s",
  "timestamp": "2026-04-18T10:15:00Z",
  "next_retry": null
}
```

#### Filedeltas

| Ficheiro | Acção | Descrição |
|----------|--------|-----------|
| `orchestrator/scripts/circuit_breaker.sh` | CREATE | Retry com exp backoff |
| `orchestrator/scripts/reentrancy_lock.sh` | CREATE | PID lock |
| `orchestrator/scripts/dead_letter.sh` | CREATE | DLQ handler |
| `orchestrator/scripts/metrics_collector.sh` | CREATE | Prometheus metrics |
| `orchestrator/run_agents.sh` | MODIFY | Integrar circuit breaker |
| `tasks/dead_letter/` | CREATE | Dir para DLQ |

---

### 3.3 Domain 3: OBSERVABILITY LAYER

#### Prometheus Metrics

```bash
# orchestrator_metrics.sh
#!/bin/bash

# Pipeline metrics
prometheus gauge orchestrator_pipeline_active{pipeline="$PIPELINE_ID"} 1
prometheus counter orchestrator_pipeline_total{pipeline="$PIPELINE_ID",status="$STATUS"} 1
prometheus histogram orchestrator_pipeline_duration_seconds{pipeline="$PIPELINE_ID"} $DURATION

# Agent metrics
prometheus counter orchestrator_agent_errors_total{agent="$AGENT",error_type="$ERROR"} 1
prometheus gauge orchestrator_agent_duration_seconds{agent="$AGENT"} $DURATION

# LLM Cost metrics
prometheus counter orchestrator_llm_tokens_total{model="$MODEL",agent="$AGENT"} $TOKENS
prometheus counter orchestrator_llm_cost_usd{model="$MODEL"} $COST
```

#### Grafana Dashboard

**Dashboard ID:** `1720` (Orchestrator Overview)

**Panels:**
1. Pipeline Success Rate (%)
2. Agent Execution Time (s)
3. LLM Cost per Pipeline ($)
4. Active Pipelines
5. Error Rate by Agent
6. Token Usage by Model

#### Trace ID

```bash
TRACE_ID=$(uuidgen)
export TRACE_ID
# Passado a cada agente como env var
claude --agent CODER-1 --trace-id $TRACE_ID
```

#### Filedeltas

| Ficheiro | Acção | Descrição |
|----------|--------|-----------|
| `orchestrator/scripts/metrics_collector.sh` | CREATE | Prometheus exporter |
| `orchestrator/scripts/trace_id.sh` | CREATE | UUID generation |
| `docs/OPS/GRAFANA-DASHBOARDS/orchestrator-overview.json` | CREATE | Grafana dashboard |
| `docs/OPS/PROMETHEUS/alerts.yml` | CREATE | Alerts config |

---

### 3.4 Domain 4: ROLLBACK ENGINE

#### State Snapshot

```bash
# Snapshot antes de cada agente
SNAPSHOT_DIR="/srv/monorepo/tasks/snapshots/${PIPELINE_ID}/${AGENT}"
mkdir -p "$SNAPSHOT_DIR"
cp -r "$WORKSPACE/src" "$SNAPSHOT_DIR/src.before"
git -C "$WORKSPACE" rev-parse HEAD > "$SNAPSHOT_DIR/git.commit"
```

#### Rollback Command

```bash
# /rollback --agent=CODER-1 --to=pipeline-20260418-001
rollback_to_snapshot() {
  local agent=$1
  local pipeline_id=$2
  local snapshot="/srv/monorepo/tasks/snapshots/${pipeline_id}/${agent}/src.before"

  if [ ! -d "$snapshot" ]; then
    echo "ERROR: No snapshot found for ${agent} in ${pipeline_id}"
    return 1
  fi

  rsync -a "$snapshot/" "$WORKSPACE/src/"
  git -C "$WORKSPACE" checkout $(cat "/srv/monorepo/tasks/snapshots/${pipeline_id}/${agent}/git.commit")
}
```

#### Filedeltas

| Ficheiro | Acção | Descrição |
|----------|--------|-----------|
| `orchestrator/scripts/snapshot.sh` | CREATE | State snapshot before agent |
| `orchestrator/scripts/rollback.sh` | CREATE | Rollback command |
| `tasks/snapshots/` | CREATE | Dir para snapshots |
| `docs/OPS/RUNBOOKS/ROLLBACK.md` | CREATE | Runbook |

---

### 3.5 Domain 5: CAPACITY PLANNER

#### Resource Calculator

```bash
#!/bin/bash
# capacity_calculator.sh

RAM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
RAM_PER_AGENT_KB=4194304  # 4GB por agente
CPU_CORES=$(nproc)
MAX_AGENTS=$((RAM_TOTAL_KB / RAM_PER_AGENT_KB))
MAX_PARALLEL=$((MAX_AGENTS < CPU_CORES ? MAX_AGENTS : CPU_CORES))

echo "Total RAM: $((RAM_TOTAL_KB / 1024 / 1024)) GB"
echo "Max agents: $MAX_AGENTS (RAM bounded)"
echo "Max parallel: $MAX_PARALLEL (CPU bounded)"
```

#### Auto-Throttle

```bash
# Se >80% CPU, reduzir parallelism
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d. -f1)
if [ "$CPU_USAGE" -gt 80 ]; then
  MAX_PARALLEL=2
  echo "WARNING: CPU >80%, throttling to $MAX_PARALLEL parallel agents"
fi
```

#### Filedeltas

| Ficheiro | Acção | Descrição |
|----------|--------|-----------|
| `orchestrator/scripts/capacity_calculator.sh` | CREATE | Resource calc |
| `orchestrator/scripts/auto_throttle.sh` | CREATE | CPU throttle |
| `docs/OPS/CAPACITY.md` | CREATE | Capacity docs |

---

### 3.6 Domain 6: COST ENGINE

#### Budget Configuration

```bash
# .orchestrator/budget.yml
default_budget_per_pipeline: 0.50  # USD
max_tokens_per_agent:
  o1-preview: 100000
  o1-mini: 50000
  claude-3-haiku: 200000

model_fallback:
  - o1-preview
  - o1-mini
  - claude-3-haiku

alert_threshold: 0.80  # Alert when 80% of budget used
```

#### Cost Tracking

```bash
# track_cost.sh
COST=$(calc_cost $MODEL $INPUT_TOKENS $OUTPUT_TOKENS)
BUDGET_REMAINING=$(jq ".pipelines[$PIPELINE_ID].budget_remaining" budget.json)

if (( $(echo "$COST > $BUDGET_REMAINING" | bc -l) )); then
  # Fallback para modelo mais barato
  NEXT_MODEL=$(get_next_model $CURRENT_MODEL)
  if [ "$NEXT_MODEL" = "null" ]; then
    echo "ERROR: Budget exceeded and no fallback available"
    create_issue "Cost exceeded for $PIPELINE_ID"
  fi
fi
```

#### Filedeltas

| Ficheiro | Acção | Descrição |
|----------|--------|-----------|
| `.orchestrator/budget.yml` | CREATE | Budget config |
| `orchestrator/scripts/track_cost.sh` | CREATE | Cost tracking |
| `orchestrator/scripts/model_fallback.sh` | CREATE | Fallback logic |
| `docs/OPS/COST-CONTROL.md` | CREATE | Cost docs |

---

### 3.7 Domain 7: SELF-HEALING RUNBOOKS

#### Runbook Registry

```
docs/OPS/RUNBOOKS/
├── P1-SERVICE-DOWN.md        # P1: Service down >5min
├── P2-SERVICE-DEGRADED.md    # P2: Degraded <1h
├── P3-NON-CRITICAL.md        # P3: Non-critical
├── P4-INFORMATIONAL.md       # P4: Informational
├── ORCHESTRATOR-FAILURE.md  # Agent failure runbook
└── PIPELINE-ROLLBACK.md      # Pipeline rollback runbook
```

#### P1 Runbook (Exemplo)

```markdown
# P1: Service Down >5min

## Trigger
- Prometheus alert: `service_up == 0` for >5min
- OR: Manual detection via `/health`

## Steps

1. **Identify** (30s)
   ```bash
   curl -s http://localhost:PORT/health
   systemctl status SERVICE
   journalctl -u SERVICE -n 50
   ```

2. **Attempt Restart** (2min)
   ```bash
   systemctl restart SERVICE
   sleep 10
   curl -s http://localhost:PORT/health
   ```

3. **Escalate if Failed** (1min)
   - Page on-call
   - Create incident in Linear
   - Notify #incidents channel

4. **Root Cause** (ongoing)
   - Collect logs: `journalctl -u SERVICE --since "-10min" > /tmp/SERVICE.log`
   - Check resource usage: `docker stats`
   - Review recent changes: `git log --since "-1h"`
```

#### Filedeltas

| Ficheiro | Acção | Descrição |
|----------|--------|-----------|
| `docs/OPS/RUNBOOKS/P1-SERVICE-DOWN.md` | CREATE | P1 runbook |
| `docs/OPS/RUNBOOKS/P2-SERVICE-DEGRADED.md` | CREATE | P2 runbook |
| `docs/OPS/RUNBOOKS/P3-NON-CRITICAL.md` | CREATE | P3 runbook |
| `docs/OPS/RUNBOOKS/P4-INFORMATIONAL.md` | CREATE | P4 runbook |
| `docs/OPS/RUNBOOKS/ORCHESTRATOR-FAILURE.md` | CREATE | Orchestrator runbook |
| `docs/OPS/RUNBOOKS/PIPELINE-ROLLBACK.md` | CREATE | Rollback runbook |
| `docs/OPS/RUNBOOKS/README.md` | CREATE | Runbook index |

---

## 4. COMMANDS

| Comando | Dominio | Descrição |
|---------|---------|-----------|
| `/versions` | V1 | Lista versões pinned |
| `/versions-check` | V1 | Verifica drift |
| `/versions-update` | V1 | Propõe update |
| `/rollback --agent=X --to=PIPELINE` | V4 | Rollback agente |
| `/capacity` | V5 | Mostra recursos disponíveis |
| `/cost` | V6 | Mostra custo por pipeline |
| `/runbooks` | V7 | Lista runbooks disponíveis |
| `/execute "desc"` | ORCH | Workflow completo |

---

## 5. ACCEPTANCE CRITERIA

### V1 — VERSION LOCK ENTERPRISE
- [x] `VERSION-LOCK.md` existe com todas as versões
- [x] `scripts/versions-check.sh` detecta drift
- [x] CI verifica drift em cada PR
- [x] `/versions` lista pins

### V2 — ORCHESTRATOR v2
- [x] Circuit breaker activa retries (max 3, exp backoff)
- [x] Reentrancy lock previne duplicar agente
- [x] Dead letter queue criada após 3 falhas
- [x] Metrics expostas para Prometheus

### V3 — OBSERVABILITY LAYER
- [x] Prometheus metrics para pipeline duration
- [x] Prometheus metrics para agent errors
- [x] Prometheus metrics para LLM cost
- [x] Grafana dashboard importável
- [x] Trace ID por pipeline (UUID)

### V4 — ROLLBACK ENGINE
- [x] Snapshot criado antes de cada agente
- [x] `/rollback --agent=X --to=PIPELINE` restaura snapshot
- [x] Git revert como fallback
- [x] Runbook de rollback documentado

### V5 — CAPACITY PLANNER
- [x] `capacity_calculator.sh` mostra RAM/CPU disponíveis
- [x] Auto-throttle quando >80% CPU
- [x] Warning quando RAM <20% livre

### V6 — COST ENGINE
- [x] Budget por pipeline configurável
- [x] Model fallback automático se budget exceeded
- [x] Alert quando 80% budget usado
- [x] Cost tracking por SPEC

### V7 — SELF-HEALING RUNBOOKS
- [x] P1-P4 runbooks criados
- [x] Runbook para orchestrator failure
- [x] Runbook para pipeline rollback
- [x] Index em `docs/OPS/RUNBOOKS/README.md`

---

## 6. SUCCESS CRITERIA

| Criterio | Métrica | Target |
|----------|---------|--------|
| Zero version drift | Drifts detected in CI | 0 |
| Orchestrator reliability | Pipeline success rate | >95% |
| Cost control | Avg cost per pipeline | <$0.50 |
| Rollback success | Rollbacks that restore state | 100% |
| Capacity awareness | Resources correctly calculated | 100% |
| Self-healing | P1 incidents resolved <10min | >80% |

---

## 7. DEPENDENCIAS

```
SPEC-070 (ORCHESTRATOR-ENTERPRISE)
    │
    ├──► SPEC-071 (THIS)
    │        │
    │        ├── V1: VERSION LOCK — depends on SPEC-025 (Turbo pinning)
    │        ├── V2: ORCH v2 — depends on SPEC-070 (orchestrator scripts)
    │        ├── V3: OBSERVABILITY — depends on SPEC-023 (Prometheus stack)
    │        ├── V4: ROLLBACK — depends on V2 (state tracking)
    │        ├── V5: CAPACITY — depends on V2
    │        ├── V6: COST — depends on SPEC-048 (LLM cost)
    │        └── V7: RUNBOOKS — depends on SPEC-023 (alerting)
    │
    └──► SPEC-072 (Future: Multi-host orchestrator)
```

---

## 8. OPEN QUESTIONS

1. **Budget storage:** SQLite local ouficheiro JSON simples?
2. **Prometheus endpoint:** `/metrics` em porta fixa ou via agent-sidecar?
3. **Grafana auth:** Anonymous access ou OAuth?
4. **Multi-host:** Orquestrador em máquina separada? (SPEC-072)

---

## 9. FILES TO CREATE/MODIFY

### New Files (CREATE)
```
VERSION-LOCK.md
orchestrator/scripts/circuit_breaker.sh
orchestrator/scripts/reentrancy_lock.sh
orchestrator/scripts/dead_letter.sh
orchestrator/scripts/metrics_collector.sh
orchestrator/scripts/snapshot.sh
orchestrator/scripts/rollback.sh
orchestrator/scripts/capacity_calculator.sh
orchestrator/scripts/auto_throttle.sh
orchestrator/scripts/trace_id.sh
orchestrator/scripts/track_cost.sh
orchestrator/scripts/model_fallback.sh
.orchestrator/budget.yml
orchestrator/scripts/versions-check.sh
orchestrator/scripts/versions-update.sh
docs/OPS/GRAFANA-DASHBOARDS/orchestrator-overview.json
docs/OPS/PROMETHEUS/alerts.yml
docs/OPS/CAPACITY.md
docs/OPS/COST-CONTROL.md
docs/OPS/RUNBOOKS/P1-SERVICE-DOWN.md
docs/OPS/RUNBOOKS/P2-SERVICE-DEGRADED.md
docs/OPS/RUNBOOKS/P3-NON-CRITICAL.md
docs/OPS/RUNBOOKS/P4-INFORMATIONAL.md
docs/OPS/RUNBOOKS/ORCHESTRATOR-FAILURE.md
docs/OPS/RUNBOOKS/PIPELINE-ROLLBACK.md
docs/OPS/RUNBOOKS/README.md
tasks/dead_letter/
tasks/snapshots/
```

### Files to Modify (MODIFY)
```
orchestrator/run_agents.sh          # Integrate circuit_breaker, metrics
orchestrator/wait_for_completion.sh # Add DLQ check
AGENTS.md                           # Add SPEC-071
docs/SPECS/SPEC-INDEX.md            # Add SPEC-071
```

---

## 10. NOTES

- Esta spec não requer変更 na arquitetura de aplicação (Fastify/React)
- Foca em operational excellence do orchestrator
- Todas as thresholds (budget, CPU, RAM) são configuráveis
- Runbooks são living documents — actualizar após cada incidente
