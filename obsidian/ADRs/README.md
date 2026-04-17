# Architecture Decision Records (ADRs)

**Location:** `docs/ADRs/`
**Status:** 1 ADR created — see below

---

## Current State

This folder contains **4 files** — 1 ADR created:

| File                                          | Description                                       |
| --------------------------------------------- | ------------------------------------------------- |
| `ADR-001-denv-as-canonical-secrets-source.md` | .env as canonical secrets source (Infisical sync) |
| `ADR-TEMPLATE.md`                             | Full MADR template (21 sections, comprehensive)   |
| `TEMPLATE.md`                                 | Simple template (8 sections, lightweight)         |
| `README.md`                                   | This file                                         |

---

## ADRs

### ADR-001 — .env as Canonical Secrets Source

**Status:** aceito
**Date:** 2026-04-13
**Author:** Principal Engineer
**Spec:** SPEC-029-INFISICAL-SDK-MANDATORY.md

**Summary:** All secrets are stored in `.env` (synced from Infisical). Application code reads secrets via `os.getenv()`, never directly from Infisical SDK.

See: `ADR-001-denv-as-canonical-secrets-source.md`

---

## Templates Available

### ADR-TEMPLATE.md (Canonical — Use This One)

Full [MADR](https://adr.github.io/madr/) format with 21 sections:

- Title, Status, Date, Author, SPEC Ref
- Context, Decision, Consequences
- Pros/Cons grid, Alternatives, Trade-offs
- Implementation Notes, Error Handling, Monitoring
- Related ADRs, References, Notes

**Recommended** for all new ADRs. Use this unless you have a specific reason not to.

### TEMPLATE.md (Simple Format)

Lightweight 8-section template:

- Context, Decision, Consequences (positives/negatives)
- Alternatives, References

**Use for** quick decisions or when MADR overhead is not justified.

---

## How to Create a New ADR

1. Copy `ADR-TEMPLATE.md` to `NNN-titulo-descritivo.md`
2. Fill in all sections using the MADR format
3. Number sequentially (001, 002, ...)
4. Set status: `proposto`, `aceito`, `depreciado`, `substituído`

**Naming convention:**

```
ADR-001-nome-da-decisao.md
ADR-002-Hermes Agent-oauth-mvp.md
```

---

## Spec-Driven ADR Creation

ADRs are typically generated from SPEC slices:

```
SPEC-*.md (Goals section)
    │
    ├── Must Have → ADR-001-NNN-mvp.md
    ├── Should Have → ADR-002-NNN-should.md
    └── Could Have → ADR-003-NNN-could.md
```

**Workflow:**

1. `/spec <descrição>` generates a SPEC with slices
2. Each slice becomes an ADR in `docs/ADRs/`
3. `/pg` generates `tasks/pipeline.json` from the ADRs

---

## ADR Status Lifecycle

| Status        | Meaning                        |
| ------------- | ------------------------------ |
| `proposto`    | Under review, not yet accepted |
| `aceito`      | Approved and implemented       |
| `depreciado`  | No longer recommended          |
| `substituído` | Replaced by another ADR        |

---

## Format

We use the [MADR](https://adr.github.io/madr/) format (Markdown Any Decision Records).
Canonical template: `ADR-TEMPLATE.md` (21-section full format).
