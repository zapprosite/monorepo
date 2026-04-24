---
created: 2026-04-23
updated: 2026-04-23
owner: equipe-ops@zappro.site
status: ativo
version: 1.0.0
---

# SPEC-106: Hermes Multi-Agent Architecture Standard

## Table of Contents
- [1. Resumo Executivo](#1-resumo-executivo)
- [2. Arquitetura](#2-arquitetura)
- [3. Procedimentos Operacionais](#3-procedimentos-operacionais)
- [4. Monitoramento e SLOs/SLAs](#4-monitoramento-e-sloslas)
- [5. Troubleshooting](#5-troubleshooting)
- [6. Runbook](#6-runbook)
- [7. Referencias](#7-referencias)

## 1. Resumo Executivo


---
name: SPEC-106-hermes-multi-agent-architecture-standard
description: "Padrao unificado Hermes para multi-agent nativo com LangGraph. Unifica auditoria do hermes-agent (SPEC-116) e cirurgia do hermes-agency (SPEC-117, Claudio Cotseri). Define o arquitetura LangGraph padrao para todo o ecossistema Hermes."
spec_id: SPEC-106
status: ACTIVE
priority: critical
author: Hermes (audit) + William Rodrigues
date: 2026-04-23
specRef: SPEC-068, SPEC-090, SPEC-093
tags: [hermes, multi-agent, langgraph, a


## 2. Arquitetura



---



O ecossistema Hermes tem 2 codigos separados com arquiteturas multi-agent distintas:

1. **hermes-agent** (Python, `~/Downloads/hermes-agent-main/`) — loop sincrono com `delegate_task`
2. **hermes-agency** (TypeScript, `/srv/monorepo/apps/hermes-agency/`) — CEO routing com LangGraph

Cada um tinha sua propria spec (116 e 117). Esta spec unifica os padroes em um so documento canonical.

---


### 1.1 Hermes Agent (Python)

**Local:** `~/Downloads/hermes-agent-main/`

**Arquitetura core** — loop sincrono simples em `run_agent.py`:
```python
while api_call_count < max_iterations:
    response = client.chat.completions.create(model=model, messages=messages, tools=tool_schemas)
    if response.tool_calls:
        for tool_call in response.tool_calls:
            result = handle_function_call(tool_call.name, tool_call.args, task_id)
            messages.append(tool_result_message(result))
        api_call_count += 1
    else:
        return response.content
```

**54 ferramentas registradas** em `tools/*.py`:
- Browser (11), File (4), Terminal (2), Web (2), Skills (3), Vision (2), RL Training (10), HomeAssistant (4), Feishu (5), Misc (11)

**Multi-agent nativo via `delegate_task`** (`tools/delegate_tool.py`, 1200 linhas):
```python
DELEGATE_BLOCKED_TOOLS = frozenset([
    "delegate_task", "clarify", "memory", "send_message", "execute_code",
])
MAX_DEPTH = 2
DEFAULT_MAX_CONCURRENT_CHILDREN = 3
DEFAULT_TOOLSETS = ["terminal", "file", "web"]
```

**O que EXISTE:**
- Loop de tool-calling sincrono
- Sistema de tools com registry
- Memória em camadas (SOUL.md + Mem0 + Session)
- Profiles (multi-instancia isolada via HERMES_HOME)

**O que NAO EXISTE:**
- LangGraph (zero referencias)
- Conditional branching (só sequencial)
- Persistent agent state (cada iteracao stateless)
- Supervisor/Worker como graph nodes
- Checkpointing para suspend/resume

### 1.2 Hermes Agency (TypeScript)

**Local:** `/srv/monorepo/apps/hermes-agency/src/`

```
router/agency_router.ts        (329 linhas) — CEO routing
skills/
  index.ts                    (287 linhas) — 13 skills registry
  tool_registry.ts           (625 linhas) — tool execution
  circuit_breaker.ts         (110 linhas) — circuit breaker ✅
  rag-instance-organizer.ts  — RAG/Trieve
langgraph/
  supervisor.ts              (160 linhas) — workflow dispatcher
  content_pipeline.ts       (367 linhas) — TRUE LangGraph StateGraph
  onboarding_flow.ts         (251 linhas) — FAKE (sequencial async)
  lead_qualification.ts       (105 linhas) — FAKE (sequencial async)
  social_calendar.ts         (159 linhas) — FAKE (sequencial async)
  status_update.ts           (204 linhas) — FAKE (sequencial async)
mem0/                        — session + long-term memory ✅
qdrant/client.ts             (357 linhas) — 9 colecoes ✅
telegram/
  bot.ts                     (537 linhas) — Telegram bot hardening ✅
  distributed_lock.ts        — Redis lock ✅
  rate_limiter.ts           — sliding window ✅
  file_validator.ts         — MIME validation ✅
```

**5 workflows:**
```
content_pipeline  → TRUE LangGraph (StateGraph com MemorySaver)
onboarding        → sequencial async ❌
lead_qualification→ sequencial async ❌
social_calendar   → sequencial async ❌
status_update     → sequencial async ❌
```

---


### Hermes Agent
- `delegate_task` com depth limit, blocked tools, concurrent children ✅
- Anti-hardcoding compliance em todas as tools ✅
- Sistema de registry de tools (nao substituido) ✅
- Toolset system (core + extended) ✅

### Hermes Agency
- Circuit breaker com 3 estados (CLOSED/OPEN/HALF_OPEN) ✅
- Qdrant client com 9 colecoes bem definidas ✅
- Telegram bot hardening (Redis lock, rate limit, file validation) ✅
- Mem0 memory layer (session + long-term) ✅
- CEO routing com prompt injection defense (sanitizeForPrompt) ✅
- Brand Guardian gate + Human confidence gate ✅
- Anti-hardcoding em todos os arquivos ✅

---


### P0-1: LangGraph fake em 4/5 workflows (Hermes Agency)

`langgraph/supervisor.ts:10-14` comenta:
```
Only `content_pipeline` is a true LangGraph StateGraph (WF-1).
The others are sequential async workflows (WF-2 through WF-5) — not yet migrated to StateGraph.
```

Os 4 workflows `onboarding`, `lead_qualification`, `social_calendar`, `status_update` usam apenas `async function` sequencial, NAO StateGraph.

### P0-2: content_pipeline com edges fixos (Hermes Agency)

```typescript
.addEdge(START, 'CREATIVE')
.addEdge('CREATIVE', 'VIDEO')
.addEdge('VIDEO', 'DESIGN')
.addEdge('DESIGN', 'BRAND_GUARDIAN')
.addEdge('BRAND_GUARDIAN', 'HUMAN_GATE')  // sempre, nunca condicional
.addEdge('HUMAN_GATE', 'SOCIAL')
.addEdge('SOCIAL', 'ANALYTICS')
.addEdge('ANALYTICS', END)
```

Nao ha conditional branching, parallel nodes, loops, ou skip edges.

### P0-3: humanGateNode auto-aprova (Hermes Agency)

```typescript
// Comment says: "interrupt not fully wired"
console.log(`[ContentPipeline] Auto-approving (interrupt not fully wired in this version)`);
return { ...state, humanApproved: true };
```

O graph nao para para esperar aprovacao humana. Ele auto-aprova e continua.

### P0-4: 6 skills sem frontmatter YAML (Hermes Agent skills)

`brain-analytics`, `brain-backup`, `brain-dashboard`, `homelab-surveyor`, `mcp-persist`, `skill-teacher` — faltam header `---` e campos YAML.

### P0-5: 3 skills com refs deprecated (Hermes Agent skills)

- `homelab-map` e `local-fast-executor-pattern` — mencionam `gemma4` (removido)
- `whisper-api-gpu-debug` — menciona `whisper-server-v2` (substituido por faster-whisper-server)

### P1-1: approveContentPipeline nao funciona (Hermes Agency)

O graph ja terminou antes de receber a aprovacao. `invoke()` com novo estado reinicia do zero, nao resume de onde parou. Falta `interrupt()` + `Command resume`.

### P1-2: Session state in-memory (Hermes Agency)

```typescript
const _sessionStates = new Map<string, AgencySupervisorState>();
```

Morre com restart do servico. Deveria persistir em `agency_working_memory` no Qdrant.

### P1-3: MemorySaver nao persiste (Hermes Agency)

```typescript
const checkpointer = new MemorySaver();
```

Em memoria. Falta persistencia real (QdrantSaver ou similar).

### P1-4: 10 RL tools orfas (Hermes Agent)

`rl_*` tools (10 items) existem no registry mas:
- Nao estao em nenhuma toolset padrao
- Nao ha ambiente RL configurado

### P1-5: 20 skills sem category (Hermes Agent skills)

43% das skills locais nao tem `category:` no frontmatter.

---


### 4.1 Padroes de Multi-Agent Reconhecidos

| Padrao | Descricao | Onde Existe |
|--------|-----------|-------------|
| **Supervisor/Worker** | Um agente supervisor delega para workers especializados | Hermes Agency (agency_router.ts) |
| **Sequential Chain** | Agentes executam em sequencia | Ambos |
| **Parallel Fan-out/Fan-in** | Supervisor envia para N workers em paralelo | Hermes Agent (delegate_task batch) |

### 4.2 Arquitetura Proposta: Hermes como LangGraph Supervisor

```
                    LANGGRAPH GRAPH
                    =====================================

  ┌──────────────┐     ┌──────────────────────────────┐
  │  Supervisor  │────▶│  Tool-Execution Subgraph     │
  │   ( Hermes   │     │  ┌────────┐ ┌────────┐      │
  │    Agent )   │     │  │read_file│ │terminal│ ...  │
  └──────────────┘     │  └────────┘ └────────┘      │
         │              └──────────────────────────────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────────────────────┐
  │  Subagent    │────▶│  Delegation Subgraph          │
  │  Spawner     │     │  (delegate_task children)     │
  └──────────────┘     └──────────────────────────────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────────────────────┐
  │  Memory      │────▶│  State Management             │
  │  & Context   │     │  (SOUL.md + Mem0 + Qdrant)   │
  └──────────────┘     └──────────────────────────────┘
```

### 4.3 Padrao de Workflow StateGraph

```typescript
import { StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph/checkpointing';

// 1. Definir estado
interface WorkflowState {
  brief: string;
  currentStep: string;
  outputs: Record<string, unknown>;
  humanApproved?: boolean;
  error?: string;
}

// 2. Nodes como funcoes async
async function creativeNode(state: WorkflowState): Promise<WorkflowState> {
  const result = await llmComplete({ messages: [...], maxTokens: 4096 });
  return { ...state, outputs: { creative: result.content }, currentStep: 'CREATIVE' };
}

// 3. Edges condicionais
.addConditionalEdges('BRAND_GUARDIAN',
  (s) => {
    if (s.outputs.brandScore < 0.8) return 'HUMAN_GATE';
    return 'SOCIAL';
  }
)

// 4. Interrupt para human approval
async function humanGateNode(state: WorkflowState): Promise<WorkflowState> {
  if (state.outputs.brandScore < 0.8) {
    const approved = await interrupt<boolean>('awaiting_human_approval', {
      brandScore: state.outputs.brandScore,
      content: state.outputs.creative,
    });
    return { ...state, humanApproved: approved };
  }
  return { ...state, humanApproved: true };
}

// 5. Compile com checkpointer
const checkpointer = new MemorySaver();
const workflow = new StateGraph({...})
  .addNode('CREATIVE', creativeNode)
  .addNode('HUMAN_GATE', humanGateNode)
  // ...
  .compile({ checkpointer });

// 6. Invoke com thread_id para resume
const result = await workflow.invoke(initialState, {
  configurable: { thread_id: campaignId },
});
```

### 4.4 Parallel Tool Execution

Skills onde a ordem NAO importa (parallel):
```typescript
const parallel = await Promise.allSettled(
  skill.tools.map(toolName => TOOL_REGISTRY[toolName](args))
);
```

Skills onde a ordem IMPORTA (sequential):
- `agency-onboarding`: criar perfil ANTES de inicializar Qdrant
- `agency-creative`: brainstorm ANTES de write_copy

---


### Fase 1: Fixes P0 Imediatos

| ID | Tarefa | Codigo | Status |
|----|--------|--------|--------|
| F1-1 | Migrar 4 workflows fake → StateGraph real | hermes-agency/langgraph/*.ts | PENDING |
| F1-2 | Conditional edges no content_pipeline | hermes-agency/langgraph/content_pipeline.ts | PENDING |
| F1-3 | Implementar interrupt pattern (human approval) | hermes-agency/langgraph/content_pipeline.ts | PENDING |
| F1-4 | Adicionar frontmatter YAML às 6 skills | ~/.hermes/skills/*/SKILL.md | PENDING |
| F1-5 | Atualizar refs deprecated nas 3 skills | ~/.hermes/skills/*/SKILL.md | PENDING |

### Fase 2: Cleanup P1

| ID | Tarefa | Codigo | Status |
|----|--------|--------|--------|
| F2-1 | Session state → Qdrant persistence | hermes-agency/router/agency_router.ts | PENDING |
| F2-2 | MemorySaver → QdrantSaver | hermes-agency/langgraph/content_pipeline.ts | PENDING |
| F2-3 | Adicionar category: às 20 skills | ~/.hermes/skills/*/SKILL.md | PENDING |
| F2-4 | Avaliar RL tools (10 orfas) | hermes-agent/tools/rl_*.py | PENDING |

### Fase 3: Melhorias P2

| ID | Tarefa | Codigo | Status |
|----|--------|--------|--------|
| F3-1 | Parallel tool execution | hermes-agency/router/agency_router.ts | PENDING |
| F3-2 | Test coverage para workflows | hermes-agency/src/__tests__/ | PENDING |
| F3-3 | Qdrant schema init completo | hermes-agency/src/qdrant/client.ts | PENDING |
| F3-4 | Criar skill `delegate-pattern` | ~/.hermes/skills/delegate-pattern/SKILL.md | PENDING |

---


| # | Requisito | Prioridade | Status |
|---|-----------|------------|--------|
| 1 | 6 skills com frontmatter YAML valido | P0 | ⚠️ Falta |
| 2 | Skills sem refs a tools deprecated | P0 | ⚠️ 3 com refs |
| 3 | LangGraph real em todos os 5 workflows | P0 | ⚠️ 4 fake |
| 4 | Interrupt pattern para human approval | P0 | ⚠️ Auto-aprova |
| 5 | Conditional edges no content_pipeline | P0 | ⚠️ Fixo |
| 6 | Session state persistence (Qdrant) | P1 | ⚠️ In-memory |
| 7 | Skills com category: preenchido | P1 | ⚠️ 20 sem |
| 8 | Anti-hardcoding compliance | P0 | ✅ Passou (ambos) |
| 9 | RL tools avaliadas ou removidas | P1 | ⚠️ Orfas |
| 10 | delegate_task documentado em skill | P2 | ❌ Nao existe |

---


## 3. Procedimentos Operacionais

Procedimentos operacionais detalhados para operação contínua do sistema.

## 4. Monitoramento e SLOs/SLAs

| Metrica | SLO | SLA | Status |
|---------|-----|-----|--------|
| Disponibilidade | 99.9% | 99.5% | ativo |
| Latencia P99 | < 200ms | < 500ms | ativo |
| Taxa de Erro | < 0.1% | < 0.5% | ativo |
| Uptime Mensal | > 99.5% | > 99.0% | ativo |

## 5. Troubleshooting

| Problema | Causa Provavel | Solucao |
|----------|----------------|---------|
| Servico indisponivel | Processo parado ou crash | Verificar status com `systemctl status <servico>` |
| Alta latencia | Overload ou rede | Verificar metricas em Grafana |
| Falha de conexao | Rede ou firewall | Verificar regras de firewall |

## 6. Runbook

```bash
# Verificacao diaria de sade
bash /srv/ops/scripts/health-check.sh

# Verificar status dos servicos
docker ps
systemctl status <servico>

# Ver logs
journalctl -u <servico> -n 50
docker logs <container> --tail 100
```

## 7. Referencias

- /srv/monorepo/docs/ARCHITECTURE.md
- /srv/ops/ai-governance/README.md

## 4. Monitoramento e SLOs/SLAs

| Metrica | SLO | SLA | Status |
|---------|-----|-----|--------|
| Disponibilidade | 99.9% | 99.5% | ativo |
| Latencia P99 | < 200ms | < 500ms | ativo |
| Taxa de Erro | < 0.1% | < 0.5% | ativo |
| Uptime Mensal | > 99.5% | > 99.0% | ativo |

## 5. Troubleshooting

| Problema | Causa Provavel | Solucao |
|----------|----------------|---------|
| Servico indisponivel | Processo parado | `systemctl status <servico>` |
| Alta latencia | Overload | Verificar metricas em Grafana |
| Falha de conexao | Rede/firewall | Verificar regras de firewall |

## 6. Runbook

```bash
# Verificacao diaria
bash /srv/ops/scripts/health-check.sh

# Status servicos
docker ps
systemctl status <servico>

# Logs
journalctl -u <servico> -n 50
docker logs <container> --tail 100
```

## 7. Referencias

- /srv/monorepo/docs/ARCHITECTURE.md
- /srv/ops/ai-governance/README.md

## 4. Monitoramento e SLOs/SLAs

| Metrica | SLO | SLA | Status |
|---------|-----|-----|--------|
| Disponibilidade | 99.9% | 99.5% | ativo |
| Latencia P99 | < 200ms | < 500ms | ativo |
| Taxa de Erro | < 0.1% | < 0.5% | ativo |
| Uptime Mensal | > 99.5% | > 99.0% | ativo |

## 5. Troubleshooting

| Problema | Causa Provavel | Solucao |
|----------|----------------|---------|
| Servico indisponivel | Processo parado | `systemctl status <servico>` |
| Alta latencia | Overload | Verificar metricas em Grafana |
| Falha de conexao | Rede/firewall | Verificar regras de firewall |

## 6. Runbook

```bash
# Verificacao diaria
bash /srv/ops/scripts/health-check.sh

# Status servicos
docker ps
systemctl status <servico>

# Logs
journalctl -u <servico> -n 50
docker logs <container> --tail 100
```

## 7. Referencias

- /srv/monorepo/docs/ARCHITECTURE.md
- /srv/ops/ai-governance/README.md
