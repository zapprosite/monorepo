---
name: SPEC Template
description: Template for feature specifications
type: specification
---

# SPEC-NNN: [Feature Name]

**Status:** DRAFT | REVIEW | APPROVED | IMPLEMENTING | DONE
**Created:** YYYY-MM-DD
**Author:** will
**Related:** SPEC-XXX (parent), SPEC-YYY (child)

---

## User Story

Como **[tipo de utilizador]**, quero **[ação/funcionalidade]**, para **[benefício/valor]**.

---

## Overview

[Descrição curta do que esta feature faz e por que existe.]

---

## Goals

### Must Have (MVP)
- [ ] Critério 1
- [ ] Critério 2

### Should Have
- [ ] Critério 3

### Could Have
- [ ] Critério 4

---

## Non-Goals

[O que esta feature NÃO inclui — definir limites.]

---

## User Flows

```
[Fluxo do utilizador em formato texto/ASCII]

1. Step 1
2. Step 2
3. Step 3
```

---

## API Design (se aplicável)

### Endpoints

| Method | Path | Description |
|--------|-------|-------------|
| GET | `/api/resource` | Lista recursos |
| POST | `/api/resource` | Cria recurso |

### Request/Response Shapes

```typescript
// Request
interface CreateResourceRequest {
  name: string;
  type: "A" | "B";
}

// Response
interface ResourceResponse {
  id: string;
  name: string;
  createdAt: Date;
}
```

---

## Data Model (se aplicável)

```typescript
// Schema ou tabela relacionada
// Orchid ORM table definition
```

---

## Acceptance Criteria

| # | Critério | Test |
|---|----------|------|
| AC-1 | [Critério verificável] | [Como testar] |
| AC-2 | [Critério verificável] | [Como testar] |

---

## Edge Cases

| Caso | Comportamento esperado |
|------|----------------------|
| Empty state | [O que acontece] |
| Error state | [O que acontece] |
| Race condition | [O que acontece] |

---

## Security Considerations

- [Consideração 1]
- [Consideração 2]

---

## Decisions Log

| Data | Decisão | Rationale |
|------|---------|-----------|
| YYYY-MM-DD | Decisão | Porque |

---

## Dependencies

| Dependência | Status | Notes |
|-------------|--------|-------|
| SPEC-XXX | APPROVED | [Notas] |
| Infra: X | PENDING | [Notas] |

---

## Checklist

- [ ] SPEC escrita e revisada
- [ ] Architecture decisions documented
- [ ] API design approved
- [ ] Acceptance criteria testáveis
- [ ] Dependencies identificadas
- [ ] Security review done
- [ ] Tasks geradas via `/pg`
