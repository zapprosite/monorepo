---
name: SPEC-GOV-001
description: Reconcile SPEC index governance — ACTIVE.md vs INDEX.md
status: draft
owner: platform
created: 2026-04-27
---

# SPEC-GOV-001 — SPEC Index Governance Reconciliation

## Problem

`docs/SPECS/ACTIVE.md` and `docs/SPECS/INDEX.md` are in conflict:

- `ACTIVE.md` declares `SPEC-001..004` as canonical, all others as historical/implementation-note
- `INDEX.md` still lists 22 specs as "Active", including SPEC-068, 090, 091, 092, 093, 106, 115, 120, 130, 135, 200, 202, 203
- The `docs/SPECS/` directory has no `_legacy/` folder — legacy specs are mixed with active ones

This creates confusion about which specs drive implementation.

## Solution

Reconcile the two files so `INDEX.md` obeys `ACTIVE.md` as the source of truth, and introduce a domain/product namespace for new specs.

### Changes

**1. ACTIVE.md** — no structural changes, minor wording improvements for clarity

**2. INDEX.md** — major rewrite**
   - Remove all specs that ACTIVE.md marks as historical/implementation-note
   - Keep only SPEC-001, 002, 003, 004 as Active
   - Mark others as `historical`, `implementation-note`, or `superseded` per ACTIVE.md's classification
   - Add `products/` namespace section for domain-specific specs (e.g., HVAC, Voice, etc.)
   - Add `_legacy/` folder note pointing to `docs/SPECS/archive/`

**3. Create `docs/SPECS/_legacy/README.md`**
   - Explains the legacy directory purpose
   - Lists migrated specs with their canonical successors

### Domain/Product Namespace

New specs follow a `products/<domain>/SPEC-<DOMAIN>-NNN.md` pattern:

```
products/
  HVAC/
    SPEC-HVAC-001-rag-ingestion.md
    SPEC-HVAC-002-openwebui-faq.md
    SPEC-HVAC-003-evaluation-suite.md
```

## Acceptance Criteria

1. `INDEX.md` shows exactly 4 Active specs: SPEC-001, 002, 003, 004
2. All other previously-Active specs appear under Historical or Implementation Notes
3. `docs/SPECS/_legacy/README.md` exists and documents the migration rationale
4. No Active spec is accidentally marked as historical
5. No new spec number collides with existing canonical specs
