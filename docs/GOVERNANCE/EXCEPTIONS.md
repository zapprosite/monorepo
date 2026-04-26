# exceptions

Documented exceptions to the Infisical SDK mandatory policy.

**Spec:** SPEC-029-INFISICAL-SDK-MANDATORY.md
**Last updated:** 2026-04-12

---

## Active Exceptions

| Secret | Reason | APPROVED_BY | EXPIRES | Mitigation |
|--------|--------|-------------|---------|------------|
| None currently | - | - | - | - |

---

## Expired Exceptions

| Secret | Reason | APPROVED_BY | EXPIRES | Notes |
|--------|--------|-------------|---------|-------|
| None | - | - | - | - |

---

## How to Add an Exception

1. Edit this file
2. Add row to Active Exceptions table
3. Include justification
4. Add expiry date (max 30 days from approval)
5. Create tracking issue in `docs/GOVERNANCE/EXCEPTIONS.md`

Example:

```markdown
| `COOLIFY_API_KEY` | Bootstrap script runs before Infisical init | will-zappro | 2026-05-12 | Migrate bootstrap-emitter.sh to use InfisicalClient |
```

---

## Review Process

- Exceptions reviewed monthly
- Will-zappro approves all exceptions
- Unreviewed exceptions after expiry = automatic revocation

---

**Authority:** will-zappro
