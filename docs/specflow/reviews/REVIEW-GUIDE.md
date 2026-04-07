---
name: Review Guide
description: Code review gate process for specflow
type: process
---

# Review Guide — Code Review Gate

## Quando Fazer Review

Antes de fazer merge para `main`, SEMPRE. Reviews são gatekeeper de qualidade.

## Fluxo

```
IMPLEMENT → /rr → REVIEW-*.md → Human Approval → SHIP
```

## Como Executar

```bash
# Review rápido (últimos 5 commits)
/rr

# Review de uma SPEC específica
/rr --spec SPEC-001

# Review antes de ship
/rr --strict
```

## Output

O `/rr` gera `docs/specflow/reviews/REVIEW-*.md`:

```markdown
## Review Summary

**Verdict:** APPROVE | REQUEST CHANGES | REJECT

**SPEC:** SPEC-001
**Author:** will
**Reviewer:** Claude Code + human

### Critical Issues
- [ ]

### Important Issues
- [ ]

### Suggestions
- [ ]

### What's Done Well
- [ ]

### Verification
- [ ] Code compiles
- [ ] Tests pass
- [ ] SPEC acceptance criteria met
```

## Gate Criteria

Para APPROVE, todos os **Critical** e **Important** issues devem estar resolvidos.

| Issue Type | Blocker? |
|------------|----------|
| Critical | SIM — não pode shipar |
| Important | SIM — deve ser resolvido ou documentado |
| Suggestion | NÃO — pode shipar sem |

## Antes de Commit

- [ ] Review feito (`/rr`)
- [ ] VERDICT = APPROVE
- [ ] Critical issues resolvidos
- [ ] Human sign-off dado
- [ ] SPEC acceptance criteria verificadas

## Agentes de Review

| Agent | Quando |
|-------|--------|
| `code-reviewer` | Review automático via `/rr` |
| `security-audit` | OWASP checklist via `/sa` |
| `review-zappro` | Deep review Portuguese output |

## Formatos Suportados

- `/rr` → Code review
- `/sa` → Security audit
- `/dv` → Deploy validation

## Links

- SPEC-TEMPLATE.md — Como criar SPECs
- SPEC-README.md — Sistema completo
