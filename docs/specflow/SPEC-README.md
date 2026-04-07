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
| TASKS | `tasks.md` | pipeline-gen skill |
| IMPLEMENT | código | feature-developer |
| REVIEW | `reviews/REVIEW-*.md` | code-reviewer agent |
| SHIP | commit + PR | git-ship workflow |

## Comandos

| Comando | Descrição |
|---------|-----------|
| `/spec` | Inicia workflow spec-driven (spec-driven-development skill) |
| `/md scan` | Modo dormir: escaneia SPECs pendentes e gera pipeline |
| `/pg` | Pipeline gen: gera tasks a partir de SPECs |
| `/rr` | Code review: gera REVIEW-*.md |

## Ficheiros

```
docs/specflow/
├── SPEC-README.md           ← Este ficheiro
├── SPEC-TEMPLATE.md         ← Template para novas SPECs
├── SPEC-001-exemplo.md      ← Exemplo de SPEC
├── discovery.md             ← Decisões de arquitetura
├── tasks.md                 ← Tarefas extraídas das SPECs
└── reviews/
    ├── REVIEW-GUIDE.md      ← Como fazer reviews
    └── REVIEW-001.md        ← Output do code-reviewer
```

## Regras

1. Cada feature nova → criar `SPEC-NNN-nome.md`
2. Após 3+ SPECs → executar `/pg` para atualizar `tasks.md`
3. Antes de commit → executar `/rr` e guardar em `reviews/`
4. Modo dormir escaneia SPECs automaticamente às 3h

## Integração com Agentes

- `modo-dormir` — Escaneia SPECs e gera pipeline.json
- `planner` — Cria SPEC a partir de requirements
- `code-reviewer` — Gera REVIEW-*.md
- `spec-driven-development` skill — Fluxo completo
