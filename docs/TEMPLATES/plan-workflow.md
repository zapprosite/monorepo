---
name: plan-workflow
description: Workflow for generating PRD documents using /plan command
status: PROPOSED
priority: medium
author: will-zappro
date: YYYY-MM-DD
specRef: SPEC-TEMPLATE.md
---

# /plan — Geração de PRD com Opus 4.6

Gera PRD (Product Requirements Document) a partir de uma ideia ou problema.

## Como Usar

```
/plan [descrição da feature ou problema]
```

Ou em conversa: descrever a feature → usar `/plan` para formalizar.

## Fluxo

1. **Análise:** Opus 4.6 faz discovery e valida suposições
2. **PRD Rascunho:** Gera rascunho em `docs/TEMPLATES/[feature-name].prd.md`
3. **Revisão:** Human aprova ou ajusta
4. **SPEC:** Após aprovação, invocar `/spec` para transformar em SPEC-*.md

## Comandos Relacionados

| Comando | Função |
|---------|--------|
| `/spec` | Transforma PRD aprovado em SPEC-*.md |
| `/pg` | Gera tasks/pipeline.json a partir de SPEC-*.md |
| `/cursor-loop` | Executa tasks do pipeline autonomously |

## Template

Usa `docs/TEMPLATES/PRD-template.md` como base.

## Output

PRD salvo em: `docs/SPECS/[YYYYMMDD]-PRD-[slug].md`
