# RESEARCH-6: Memory System Patterns for AI Agents

**Date:** 2026-04-17
**Focus:** Memory/index structure, context optimization, knowledge persistence
**Status:** Complete

---

## 1. Key Findings (April 2026 Best Practices)

### 1.1 4-Layer Memory Architecture (SPEC-036)

O sistema atual implementa uma arquitetura de memória de 4 camadas:

| Layer              | Technology            | Purpose                | Persistence       |
| ------------------ | --------------------- | ---------------------- | ----------------- |
| **L1: Short-term** | Context window        | Sessão atual           | In-memory         |
| **L2: Semantic**   | Qdrant (vector DB)    | Busca por similaridade | Disco             |
| **L3: Episodic**   | memory-keeper SQLite  | Eventos/episódios      | Backup diário 3AM |
| **L4: Procedural** | CLAUDE.md + AGENTS.md | Regras + skills        | Git versioned     |

### 1.2 Current Memory Index Structure

```
~/.claude/projects/-srv-monorepo/memory/
├── MEMORY.md                    # Índice central (200 linhas max)
├── ai-context.md                # Pipeline AI-CONTEXT → memory
├── architecture.md              # Arquitetura do sistema
├── development-workflow.md      # Workflow de desenvolvimento
├── docs-index.md                # Índice da documentação
├── glossary.md                  # Glossário de termos
├── project-overview.md          # Visão geral do projeto
├── workflow.md                  # Workflow principal
├── specs/                       # SPECs com memória
├── skills/                      # Skill guides
├── archive/                     # Docs arquivados
└── *.md                         # Memórias avulsas (homelab-estado, incidents, etc)
```

### 1.3 Memory Index Format (Frontmatter Pattern)

```markdown
---
name: memory-name
description: One-line description for relevance checking
type: user|feedback|project|reference
originSessionId: uuid (optional)
---

# Memory Title

Content...
```

**Tipos de memória:**

- `user` — Perfil do usuário, preferências, expertise
- `feedback` — Correções e confirmações (com **Why:** e **How to apply:** lines)
- `project` — Estado atual de projetos, bugs, incidentes
- `reference` — Pointers para sistemas externos

### 1.4 Cron Jobs for Memory Sync

| Job ID              | Schedule     | Action                         |
| ------------------- | ------------ | ------------------------------ |
| `f72c7852`          | Every 30 min | Sync docs → memory             |
| `614f0574`          | Every 30 min | Check pendings + sync          |
| `modo-dormir-daily` | 3 AM         | Scan SPECs + generate pipeline |

### 1.5 Memory Sync Pipeline

```
docs/SPECS/SPEC-*.md  →  ai-context MCP  →  memory/
                                             ↓
                                      MEMORY.md (index)
```

---

## 2. Specific Recommendations for CLAUDE.md / AGENTS.md

### 2.1 ADD: Memory Sync Section in CLAUDE.md

**Local:** `.claude/CLAUDE.md` → Auto-Orquestration section

````markdown
## Memory Sync (Auto-Orquestration)

### 4-Layer Memory Architecture

| Layer | Tech                   | Purpose             |
| ----- | ---------------------- | ------------------- |
| L1    | Context window         | Sessão atual        |
| L2    | Qdrant                 | Semantic search     |
| L3    | SQLite (memory-keeper) | Episodic backup 3AM |
| L4    | CLAUDE.md + AGENTS.md  | Procedural rules    |

### Memory Files Location

- **Index:** `~/.claude/projects/-srv-monorepo/memory/MEMORY.md`
- **Individual:** `~/.claude/projects/-srv-monorepo/memory/*.md`

### Sync Commands

```bash
/ai-context              # Manual sync (Claude Code CLI)
/sync-memory             # Via cron job (30 min)
```
````

### When to Update Memory

- Após implementar feature (commit + merge)
- Após mudança de infraestrutura
- Antes de sessão longa
- Quando memória está stale (>7 dias)

### Memory File Format

```markdown
---
name: filename
description: One-line relevance hook
type: user|feedback|project|reference
---

# Title

Content with **Why:** and **How to apply:** for feedback/project types.
```

````

### 2.2 ADD: Memory Types Quick Reference in CLAUDE.md

**Adicionar à secção "Regra de Consulta Obrigatória (ANTI-ALUCINAÇÃO)":**

```markdown
### Memory Check Order
1. **`.env`** — secrets, tokens, API keys
2. **`MEMORY.md`** — estado atual do projeto, sessões passadas
3. **`.claude/skills/`** — skill existente cobre a tarefa?
4. **`AGENTS.md`** — workflow ou skill já definido?
5. **`.claude/CLAUDE.md`** — regra já existe?

### Memory Types (what to save)
| Type | When | Example |
|------|------|---------|
| `user` | User role/preferences | "User is a data scientist" |
| `feedback` | Corrections/confirmations | "Don't mock DB in tests" |
| `project` | Active work state | "SPEC-060 tasks 60-63 done" |
| `reference` | External system pointers | "Bugs tracked in Linear INGRESS" |
````

### 2.3 UPDATE: MEMORY.md Index Limit Enforcement

**Problema atual:** MEMORY.md tem 216 linhas (limite: 200)

**Solução:** Criar memória `MEMORY-MAINTENANCE.md` para históricos antigos:

```markdown
---
name: memory-maintenance-guide
description: Rules for keeping MEMORY.md under 200 lines
type: reference
---

# Memory Maintenance Rules

## Line Limit: 200 characters per entry

**Rule:** Each MEMORY.md entry must fit in one line (~150 chars max).

**Format:** `- [Title](file.md) — one-line hook`

## When Entries Grow Too Large

Move detail into topic files:

- Long incident reports → `incidents.md`
- Detailed SPEC status → `specs/SPEC-*.md`
- User preferences → `user.md`

## Prune Criteria

- Entrada com mais de 7 dias sem referência → archive/
- Entrada duplicada → manter uma, remover outra
- Entrada obsoleta (ex: OpenClaw deprecated) → archive/
```

### 2.4 ADD: Memory Persistence Best Practices in AGENTS.md

**Adicionar à secção de Specflow:**

````markdown
## Memory Persistence Pattern

### After Every Commit (Automatic via Cron)

```bash
/sync-memory  # or /ai-context
```
````

### Memory Index Update Rules

1. **New SPEC** → Add entry to MEMORY.md index
2. **SPEC completed** → Update entry, move detail to `specs/SPEC-*.md`
3. **Incident resolved** → Move detail to `incidents.md`, simplify index
4. **Weekly:** Run `archive-old-memories.sh`

### Knowledge Persistence Across Sessions

- **Qdrant:** Semantic search for technical knowledge
- **memory-keeper:** SQLite episodic backup (daily 3AM)
- **CLAUDE.md/AGENTS.md:** Git-versioned procedural memory
- **MEMORY.md:** Session state index

````

---

## 3. Code/Pattern Examples

### 3.1 Agent State Coordination (Filesystem-Based)

Os 14 agentes do orchestrator usam filesystem para coordenação:

```bash
# Agent states directory
agent-states/
├── SPEC-ANALYZER/  → {status, result, error}
├── ARCHITECT/       → {status, result, error}
├── CODER-1/         → {status, result, error}
...
└── SHIPPER/         → waits for all others
````

**Benefit:** Stateless agents with persistent state via filesystem.

### 3.2 Memory File Frontmatter Template

```markdown
---
name: { { memory-name-kebab-case } }
description: { { one-line description for relevance filtering } }
type: user|feedback|project|reference
originSessionId: { { uuid of creating session } } # optional
---

# {{Title}}

## Rule/Fact

{{The actual content}}

**Why:** {{Reason/context - why this was saved}}

**How to apply:** {{When/where this guidance applies}}
```

### 3.3 Cron Job Configuration for Memory Sync

```bash
# /etc/crontab or cron system
# Memory sync every 30 minutes
*/30 * * * * claude /sync-memory

# Deep sync every 6 hours
0 */6 * * * claude /ai-context --deep
```

---

## 4. What to Add/Update/Delete

### ADD (New Memory Patterns)

| Item                       | Location                       | Reason                        |
| -------------------------- | ------------------------------ | ----------------------------- |
| Memory sync section        | `.claude/CLAUDE.md`            | Document 4-layer architecture |
| Memory types reference     | `.claude/CLAUDE.md`            | Anti-alucinação enhancement   |
| Memory maintenance guide   | `memory/MEMORY-MAINTENANCE.md` | Keep index under 200 lines    |
| Memory persistence section | `AGENTS.md`                    | Document post-commit sync     |

### UPDATE (Existing)

| Item                                   | Current              | Proposed                                      |
| -------------------------------------- | -------------------- | --------------------------------------------- |
| MEMORY.md                              | 216 lines, truncated | Enforce 200 line limit via maintenance guide  |
| `.claude/CLAUDE.md` Auto-Orquestration | Basic cron list      | Add memory layer architecture + sync commands |
| `AGENTS.md` Specflow                   | Basic SPEC workflow  | Add memory persistence pattern                |

### DELETE (Cleanup)

| Item                                                            | Reason                                    |
| --------------------------------------------------------------- | ----------------------------------------- |
| `memory/archive/` entries >60 days old                          | Rot, not actionable                       |
| `memory/skills/` skill guides (duplicated in `.claude/skills/`) | Single source of truth                    |
| `memory/specs/SPEC-OLD*.md` (SPEC-005, SPEC-031, SPEC-033)      | Already archived in `docs/SPECS/archive/` |

---

## 5. Integration with 14-Agent Orchestrator

### Memory Flow During /execute

```
1. SPEC created → memory/specs/SPEC-*.md
2. /pg generates pipeline → tasks/pipeline.json
3. 14 agents run in parallel
   ├── Each writes to agent-states/
   └── Each updates memory/ if significant findings
4. SHIPPER creates PR → triggers /sync-memory
5. Cron syncs docs → memory (30 min)
```

### Agent Memory Responsibilities

| Agent         | Memory Action                                    |
| ------------- | ------------------------------------------------ |
| SPEC-ANALYZER | Creates `specs/SPEC-*.md`                        |
| ARCHITECT     | Updates `specs/SPEC-*-ARCHITECTURE.md` if needed |
| CODER-1/2     | May create `specs/SPEC-*-IMPLEMENTATION.md`      |
| DOCS          | Updates `docs-index.md`                          |
| SHIPPER       | Triggers `/ai-context` post-PR                   |

---

## 6. Recommendations Summary

### Priority 1 (Critical for Enterprise Refactor)

1. **Create `MEMORY-MAINTENANCE.md`** — enforce 200-line index limit
2. **Add memory layer documentation to CLAUDE.md** — 4-layer architecture
3. **Add memory types to anti-alucinação section** — what/when to save

### Priority 2 (Enhancement)

4. **Add memory persistence section to AGENTS.md** — post-commit sync
5. **Prune old memories** — archive/ entries >60 days
6. **Update cron description** — add memory sync jobs

### Priority 3 (Future)

7. **Implement auto-prune** — script to archive stale memories
8. **Add Qdrant integration** — semantic search for specs
9. **Memory freshness indicator** — show days since last sync

---

## 7. Files Referenced

- `/srv/monorepo/.claude/CLAUDE.md` — Current monorepo rules
- `/srv/monorepo/AGENTS.md` — Current agent system
- `/srv/monorepo/.claude/skills/orchestrator/SKILL.md` — 14-agent orchestrator
- `~/.claude/projects/-srv-monorepo/memory/MEMORY.md` — Memory index
- `~/.claude/projects/-srv-monorepo/memory/ai-context.md` — AI-CONTEXT pipeline
- `~/.claude/projects/-srv-monorepo/memory/specs/SPEC-036-infinite-memory-architecture.md` — 4-layer architecture spec
- `/srv/monorepo/docs/SPECS/SPEC-ENTERPRISE-REFACTOR-2026-04-17.md` — This research context
