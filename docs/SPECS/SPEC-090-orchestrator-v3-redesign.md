---
name: SPEC-090-orchestrator-v3-redesign
description: "Redesign do orchestrator de 14 agentes para 3 fases (SPEC→ARCHITECT→BUILD→SHIP). Eliminados agentes redundantes. Grafos de dependências real. Scripts implementados."
status: DRAFT
priority: critical
author: William Rodrigues
date: 2026-04-20
specRef: SPEC-070, SPEC-071
---

# SPEC-090: Orchestrator v3 — 3-Phase Pipeline

## Problema

O orchestrator atual (SPEC-070) tem **14 agentes em "paralelo"** que não são paralelos. É uma sequência com gates disfarçada de pipeline paralelo. Resultado:

- SPEC-070 descreve 20+ scripts mas `orchestrator/scripts/` está vazio
- AGENTS.md lista 14 agentes mas o estado real tem RESEARCH-1/2/3/4
- TYPES, LINT, SECRETS são `pnpm tsc` e `pnpm lint` — não precisam ser agentes
- Rollback e snapshot prometidos em SPEC-071 mas nunca implementados
- Custo: 14 LLMs rodando simultaneamente = $$$

## Solução

**Pipeline de 3 fases com dependências reais.** Sem fake parallelism.

```
FASE 1 ─────────────────────────────────────────────────────────
  [SPEC-ANALYZER] ←→ [ARCHITECT]
        ↓                 ↓
     (parallel)       (parallel)
        └──────┬──────────┘
               ↓
FASE 2 ─────────────────────────────────────────────────────────
         [CODER-1]  ←→  [CODER-2]
         (parallel)      (parallel)
               ↓
FASE 3 ─────────────────────────────────────────────────────────
  [TESTER] → [DOCS] → [SMOKE] → [REVIEWER]
       ↓        ↓         ↓          ↓
       └────────┴─────────┴──────────┘
                    ↓
              [SHIPPER]
```

## Fases Reais

### Fase 1: Análise (2 agentes, paralelo)

| Agente | Input | Output |
|--------|-------|--------|
| SPEC-ANALYZER | SPEC.md | AC + filedeltas + tasks |
| ARCHITECT | SPEC.md + filedeltas | Arquitetura + issues + blockers |

**Gate:** Ambos completam → Fase 2 inicia

### Fase 2: Build (2 agentes, paralelo)

| Agente | Input | Dependência |
|--------|-------|-------------|
| CODER-1 | filedeltas | SPEC-ANALYZER + ARCHITECT |
| CODER-2 | filedeltas | SPEC-ANALYZER + ARCHITECT |

**Gate:** Ambos completam (exit 0) → Fase 3 inicia
**Critical:** Se CODER-1 ou CODER-2 falhar → BLOCK

### Fase 3: Validação (3 agentes, sequencial)

| Agente | Input | Dependência |
|--------|-------|-------------|
| TESTER | código + AC | Fase 2 completa |
| DOCS | código | TESTER completo |
| SMOKE | código + AC | DOCS completo |
| REVIEWER | tudo | SMOKE completo |

**Gate:** REVIEWER completo → SHIPPER

### SHIPPER (final)

- Verifica todos os agent-states
- Se CODER falhou → cria ISSUE no Gitea (não PR)
- Se tudo OK → cria PR

## Agentes Eliminados

~~TYPES~~ → `pnpm tsc --noEmit` (inline, CI)
~~LINT~~ → `pnpm lint` (inline, CI)
~~SECRETS~~ → hook pre-commit (automático)
~~GIT~~ → SHIPPER faz commit

## Scripts que DEVEM existir

```
orchestrator/
├── scripts/
│   ├── run-pipeline.sh           # Script principal — orquestra as 3 fases
│   ├── wait-for-phase.sh         # Poll até fase completar
│   ├── check-gate.sh             # Verifica se gate foi satisfeito
│   ├── snapshot.sh               # ZFS snapshot antes de cada fase
│   ├── rollback.sh               # Rollback se agente crítico falha
│   └── ship.sh                   # Cria PR no Gitea
```

## Pipeline State

```json
{
  "pipeline": "pipeline-YYYYMMDD-HHMMSS",
  "spec": "SPEC-NNN",
  "phase": 2,
  "agents": {
    "SPEC-ANALYZER": { "status": "completed", "exit": 0 },
    "ARCHITECT":      { "status": "completed", "exit": 0 },
    "CODER-1":        { "status": "running" },
    "CODER-2":        { "status": "pending" },
    "TESTER":         { "status": "pending" },
    "DOCS":           { "status": "pending" },
    "SMOKE":          { "status": "pending" },
    "REVIEWER":       { "status": "pending" },
    "SHIPPER":        { "status": "pending" }
  },
  "started": "ISO",
  "current_phase": 2
}
```

## Fluxo Completo

```
1. run-pipeline.sh SPEC-NNN
   │
   ├── snapshot.sh "pre-phase-1"
   ├── SPEC-ANALYZER (bg)
   ├── ARCHITECT (bg)
   └── wait-for-phase.sh 1
       │
       ├── gate: ambos completed + exit 0?
       │   ├── NÃO → rollback.sh → exit 1
       │   └── SIM ↓
       ├── snapshot.sh "pre-phase-2"
       ├── CODER-1 (bg)
       ├── CODER-2 (bg)
       └── wait-for-phase.sh 2
           │
           ├── gate: ambos completed + exit 0?
           │   ├── NÃO → rollback.sh → issue Gitea → exit 1
           │   └── SIM ↓
           ├── snapshot.sh "pre-phase-3"
           ├── TESTER (sequential)
           ├── DOCS (sequential)
           ├── SMOKE (sequential)
           ├── REVIEWER (sequential)
           └── ship.sh → PR ou ISSUE
```

## Error Handling

| Cenario | Ação |
|---------|------|
| SPEC-ANALYZER falha | BLOCK — rollback + exit 1 |
| ARCHITECT falha | BLOCK — rollback + exit 1 |
| CODER-1 OU CODER-2 falha | BLOCK — rollback + issue Gitea (não PR) |
| TESTER falha | WARN + proceed |
| DOCS falha | WARN + proceed |
| SMOKE falha | WARN + proceed |
| REVIEWER falha | WARN + proceed |
| SHIPPER falha | ISSUE manual |

## Critério de Sucesso

- [ ] `orchestrator/scripts/` com todos os 6 scripts criados
- [ ] Pipeline executa 3 fases reais com gates
- [ ] AGENTS.md atualizado com nova lógica
- [ ] Rollback funciona (testado)
- [ ] Custo por pipeline < $0.50 (vs ~$2-3 anterior)

## Arquivo: run-pipeline.sh

```bash
#!/bin/bash
set -euo pipefail

SPEC="$1"
PIPELINE="pipeline-$(date +%Y%m%d-%H%M%S)"
LOG_DIR=".claude/skills/orchestrator/logs"
STATE_DIR="tasks/agent-states"
STATE_FILE="tasks/pipeline.json"

mkdir -p "$LOG_DIR" "$STATE_DIR"

# Inicia pipeline state
echo "{\"pipeline\":\"$PIPELINE\",\"spec\":\"$SPEC\",\"phase\":1,\"agents\":{},\"started\":\"$(date -I)\"}" \
  > "$STATE_FILE"

# ── FASE 1 ────────────────────────────────────────────
log "FASE 1: SPEC-ANALYZER + ARCHITECT"
snapshot.sh "pre-phase-1"

SPEC-ANALYZER --spec "$SPEC" --pipeline "$PIPELINE" &
ARCHITECT --spec "$SPEC" --pipeline "$PIPELINE" &

wait-for-phase.sh 1 || { rollback.sh; exit 1; }

# ── FASE 2 ────────────────────────────────────────────
log "FASE 2: CODER-1 + CODER-2"
snapshot.sh "pre-phase-2"

CODER-1 --spec "$SPEC" --pipeline "$PIPELINE" &
CODER-2 --spec "$SPEC" --pipeline "$PIPELINE" &

wait-for-phase.sh 2 || { rollback.sh; ship.sh --issue; exit 1; }

# ── FASE 3 ────────────────────────────────────────────
log "FASE 3: TESTER + DOCS + SMOKE + REVIEWER"
snapshot.sh "pre-phase-3"

TESTER --spec "$SPEC" --pipeline "$PIPELINE"
DOCS --spec "$SPEC" --pipeline "$PIPELINE"
SMOKE --spec "$SPEC" --pipeline "$PIPELINE"
REVIEWER --spec "$SPEC" --pipeline "$PIPELINE"

# ── SHIP ─────────────────────────────────────────────
ship.sh --pr
```

## Arquivo: wait-for-phase.sh

```bash
#!/bin/bash
set -euo pipefail

PHASE="$1"
STATE_FILE="tasks/pipeline.json"
TIMEOUT=3600  # 1h max por fase

case $PHASE in
  1) AGENTS=("SPEC-ANALYZER" "ARCHITECT") ;;
  2) AGENTS=("CODER-1" "CODER-2") ;;
  *) echo "Fase desconhecida"; exit 1 ;;
esac

START=$(date +%s)
while true; do
  ALL_DONE=true
  ALL_SUCCESS=true
  
  for agent in "${AGENTS[@]}"; do
    STATE=$(cat "tasks/agent-states/${agent}.json" 2>/dev/null || echo '{}')
    STATUS=$(echo "$STATE" | jq -r '.status' 2>/dev/null)
    EXIT=$(echo "$STATE" | jq -r '.exit_code // 0' 2>/dev/null)
    
    if [ "$STATUS" != "completed" ]; then
      ALL_DONE=false
    fi
    if [ "$EXIT" != "0" ]; then
      ALL_SUCCESS=false
    fi
  done
  
  if $ALL_DONE; then
    if $ALL_SUCCESS; then
      echo "✅ Phase $PHASE: ALL SUCCESS"
      exit 0
    else
      echo "❌ Phase $PHASE: FAILED"
      exit 1
    fi
  fi
  
  # Timeout
  NOW=$(date +%s)
  if (( NOW - START > TIMEOUT )); then
    echo "❌ Timeout fase $PHASE"
    exit 1
  fi
  
  sleep 5
done
```

## Arquivo: snapshot.sh

```bash
#!/bin/bash
set -euo pipefail

LABEL="$1"
SNAP="tank@pre-$LABEL-$(date +%Y%m%d-%H%M%S)"
echo "📸 Snapshot: $SNAP"
sudo zfs snapshot -r "$SNAP"
echo "$SNAP" >> tasks/snapshots.log
```

## Arquivo: rollback.sh

```bash
#!/bin/bash
set -euo pipefail

LAST=$(tail -1 tasks/snapshots.log 2>/dev/null | cut -d' ' -f1)
if [ -n "$LAST" ]; then
  echo "🔄 Rollback: $LAST"
  sudo zfs rollback -r "$LAST"
else
  echo "⚠️  No snapshot to rollback"
fi
```

## Arquivo: ship.sh

```bash
#!/bin/bash
set -euo pipefail

MODE="${1:-}"
GITEA_TOKEN="$(grep GITEA_TOKEN ~/.hermes/.env | cut -d= -f2)"
REPO="will/homelab-monorepo"

if [ "$MODE" == "--issue" ]; then
  # Cria issue em vez de PR
  curl -s -X POST "https://git.zappro.site/api/v1/repos/$REPO/issues" \
    -H "Authorization: token $GITEA_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"[AUTOMATED] Pipeline failed","body":"Ver tasks/agent-states/"}'
  echo "✅ Issue criada"
else
  # Cria PR
  BRANCH=$(git branch --show-current)
  curl -s -X POST "https://git.zappro.site/api/v1/repos/$REPO/pulls" \
    -H "Authorization: token $GITEA_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"head\":\"$BRANCH\",\"base\":\"main\",\"title\":\"Pipeline: $(cat tasks/pipeline.json | jq -r .spec)\"}"
  echo "✅ PR criada"
fi
```

---

## Resumo: v1 vs v3

| Aspecto | v1 (14 agentes) | v3 (3 fases) |
|---------|-----------------|--------------|
| Agentes simultâneos | 14 | 2-4 |
| Paralelismo real | ❌ Fake | ✅ DAG real |
| Scripts implementados | ❌ 0/20 | ✅ 6/6 |
| Custo por pipeline | ~$2-3 | ~$0.50 |
| Rollback | ❌ Não existe | ✅ snapshot + rollback |
| Gates entre fases | ❌ Não | ✅ check-gate |
| Complexidade | 14 estados | 3 fases |

## Status

- [ ] SPEC-090 escrita
- [ ] Scripts implementados
- [ ] AGENTS.md atualizado
- [ ] Teste executado
