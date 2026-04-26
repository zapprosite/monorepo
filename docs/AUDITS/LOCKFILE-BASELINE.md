# Lockfile Baseline — pnpm is canonical

**Date:** 2026-04-26
**Status:** Pending human decision

---

## Current state

| Lockfile | Package manager | Status |
|----------|----------------|--------|
| `pnpm-lock.yaml` | pnpm 9.0.6 | **Canonical** — used by CI (`--frozen-lockfile`), Dockerfile, local dev |
| `bun.lock` | Bun | Present in repo root — **not used by any workflow or Dockerfile** |

---

## Decision required

`bun.lock` must not remain in the repo without an owner. Two options:

### Option A — Remove `bun.lock`
```bash
git rm bun.lock
```
- Simple, keeps only one lockfile
- CI, Dockerfile, and workflows all use pnpm
- Safe to do now

### Option B — Keep `bun.lock` as a development tool
- Requires updating this document with an owner and purpose
- Requires adding `bun.lock` to `.gitignore` or documenting why it's checked in
- Requires updating `docs/AUDITS/VERSION-AUDIT-2026-04.md` to reflect dual lockfile intent

---

## Risk of doing nothing

If `bun.lock` stays without an owner:
- Future contributor may run `bun install` and commit updated `bun.lock` as the canonical lockfile
- pnpm `--frozen-lockfile` in CI will not prevent this — bun updates happen outside the pnpm workflow
- Dependency resolution divergence between pnpm and bun may occur without detection

---

## Current guardrails

- `.gitignore` does **not** currently exclude `bun.lock`
- CI does **not** run any bun commands
- Dockerfile does **not** install bun
- No documented team policy on bun usage

---

## Recommendation

**Remove `bun.lock`** before any contributor runs `bun install` on main. This is a `chore` change that does not alter runtime behavior.

If bun is needed in the future, open a dedicated PR that:
1. Documents the use case
2. Adds `.gitignore` rule for `bun.lock` (if not committing it)
3. Updates CI to optionally run bun checks

---

*Created by Enterprise Baseline Fixer. Requires human decision — do not merge without explicit approval on the lockfile strategy.*