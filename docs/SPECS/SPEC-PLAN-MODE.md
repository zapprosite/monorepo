# SPEC-PLAN-MODE
**Date:** 2026-04-24
**Status:** EXECUTING
**Type:** Feature / Telegram Command + Plan Generation

---

## 1. CONTEXT

O sistema Hermes precisa de um comando `/plan` que recebe um brief e gera um plano estruturado automaticamente. O plano deve ser executável via mclaude workers e integrar-se com o sistema de memória de 3 camadas (Repo → Qdrant → Mem0).

Este SPEC define o fluxo completo desde a receção do brief até à execução do plano.

---

## 2. OBJECTIVE

Criar o sistema Plan Mode que:
1. Recebe um brief via `/plan` no Telegram
2. Gera um SPEC de plano estruturado
3. Produz um pipeline executável
4. Executa o pipeline via mclaude workers
5. Reporta progresso e resultados

---

## 3. ARCHITECTURE

```
TELEGRAM (/plan) → Hermes Gateway → Plan Mode Agent
                                        │
                    ┌───────────────────┼───────────────────┐
                    ↓                   ↓                   ↓
              Memory Query         SPEC Generate      Pipeline Generate
              (Qdrant/Mem0)        (mclaude spec)      (mclaude pipeline)
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ↓
                                 Plan Document
                                        │
                    ┌───────────────────┼───────────────────┐
                    ↓                   ↓                   ↓
               Execute F1        Execute F2          Execute F3
              (mclaude workers — parallel)
                                        │
                                        ↓
                                   Report to Telegram
```

---

## 4. COMPONENTS

### 4.1 Telegram Command: `/plan`

**Trigger:** `/plan <brief>`

**Flow:**
1. Gateway recebe `/plan <brief>`
2. Extrai brief do texto
3. Cria sessão Plan Mode com session_id
4. Dispara workflow assíncrono
5. Responde ao utilizador com "🔄 Plan Mode ativado — a gerar plano..."

### 4.2 Memory Query (Phase 0)

Executado antes da geração do plano para enriquecer contexto:

```bash
# Query Mem0 para preferências e padrões
mem0 query "<brief>" --limit 5

# Query Qdrant para conhecimento relevante
curl -X POST http://qdrant:6333/collections/hermes/points/search \
  -H "Content-Type: application/json" \
  -d '{"vector": [EMBED], "limit": 10, "filter": {"must": [{"key": "doc_type", "match": {"value": "spec}}}]}}'
```

**Output:** Contexto concatenado para o prompt de geração

### 4.3 SPEC Generator (Phase 1)

**Prompt Template:**

```markdown
# Gerar SPEC de Plano

## Brief Original
{brief}

## Contexto do Sistema (from Memory)
{context}

## Estrutura do SPEC

```markdown
# PLAN-{timestamp}

**Date:** {date}
**Status:** DRAFT
**Type:** Generated Plan

---

## 1. OBJECTIVE
{max 2 frases}

## 2. SCOPE
### In Scope
- ...

### Out of Scope
- ...

## 3. DELIVERABLES
| ID | Deliverable | Type | Priority |
|----|-------------|------|----------|
| D01 | ... | feature/bugfix/doc | P0/P1/P2 |

## 4. TASKS
### Phase 1: Foundation
- [ ] T01 — ...

### Phase 2: Core
- [ ] T02 — ...

### Phase 3: Polish
- [ ] T03 — ...

## 5. ACCEPTANCE CRITERIA
- [ ] AC01: ...
- [ ] AC02: ...

## 6. ESTIMATED EFFORT
- **Tempo:** X dias
- **Complexidade:** Low/Medium/High
- **Riscos:** ...

## 7. TECHNICAL NOTES
...
```

---

## 5. STATE MANAGEMENT

### Session State File
```json
{
  "session_id": "plan-{uuid}",
  "brief": "...",
  "status": "generating|approved|executing|completed|failed",
  "spec_path": "/srv/monorepo/docs/SPECs/PLAN-{uuid}.md",
  "pipeline_path": "/srv/monorepo/.claude/plans/{session_id}/pipeline.json",
  "created_at": "ISO",
  "updated_at": "ISO",
  "current_phase": 0,
  "phases_completed": [],
  "error": null
}
```

### State File Location
`/srv/monorepo/.claude/plans/{session_id}/state.json`

### Transitions
```
generating → approved (user approves) → executing → completed
     ↓                                      ↓
   failed                              failed
```

---

## 6. WORKFLOW

### Step 1: Receive Brief
```bash
# Gateway recebe /plan <brief>
# Cria session_id = plan-{uuid}
# Guarda state.json com status="generating"
# Inicia Phase 0
```

### Step 2: Memory Query (Phase 0)
```bash
# Query Mem0 + Qdrant
# Concatenar contexto
# Guardar em state.json
```

### Step 3: Generate SPEC (Phase 1)
```bash
# mclaude --prompt "Generate SPEC from {brief} with context {context}"
# Output: SPEC.md path
# Guardar spec_path em state.json
```

### Step 4: Generate Pipeline (Phase 2)
```bash
# mclaude --prompt "Generate pipeline.json from {spec_path}"
# Output: pipeline.json with phases
# Guardar pipeline_path em state.json
```

### Step 5: User Approval
```bash
# Enviar SPEC para Telegram
# Aguardar confirmação do utilizador
# Se rejeitado: status="failed", terminar
# Se aprovado: status="approved", continuar
```

### Step 6: Execute Pipeline (Phase 3)
```bash
# Para cada fase do pipeline:
#   mclaude --spec {spec_path} --phase {phase}
#   Guardar resultado em state.json
#   Reportar progresso para Telegram
```

### Step 7: Report Completion
```bash
# Compilar resultados
# Enviar relatório final para Telegram
# Marcar status="completed"
```

---

## 7. ERROR HANDLING

| Error | Action |
|-------|--------|
| Memory query fails | Log warning, continue with empty context |
| SPEC generation fails | Retry 2x, then status="failed" |
| Pipeline generation fails | Retry 2x, then status="failed" |
| Phase execution fails | Log error, mark phase failed, continue next phase |
| User rejects | status="failed", clean up temp files |
| Timeout (>30min) | status="failed", notify user |

---

## 8. TELEGRAM INTEGRATION

### Message Templates

**Activation:**
```
🔄 Plan Mode ativado
Brief: {brief}

A analisar contexto...
```

**Context Ready:**
```
📚 Contexto recolhido
- Mem0: {mem0_count} results
- Qdrant: {qdrant_count} results

A gerar SPEC...
```

**SPEC Ready:**
```
📋 SPEC Gerado — A aguardar aprovação

## {spec_title}

**Objective:** {objective}
**Complexity:** {complexity}
**Est. Time:** {time}

{Tasks summary}

✅ Aprovar | ❌ Rejeitar
```

**Execution Progress:**
```
⚙️ A executar Phase {n}/{total}

[{bar}] {percent}%

{task_name} — {status}
```

**Completion:**
```
✅ Plano concluído!

**Duration:** {duration}
**Phases:** {phases_completed}/{total}
**Deliverables:** {deliverables_count}

📄 {spec_path}
```

**Error:**
```
❌ Plan Mode falhou

**Erro:** {error_message}
**Phase:** {phase}

🔄 Tentar novamente | /cancel
```

---

## 9. FILE STRUCTURE

```
/srv/monorepo/
├── .claude/
│   └── plans/
│       └── {session_id}/
│           ├── state.json
│           ├── spec.md
│           ├── pipeline.json
│           └── logs/
│               ├── phase-0.log
│               ├── phase-1.log
│               ├── phase-2.log
│               └── phase-3.log
├── docs/
│   └── SPECs/
│       └── PLAN-{uuid}.md
└── scripts/
    └── plan-mode.sh
```

---

## 10. INTEGRATION POINTS

### Hermes Gateway
- Listen for `/plan` command
- Create session
- Stream updates to Telegram

### mclaude Workers
- `mclaude --plan-mode --session {session_id} --phase {phase}`
- Read SPEC and context
- Execute tasks
- Write results to state.json

### Memory (Mem0 + Qdrant)
- Query before generation
- Store plan metadata after completion

### Filesystem
- Read: SPECs, AGENTS.md, architecture-map.yaml
- Write: plan session files, logs

---

## 11. DEFINITION OF DONE

- [ ] `/plan <brief>` cria sessão e responde no Telegram
- [ ] Memory query retorna contexto relevante
- [ ] SPEC gerado segue estrutura definida
- [ ] Pipeline.json gerado com fases e dependências
- [ ] Aprovação/rejeição funciona no Telegram
- [ ] Execução de fases funciona via mclaude
- [ ] Progresso reportado em tempo real
- [ ] Relatório final enviado ao utilizador
- [ ] Estado persistido entre sessões
- [ ] Erros tratados e reportados corretamente

---

## 12. SKILL FILE

**Location:** `~/.hermes/skills/plans/plan-mode/SKILL.md`

**Trigger:** `/plan` or "plan mode"

**Steps:** (see skill file for detailed instructions)
