# SPEC-POLYMER-003: Enterprise Orchestration para Nexus/Vibe Scripts

**Data:** 2026-04-30
**Status:** PROPOSTA
**Fases:** FASE 3 (scripts audit), FASE 4 (skills), FASE 5 (desktop), FASE 6 (symlinks)
**Anterior:** SPEC-POLYMER-001, SPEC-POLYMER-002

---

## Diagnóstico Atual

### Problema Central
26 scripts Bash em `/srv/monorepo/scripts/` — nexus-*, vibe-* — sem schema, sem tipos, sem estado transacional, sem retry, sem rollback estruturado.

### Análise dimensional

| Dimensão | Agora (Bash) | Enterprise Standard |
|---|---|---|
| **Estado** | Variáveis + arquivos | Redis/Postgres com schema |
| **Orquestração** | `while true; bash vibe.sh` | StateGraph com transições tipadas |
| **Erro** | `set -e` + exit codes | Exceções tipadas + retry + rollback |
| **Handoff** | Variáveis exportadas | Message queue + acknowledgment |
| **Checkpoint** | Snapshot ZFS manual | Auto-checkpoint por fase |
| **Observabilidade** | `echo "done"` + logs | Prometheus metrics + OTEL traces |
| **Hermes usable** | Read-only se conseguir | Tool-use nativo via MCPO |
| **Persistência** | Nenhuma entre sessões | Session resume de Redis |

---

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────┐
│              Hermes (Lead Agent / MCPO)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  MCPO Tool  │  │  Session    │  │  Handoff    │  │
│  │  (native)   │  │  Store      │  │  Protocol   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │ MCPO / tool calls
┌───────────────────────▼─────────────────────────────┐
│              Orchestrator (LangGraph)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  State   │  │  Nodes   │  │  Edges   │          │
│  │  Schema  │  │ (actions)│  │(transitions)         │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│  checkpoint: PostgreSQL (state + history)           │
│  queue: Redis Streams                                │
│  events: OTEL traces                                │
│  metrics: Prometheus exporters                      │
└─────────────────────────────────────────────────────┘
```

---

## Componentes

### 1. State Schema (PostgreSQL)
```sql
-- Sessions
CREATE TABLE orchestrator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phase TEXT NOT NULL,  -- 'vibe', 'nexus', 'deploy'
  status TEXT NOT NULL,  -- 'running', 'paused', 'done', 'failed', 'rolled_back'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  checkpoint_id UUID
);

-- Checkpoints por fase
CREATE TABLE orchestrator_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES orchestrator_sessions(id),
  phase TEXT NOT NULL,
  step TEXT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- History de transições
CREATE TABLE orchestrator_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES orchestrator_sessions(id),
  from_phase TEXT,
  to_phase TEXT,
  action TEXT,
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. Redis Streams (Handoff/Queue)
```
Key: orchestrator:queue
Type: Redis Stream (XADD, XREADGROUP)

Entry:
{
  "session_id": "uuid",
  "action": "deploy|validate|ship|rollback",
  "payload": JSON,
  "priority": "1-10",
  "created_at": "timestamp"
}
```

### 3. MCPO Integration
- Hermes conecta via `mcpo` (porta 8092) como tool provider
- Ferramentas expostas: `orchestrator_start`, `orchestrator_status`, `orchestrator_checkpoint`, `orchestrator_rollback`, `orchestrator_resume`
- Permissão: qualquer agente pode chamar; session owner valida

### 4. LangGraph StateGraph

**Fases:**
```
idle → planning → executing → validating → checkpointing → done
                      ↓                      ↓
                   error ──────────────→ rollback → checkpoint_recovery → executing
```

**Nodes:**
- `plan()` — LLM decide próximo passo
- `execute()` — roda script/ferramenta
- `validate()` — checa resultado contra spec
- `checkpoint()` — salva estado no PostgreSQL
- `rollback()` — restaura último checkpoint
- `notify()` — envia resumo para Telegram

### 5. Retry + Rollback

**Retry policy:**
- 3 tentativas com backoff exponencial (2s, 4s, 8s)
- Após 3 falhas → auto-rollback

**Rollback:**
- Identifica último checkpoint válido
- Restaura estado + limpa artefatos
- Notifica usuário com relatório

---

## Validação de Conceito (PoC)

### PoC em Python (monorepo/services/orchestrator/)
```
orchestrator/
├── __init__.py
├── state.py          # Pydantic models + PostgreSQL
├── queue.py          # Redis Streams
├── graph.py          # LangGraph StateGraph
├── mcpo_server.py    # MCPO tool provider
├── tools.py          # Tool definitions (hermes_tools format)
└── main.py           # Entry point
```

### PoC Features (minimal viable):
1. Session CRUD em PostgreSQL
2. Checkpoint/restore
3. MCPO tool provider (4 tools)
4. LangGraph com 3 nodes: `start` → `execute` → `done`
5. Sem retry/rollback ainda

### PoC NÃO inclui:
- Redis Streams (substituir por polling PostgreSQL por enquanto)
- OTEL traces
- Prometheus exporter
- Vibe/Nexus script migration

---

## Tasks

| ID | Ação | Status | Dependência |
|---|---|---|---|
| T010 | Criar SPEC-POLYMER-003 | DONE | — |
| T011 | Criar schema PostgreSQL | PENDING | T010 |
| T012 | Criar orchestrator/ Python PoC | PENDING | T011 |
| T013 | Implementar MCPO tools | PENDING | T012 |
| T014 | Integrar com LangGraph | PENDING | T013 |
| T015 | Testar session start/resume | PENDING | T014 |
| T016 | Documentar no SOUL.md | PENDING | T015 |
| T017 | Migrar 1 script nexus para orchestrator | PENDING | T016 |

---

## Critério de完成

- PoC rodando com 4 MCPO tools
- 1 sessão criada, checkpointada, e restaurada com sucesso
- Documentado no SOUL.md
- ZFS snapshot `tank@polymer-003-enterprise-done`
