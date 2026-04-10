---
name: Tasks
description: Master task list extracted from SPECs
type: task-tracking
---

# Tasks — Generated from SPECs

**Last Updated:** YYYY-MM-DD HH:mm
**Source:** SPECs em `docs/specflow/SPEC-*.md`
**Generator:** `/pg` (pipeline-gen skill)

---

## Como Usar

- Este ficheiro é **gerado automaticamente** pelo `/pg`
- **NÃO editar manualmente** — edits serão sobrescritos
- Para adicionar tasks → criar/editar SPEC-*.md e rodar `/pg`

---

## Task Format

```markdown
- [ ] **[SPEC-001:AC-1]** Description — Acceptance criterion from SPEC
```

---

## Backlog

### Alta Prioridade

- [ ] **[SPEC-001:AC-1]** Implementar endpoint POST /api/resource
- [ ] **[SPEC-001:AC-2]** Criar tabela resource no banco

### Média Prioridade

- [ ] **[SPEC-001:AC-3]** Adicionar validação Zod no request

### Baixa Prioridade

- [ ] **[SPEC-002:AC-1]** Documentar API no Swagger

---

## Em Progresso

- [ ] **[SPEC-001:AC-1]** [Em implementação]

---

## Done

- [x] **[SPEC-001:AC-0]** Setup inicial do módulo

---

## Stats

| Métrica | Valor |
|---------|-------|
| Total tasks | N |
| Alta prioridade | N |
| Em progresso | N |
| Done | N |

---

## Pipeline

```
Discovery → SPEC → TASKS → IMPLEMENT → REVIEW → SHIP
    ↑___________/[ regenerate via /pg ]___________↑
```
