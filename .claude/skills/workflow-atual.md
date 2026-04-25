---
name: workflow-atual
description: Mostra workflow atual e progresso
trigger: /workflow-atual
version: 1.0.0
type: skill
owner: SRE-Platform
---

# /workflow-atual — Workflow Atual

## Quando Usar
- Quer ver progresso do trabalho atual
- Está no meio de uma implementação
- Quer saber quanto falta

## O que Mostra

1. **SPEC em foco**
   - Nome e descrição
   - Acceptance criteria
   - Progresso (X/Y completadas)

2. **Tarefas**
   - Pending: X tasks
   - Running: Y tasks
   - Done: Z tasks
   - Failed: W tasks

3. **Phase atual**
   - PREVC: P→R→E→V→C
   - Fase atual destacada

## Visualização

```
┌──────────────────────────────────────┐
│ WORKFLOW ATUAL                       │
├──────────────────────────────────────┤
│ SPEC: SPEC-999                       │
│ Progresso: ████████░░ 80%             │
│ AC: 4/5 completadas                 │
├──────────────────────────────────────┤
│ FASE: Execute                        │
│ [P] → [R] → [E]● → [V] → [C]        │
├──────────────────────────────────────┤
│ TASKS                                │
│ ████░░░░░░ 4 done                   │
│ ██░░░░░░░░ 2 running                │
│ ░░░░░░░░░░ 4 pending                │
└──────────────────────────────────────┘
```

## Como Usar

```
/workflow-atual
```
