# exceptions

Documented exceptions to the .env canonical secrets policy.

**Spec:** SPEC-029-INFISICAL-SDK-MANDATORY.md, ADR-001
**Last updated:** 2026-04-13

---

## Active Exceptions

| Secret         | Reason | APPROVED_BY | EXPIRES | Mitigation |
| -------------- | ------ | ----------- | ------- | ---------- |
| None currently | -      | -           | -       | -          |

---

## Expired Exceptions

| Secret | Reason | APPROVED_BY | EXPIRES | Notes |
| ------ | ------ | ----------- | ------- | ----- |
| None   | -      | -           | -       | -     |

---

## How to Add an Exception

1. Edit this file
2. Add row to Active Exceptions table
3. Include justification
4. Add expiry date (max 30 days from approval)
5. Create tracking issue in `docs/GOVERNANCE/EXCEPTIONS.md`

Example:

```markdown
| `LEGACY_SYSTEM_TOKEN` | Legacy system requires direct env var access during migration | Principal Engineer | 2026-05-13 | Migrate to .env pattern after legacy deprecation |
```

---

## Review Process

- Exceptions reviewed monthly
- Principal Engineer approves all exceptions
- Unreviewed exceptions after expiry = automatic revocation

---

**Authority:** Platform Governance
