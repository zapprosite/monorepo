---
name: SPEC Template
description: Template for feature specifications in specflow
type: specification
---

# SPEC-NNN: [Feature Name]

**Status:** DRAFT | REVIEW | APPROVED | IMPLEMENTING | DONE | STALE | PROTEGIDO
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD
**Author:** will
**Related:** SPEC-XXX (parent), SPEC-YYY (child), ADR-NNN

---

## Objective

[One-paragraph description of what this feature does and why it exists. Who benefits and how.]

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| _Component_ | _Tech_ | _Usage_ |

---

## Commands

```bash
# Command 1
command --flag arg

# Command 2
command2 --flag arg
```

---

## Project Structure

```
path/to/project/
├── file1.ts           # Purpose
├── file2.py           # Purpose
└── subdir/
    └── file3.ts       # Purpose
```

---

## Code Style

### Naming Conventions

- Files: `kebab-case.ts`
- Functions: `camelCase()`
- Types/Classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Key Patterns

```typescript
// Example pattern for this feature
interface FeatureConfig {
  enabled: boolean;
  timeout: number;
}
```

---

## Testing Strategy

| Level | Scope | Framework |
|-------|-------|-----------|
| Unit | Isolated logic | `pytest` / `vitest` |
| Integration | Against real services | `pytest --integration` |
| Smoke | Quick health check | `pytest --smoke` |
| E2E | Full user flow | `playwright` / `curl` |

### Coverage Target

- Minimum: 80% for new code
- Critical paths: 100%

---

## Boundaries

### Always

- [Boundary that must be respected]
- [Another must-have]

### Ask First

- [Action requiring human approval]
- [Another requiring consultation]

### Never

- [Forbidden action]
- [Another prohibited action]

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | [Measurable outcome] | [How to verify] |
| SC-2 | [Measurable outcome] | [How to verify] |

---

## Open Questions

| # | Question | Impact | Priority |
|---|----------|--------|----------|
| OQ-1 | [Question] | [High/Med/Low] | [Critical/High/Med/Low] |

---

## User Story

Como **[tipo de utilizador]**, quero **[ação/funcionalidade]**, para **[benefício/valor]**.

---

## Goals

### Must Have (MVP)

- [ ] Criterion 1
- [ ] Criterion 2

### Should Have

- [ ] Criterion 3

### Could Have

- [ ] Criterion 4

---

## Non-Goals

[What this feature does NOT include — define boundaries.]

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | [Verifiable criterion] | [How to test] |
| AC-2 | [Verifiable criterion] | [How to test] |

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| SPEC-XXX | APPROVED | [Notes] |
| Infra: X | PENDING | [Notes] |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| YYYY-MM-DD | Decision | Why it was made |

---

## Checklist

- [ ] SPEC written and reviewed
- [ ] Architecture decisions documented
- [ ] Acceptance criteria are testable
- [ ] Dependencies identified
- [ ] Security review done (if applicable)
- [ ] Tasks generated via `/pg`
