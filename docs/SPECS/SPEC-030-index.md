# SPEC Index — Zappro Monorepo
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab

**Updated:** 2026-04-29
**Per:** SPEC-009 stuck recovery + SPEC-010 creation (post-audit)
**Canonical source:** `/srv/monorepo/AGENTS.md`

---

## Active SPECs (11)

| # | Title | Status | Notes |
|---|-------|--------|-------|
| SPEC-002-homelab-control-plane.md | Homelab Monitor Agent | DRAFT | |
| SPEC-002-homelab-control-plane.md | Homelab Infrastructure Refactoring | DRAFT | |
| SPEC-004-autonomous-execution-pipeline.md | Playwright E2E + Chrome Extension Testing | DRAFT | |
| SPEC-006-multi-agent-architecture.md | Shadow Context Blueprint | STUCK | Phase execute stuck 2026-04-29; queue.json frozen |
| SPEC-005-langgraph-circuit-breaker.md | Monorepo Hardening Fix Pack | PROPOSED | **CRITICAL** — post-audit fixes, hard stop before new features |
| SPEC-012-ecosystem-architecture.md | Claude Code CLI Integration | REVIEW | |
| SPEC-012-ecosystem-architecture.md | Cursor AI CI/CD Pattern | DRAFT | |
| SPEC-012-ecosystem-architecture.md | Gitea Actions Enterprise | DRAFT | |
| SPEC-004-autonomous-execution-pipeline.md | Unified Pipeline Bootstrap | IMPLEMENTING | |

> **Note:** `IMPLEMENTING` and `REVIEW` are legacy statuses from before the canonical status system.
> See `/srv/monorepo/docs/SPECS/ACTIVE.md` for the canonical status definitions.
> **Hard Stop Rule:** SPEC-010 must reach DONE before SPEC-009 resumes or any new SPEC starts.

---

## Archived (29)

Archived to `docs/archive/SPECS-dead/`. See `docs/archive/SPECS-dead/README.md` for inventory.

---

## Notes

- All voice pipeline SPECs (004, 005, 009, 013, 014, 018, 020) archived per SPEC-091
- hvacr-swarm contains legacy SPECs from (2026-04-08 to 2026-04-17)
- After pruning: 9 SPECs in SPECS/, 29 in SPECS-dead/
- Old status system (PROTECTED/IMPLEMENTING/APPROVED) no longer in use — canonical system: DONE/DRAFT/CANONICAL/REVIEW
- SPEC-INDEX.md last updated 2026-04-10 — this update (2026-04-21) reflects SPEC-091 prune
- **Canonical AGENTS.md:** `/srv/monorepo/AGENTS.md` (57KB) — hvacr-swarm/AGENTS.md is deprecated
