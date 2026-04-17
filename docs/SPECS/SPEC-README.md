---
name: SPECFLOW README
description: Spec-driven development workflow for homelab-monorepo
type: documentation
---

# Specflow — Spec-Driven Development

Sistema de documentação e rastreamento de features. Garante que cada feature significativa tem uma especificação antes de ser implementada.

## Core Principle

> Nenhuma feature significativa sem SPEC-*.md. Nenhuma task sem referência à SPEC.

## Workflow

```
SPECIFY → PLAN → TASKS → IMPLEMENT → REVIEW → SHIP
```

### Etapas

| Etapa | Ficheiro | Responsável |
|-------|----------|-------------|
| SPECIFY | `SPEC-*.md` | Developer + AI |
| PLAN | `discovery.md` + SPEC | Planner agent |
| TASKS | `SPEC-INDEX.md` + `tasks.md` | pipeline-gen skill (`/pg`) |
| IMPLEMENT | código | feature-developer |
| REVIEW | `reviews/REVIEW-*.md` | code-reviewer agent (`/rr`) |
| SHIP | commit + PR | git-ship workflow |

## Comandos

| Comando | Descrição |
|---------|-----------|
| `/spec` | Inicia workflow spec-driven (spec-driven-development skill) |
| `/md` | Modo dormir: escaneia SPECs pendentes e gera pipeline |
| `/pg` | Pipeline gen: gera tasks a partir de SPECs → atualiza `SPEC-INDEX.md` |
| `/rr` | Code review: gera `reviews/REVIEW-*.md` |
| `/se` | Secrets audit: scan antes de push |

## Ficheiros

```
docs/SPECS/
├── SPEC-README.md              ← Este ficheiro
├── SPEC-TEMPLATE.md            ← Template para novas SPECs
├── SPEC-INDEX.md               ← Índice auto-gerado de todas as SPECs
├── SPEC-001-workflow-performatico.md
├── SPEC-002-homelab-network-refactor.md
├── ...
├── discovery.md                ← Decisões de arquitetura
├── tasks.md                    ← Tarefas extraídas das SPECs (gerado)
└── reviews/
    ├── REVIEW-GUIDE.md         ← Como fazer reviews
    └── REVIEW-001-*.md          ← Output do code-reviewer
```

## Status Values

| Status | Meaning |
|--------|---------|
| `DRAFT` | Initial write-up, not yet reviewed |
| `REVIEW` | Under review by team/agent |
| `APPROVED` | Reviewed and accepted for implementation |
| `IMPLEMENTING` | Currently being implemented |
| `DONE` | Fully implemented and verified |
| `STALE` | Was DRAFT/IMPLEMENTING, now outdated |
| `PROTEGIDO` | Protected document — do not alter without approval |

## Relationship with ADRs

SPECs e ADRs servem propósitos diferentes mas complementares:

| Aspect | SPEC | ADR |
|--------|------|-----|
| **Purpose** | Feature specification | Architecture decision |
| **Scope** | One feature or change | Cross-cutting concern |
| **Format** | User stories, goals, acceptance criteria | Context, decision, consequences |
| **Lifecycle** | evolves from DRAFT → DONE | decisions are immutable (unless superseded) |
| **Question** | "What are we building?" | "Why did we choose X over Y?" |

### When to Create Each

- **SPEC**: When starting a new feature, enhancement, or significant change
- **ADR**: When an architecture decision is made that affects multiple SPECs or has long-term implications

### Cross-Reference

When a SPEC references an architecture decision, include the ADR link:

```markdown
**Related:** ADR-001 (governance), SPEC-002 (parent)
```

When an ADR is created from a SPEC decision, note it in the SPEC:

```markdown
**Related ADR:** [20260404-voice-dev-pipeline](../ADRs/20260404-voice-dev-pipeline.md)
```

## Regras

1. Cada feature nova → criar `SPEC-NNN-nome.md`
2. Após 3+ SPECs → executar `/pg` para atualizar `tasks.md` + `SPEC-INDEX.md`
3. Antes de commit → executar `/rr` e guardar em `reviews/`
4. Modo dormir escaneia SPECs automaticamente às 3h
5. SPECs com status `STALE` por >30 dias devem ser arquivadas ou atualizadas

## SPEC Lifecycle

```
     ┌──────────────────────────────────────────────────────┐
     │                                                      │
     ▼                                                      │
  DRAFT ──► REVIEW ──► APPROVED ──► IMPLEMENTING ──► DONE  │
     │         │                                            │
     │         ▼                                            │
     │      STALE                                           │
     │                                                        │
     │                                    PROTEGIDO ─────►   │
     │                                      (special state)  │
     └──────────────────────────────────────────────────────┘
```

## Integração com Agentes

| Agent | Skill | Trigger |
|-------|-------|---------|
| `modo-dormir` | `/md` | Scheduled cron (3h) |
| `planner` | `/spec` | On-demand |
| `code-reviewer` | `/rr` | Before commit |
| `pipeline-gen` | `/pg` | After SPEC changes |
| `secrets-audit` | `/se` | Before push |

## Creating a New SPEC

1. Copy `SPEC-TEMPLATE.md` to `SPEC-NNN-descriptive-name.md`
2. Fill in all sections — minimum: Objective, Tech Stack, Success Criteria, Open Questions
3. Set status to `DRAFT`
4. Execute `/pg` to update `SPEC-INDEX.md`
5. Review with team/agent
6. Change status to `REVIEW`, then `APPROVED`

## Protected SPECs

SPECs marked `PROTEGIDO` contain critical system configurations that must not be altered without explicit approval:

- `SPEC-004-kokoro-tts-kit.md` — TTS voice stack
- `SPEC-005-wav2vec2-stt-kit.md` — STT voice stack
- `SPEC-009-Hermes Agent-persona-audio-stack.md` — Hermes Agent audio configuration
