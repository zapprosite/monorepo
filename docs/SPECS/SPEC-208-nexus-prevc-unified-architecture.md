---
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab
spec: SPEC-208-nexus-prevc-unified-architecture
title: Nexus + PREVC — Unified Agent Harness Architecture
status: active
date: 2026-05-02
author: Agent Architecture Team
---

# SPEC-208 — Nexus + PREVC Unified Architecture

## 1. Overview

**O que é:** Unificação do Nexus (scripts operacionais) com PREVC (workflow pattern) numa arquitetura coesa onde:
- **Nexus** = infraestrutura de operações (legacy detection, alerting, cron, SRE)
- **PREVC** = contrato de fases (spec, não motor) executado pelo Claude Code Agent Teams

**O que NÃO é mais:** PREVC como motor standalone com queue.json e state.json próprios. LangGraph como orquestrador.

**Stack de execução:** `queue-control.sh` + `pipeline-plan.py` + `pipeline-executor.py` (chunk-based sequencial)
**Stack de paralelismo:** Claude Code CLI Agent Teams (supervisor nativo) — executa dento de cada chunk
**Stack operacional:** Nexus scripts (legacy, alerting, cron, SRE)
**Governança:** Claude Code Hooks (PreToolUse/PostToolUse)

---

## 2. Arquitetura de Alto Nível

```
HERMES (agente pai —会话)
│
├── SUPERVISOR (Claude Code — main session)
│   │   └── Coordena 5 fases PREVC
│   │       └── Agent Teams habilitados (settings.json)
│   │
│   ├── HOOKS (.claude/hooks/)
│   │   ├── PreToolUse-Bash-validate   → governance + security
│   │   ├── PreToolUse-Edit-validate   → path safety
│   │   └── Stop-session-log           → session logging
│   │
│   └── TEAMS (teammates — workers isolados)
│       ├── backend-agent    → API, DB, services
│       ├── frontend-agent   → UI, components
│       ├── review-agent     → code review, quality gates
│       └── deploy-agent     → docker, coolify, ZFS
│
├── NEXUS SCRIPTS (/srv/monorepo/scripts/nexus-*.sh)
│   ├── nexus-legacy-detector.sh    → SRE: arquivos >90 dias
│   ├── nexus-code-scanner.sh       → SRE: code quality via CLI
│   ├── nexus-alert.sh              → SRE: alertas persistentes
│   ├── nexus-cron-legacy.sh        → SRE: cron every 30min
│   ├── nexus-sre.sh                → SRE: health monitoring
│   └── (outros nexus-*.sh operacionais)
│
└── PREVC WORKFLOW (contrato de fases — SPEC only)
    └── 5 fases: Plan → Review → Execute → Verify → Complete
        → Definido aqui como especificação
        → Executado pelo supervisor (Claude Code Agent Teams)
        → NÃO existe motor PREVC separado

---

## 2b. Motor de Execução — queue-control.sh

O motor de execução é o `queue-control.sh` (`~/.hermes/scripts/`). Implementa chunk-based pipeline sequencial com checkpoint:

```
plan (pipeline.json)
    ↓
pipeline-plan.py  →  divide em chunks (CHUNK_SIZE=5 tarefas)
    ↓
checkpoint.json  ←  estado centralizado
    ↓
chunk-001.json  →  pipeline-executor.py  →  results
chunk-002.json  →  pipeline-executor.py  →  results
...
    ↓
queue-control.sh review  →  validação final
    ↓
queue-control.sh destroy  →  shred + cleanup
```

**Comandos:**

| Comando | Função |
|---------|--------|
| `queue-control.sh plan <json>` | Analisa pipeline e gera chunks em `/tmp/sub-pipeline-*.json` |
| `queue-control.sh next` | Executa próximo chunk do checkpoint |
| `queue-control.sh run <chunk>` | Executa chunk específico |
| `queue-control.sh status` | Mostra estado atual (chunk_index, tasks_done, status) |
| `queue-control.sh review` | Validação final + prompt destroy |
| `queue-control.sh destroy` | Shred seguro + cleanup emergência |

**Checkpoint (`~/.hermes/pipeline-checkpoint.json`):**
```json
{
  "spec": "SPEC-208",
  "status": "running",
  "chunk_index": 2,
  "total_chunks": 4,
  "tasks_done": ["task-1", "task-2"],
  "tasks_remaining": ["task-3", ...],
  "last_updated": "2026-05-02T..."
}
```

**Fluxo de contexto entre chunks:**
1. Chunk completa → `cmd_next` mostra hint de renovação
2. Agente faz `session_search()` para saber o que foi feito
3. Agente carrega próximo chunk file e continua
4. `pipeline-executor.py` loga tudo em `~/.hermes/pipeline-logs/`

**Shred seguro:** `queue-control.sh destroy` faz 3-pass DD overwrite antes de apagar — garante que segredos nos logs não são recuperáveis.

**Gates de aprovação por fase PREVC mapeiam para transições de status no checkpoint:**
- P→R: `plan` rodou, status "planned", humano approves
- R→E: status "reviewed", Chunk 1 inicia
- E→V: todos os chunks executados, status "verify"
- V→C: `review` passou, status "review", humano approves
- C→done: `destroy` executado

**Arquivos do motor:**

|| Ficheiro | Função |
|--|---------|--------|
| `queue-control.sh` | CLI do orchestrator |
| `pipeline-plan.py` | Parser + chunk generator |
| `pipeline-executor.py` | Executor de um chunk |
| `pipeline-checkpoint.json` | Estado centralizado |

---

## 3. PREVC como Contrato de Fases

PREVC continua existindo como **workflow pattern de 5 fases**, mas como especificação, não como motor:

| Fase | Significado | Executor |
|------|-------------|----------|
| **P — Plan** | SPEC.md → micro-tasks | Supervisor (Claude Code main) |
| **R — Review** | Avaliar feasibility, risks, dependencies | review-agent (teammate) |
| **E — Execute** | Executar tasks (Claude Code CLI workers) | teammates em paralelo |
| **V — Verify** | Testes, quality gates, smoke | test-agent + review-agent |
| **C — Complete** | Deploy, docs, commit | deploy-agent + docs-agent |

**Gates de aprovação:**
- P→R: humano aprova plano
- R→E: todos os agentes confirmam readiness
- E→V: tasks 100% completas OU ACs satisfeitos
- V→C: quality gates verdes + humano aprova

**Estado do workflow:** `.context/harness/workflows/prevc.json` (state machine format v2)

---

## 4. Claude Code Agent Teams

**Habilitado via:** `settings.json` com `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: 1`

**Arquitetura:**
- Main session = supervisor/team lead
- Teammates = workers isolados com context próprio
- Comunicação = directa entre teammates (não passa pelo supervisor)
- Shared task list = os 2 se comunicam via shared files ou direct messaging

**Configs em `~/.claude/settings.json`:**
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**Subagent scopes (`.claude/agents/`):**
```
.claude/agents/backend-agent.md
.claude/agents/frontend-agent.md
.claude/agents/review-agent.md
.claude/agents/deploy-agent.md
.claude/agents/test-agent.md
.claude/agents/docs-agent.md
```

Cada subagent define: `description`, `prompt`, `tools`, `disallowedTools`, `model`, `mcpServers`

---

## 5. Claude Code Hooks — Governança

Hooks existentes em `~/.claude/hooks/`:

| Hook | Tipo | Função |
|------|------|--------|
| `PreToolUse-Bash-validate.bash` | PreToolUse | Bloqueia padrões perigosos (dd, mkfs, wipefs) |
| `PreToolUse-Edit-validate.bash` | PreToolUse | Valida paths de edição |
| `Stop-session-log.bash` | Stop | Salva log da sessão antes de fechar |

**Novos hooks a criar:**

### PreToolUse-Governance.bash (novo)
```bash
#!/bin/bash
# PreToolUse Hook: Governance — anti-hardcode, secrets, safe paths
COMMAND="$*"

# Anti-hardcode: detecta API keys, tokens, passwords hardcoded
HARDCODE_PATTERNS=(
  "sk-[0-9a-zA-Z]{20,}"
  "ghp_[0-9a-zA-Z]{36,}"
  "AIza[0-9A-Za-z_-]{35,}"
  "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}:[a-zA-Z0-9]+"
)

for pattern in "${HARDCODE_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "ERROR: Potential hardcoded secret detected"
    exit 1
  fi
done

exit 0
```

### PostToolUse-Snapshot.bash (novo)
```bash
#!/bin/bash
# PostToolUse Hook: ZFS snapshot after critical operations
# Critério: se o comando modificou /srv, fazer snapshot
CRITICAL_PATHS=("/srv/monorepo" "/srv/ops" "/srv/data")
COMMAND="$*"

for path in "${CRITICAL_PATHS[@]}"; do
  if echo "$COMMAND" | grep -q "$path"; then
    SNAPSHOT="tank@pre-$(date +%Y%m%d-%H%M%S)-hook-snapshot"
    sudo zfs snapshot -r "$SNAPSHOT" 2>/dev/null
    echo "SNAPSHOT: $SNAPSHOT"
    break
  fi
done

exit 0
```

---

## 6. Nexus — Scripts Operacionais

Scripts mantidos (funcionais):

| Script | Função | Status |
|--------|---------|--------|
| `nexus-legacy-detector.sh` | Detecta arquivos legacy (>90d), placeholders, hardcoded | ✅ Mantém |
| `nexus-code-scanner.sh` | Code quality via Claude CLI | ✅ Mantém |
| `nexus-alert.sh` | Alertas persistentes com escalação | ✅ Mantém |
| `nexus-cron-legacy.sh` | Cron orchestrator (scan every 30min) | ✅ Mantém |
| `nexus-cron-helper.sh` | Helper de cron | ✅ Mantém |
| `nexus-sre.sh` | SRE monitoring | ✅ Mantém |
| `nexus-ctl.sh` | Control interface | ✅ Mantém |
| `nexus-init.sh` | Init | ✅ Mantém |
| `nexus-auto.sh` | Automação | ✅ Mantém |
| `nexus-context-wrap.sh` | Context management | ✅ Mantém |
| `nexus-context-window-manager.sh` | Context window | ✅ Mantém |
| `nexus-investigate.sh` | Investigate | ✅ Mantém |
| `nexus-deploy.sh` | Deploy | ✅ Mantém |
| `nexus-full-deploy.sh` | Full deploy | ✅ Mantém |
| `nexus-ollama-stats.sh` | Ollama stats | ✅ Mantém |
| `nexus-qdrant-stats.sh` | Qdrant stats | ✅ Mantém |
| `nexus-redis-stats.sh` | Redis stats | ✅ Mantém |
| `nexus-ufw.sh` | UFW management | ✅ Mantém |
| `nexus-tunnel.sh` | Tunnel management | ✅ Mantém |
| `nexus-rate-limiter.sh` | Rate limiting | ✅ Mantém |
| `nexus-hermes-stats.sh` | Hermes stats | ✅ Mantém |
| `nexus-session-scheduler.sh` | Session scheduler | ✅ Mantém |
| `nexus-monitor-15k.sh` | Monitor 15k context | ✅ Mantém |
| `nexus-governance.sh` | Governance | ✅ Mantém |

**Prefixo unificado:** `nexus-*` para todos os scripts operacionais. Não mais referências a "PREVC motor" ou "queue.json PREVC" na documentação interna dos scripts.

**O que muda:**
- Comentários nos scripts que referenciavam PREVC como motor → actualizam para indicar que PREVC é spec-only
- `SPEC-015` referenciada nos scripts → passa a `SPEC-208`

---

## 7. Estado: O que Existe vs O que é Spec

### Existe (funciona hoje)

| Componente | Onde | Status |
|------------|------|--------|
| Nexus scripts | `/srv/monorepo/scripts/nexus-*.sh` | ✅ Funcional |
| **queue-control.sh motor** | `~/.hermes/scripts/queue-control.sh` | ✅ Funcional — **motor real do pipeline** |
| **pipeline-plan.py** | `~/.hermes/scripts/pipeline-plan.py` | ✅ Funcional |
| **pipeline-executor.py** | `~/.hermes/scripts/pipeline-executor.py` | ✅ Funcional |
| **checkpoint** | `~/.hermes/pipeline-checkpoint.json` | ✅ Funcional |
| SPEC-015 | `/srv/monorepo/docs/SPECS/SPECS-dead/SPEC-015-...md` | ✅ Arquivado |
| prevc.json workflow state | `.context/harness/workflows/prevc.json` | ✅ Formato válido (spec only) |
| pipeline.json (health) | `.claude/vibe-kit/pipeline.json` | ✅ Health check output |
| Claude Code hooks | `~/.claude/hooks/` | ✅ Funcionando |
| Agent Teams flag | `~/.claude/settings.json` | ✅ Habilitado |

### Spec only (não existe motor)

| Componente | Era suposto ser | Agora |
|------------|----------------|--------|
| PREVC motor | `nexus.sh`, `vibe-kit.sh` com PREVC | Spec only — REMOVIDO DO ROADMAP |
| LangGraph orchestrator | Orquestrador graph-based | Não faz parte do stack |
| MCP dotcontext | Durable session state | Context lives in filesystem (SPEC-107) |
| 49 agentes especializados | 7 roles × 7 modes | Reduzido para 6 teammate types |

### Agora é SPEC only (PREVC phases)

O `.context/harness/workflows/prevc.json` passa a ser o **formato canônico de estado de workflow**, não um motor. O supervisor (Claude Code main session) que lê e executa as transições.

**Motor real:** `queue-control.sh` — chunk-based sequencial com checkpoint.

**O PREVC como spec-only** significa: as 5 fases (Plan→Review→Execute→Verify→Complete) são o contrato de governança, mas a execução é controlada pelo queue-control.sh com chunks, não por Agent Teams autônomo.

---

## 8. Fases PREVC — Detalhamento

### Phase P — Plan
- Supervisor recebe SPEC.md
- Quebra ACs em micro-tasks (<5 min cada)
- Cria task list para teammates
- **Gate:** humano aprova

### Phase R — Review
- review-agent avalia: feasibility, risks, dependencies
- test-agent valida testabilidade dos ACs
- debug-agent faz pré-scan
- **Gate:** R→E approval (humano ou automático se zero blocking)

### Phase E — Execute
- Supervisor distribui tasks para teammates via Agent Teams
- Workers executam em contexto isolado
- **Chunks executados via `queue-control.sh`** — cada chunk é um grupo de tasks (CHUNK_SIZE=5)
- ZFS snapshot a cada 3 tasks completadas
- **Gate:** 100% tasks OU ACs satisfeitos

### Phase V — Verify
- test-agent roda suite completa
- review-agent faz final code review
- Quality gates: coverage ≥ threshold, zero critical findings
- **Gate:** V→C approval

### Phase C — Complete
- deploy-agent faz deploy
- docs-agent finaliza documentação
- Commit + tag
- ZFS snapshot final

---

## 9. Dependências Externas

| Dependência | Versão | Uso |
|-------------|--------|-----|
| Claude Code CLI | ≥2.1.32 | Supervisor + teammates |
| Ollama | latest | VL + embeddings (local) |
| Qdrant | v1.7+ | Vector store (local) |
| ZFS | any | Snapshots |
| Docker | any | Containers |
| hermes-brain | openrouter.ai/api/v1 | LLM (via LiteLLM) |

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Agent Teams instável (experimental) | Média | Alto | Flag atrás de setting experimental; fallback para subagents |
| PREVC como spec apenas perde-se | Baixa | Médio | Esta SPEC documenta o pattern; revisão trimestral |
| Hooks geram muitos snapshots | Alta | Baixo | PostToolUse-Snapshot usa throttle (max 1 por hora) |
| Nexus scripts não mantidos | Média | Médio | Cron jobs alertam se scripts falham |

---

## 11. Cron Jobs Associados

```bash
# Nexus operational — mantém
*/30 * * * * /srv/monorepo/scripts/nexus-cron-legacy.sh scan
0 */6 * * * /srv/monorepo/scripts/nexus-cron-legacy.sh deep
0 9 * * 1-5 /srv/monorepo/scripts/nexus-cron-legacy.sh summary

# Agent Teams health (se habilitado)
*/5 * * * * curl -s http://localhost:11434/api/tags | jq -e '.models[] | select(.name == "qwen2.5-coder:14b-q6k")' > /dev/null
```

---

## 12. Métricas de Sucesso

- Agent Teams funcional (flag habilitado + teammates respondem)
- Hooks de governança activos (Bash validation + Governance + Snapshot)
- Nexus cron jobs executing without errors
- PREVC phases documented and executable by supervisor
- Zero "PREVC motor" references in codebase (spec-only transition)
