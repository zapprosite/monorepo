# Nexus Enterprise Standards

Classification: INTERNAL
Status: `ACTIVE`
Updated: 2026-05-01

## Status Labels

Every Nexus/vibe document must use one of:

| Label | Meaning |
|-------|---------|
| `ACTIVE` | Implemented and smoke-tested |
| `PLACEHOLDER` | Designed or desired, not yet implemented |
| `BLOCKED` | Requires external/manual prerequisite |
| `DEPRECATED` | Historical only; not a supported path |

Do not document placeholders as commands users should run.

## Script Standards

- Use `set -euo pipefail` for shell scripts.
- Validate required files and commands before work.
- Use `timeout` around stress or external commands.
- Keep paths monorepo-local unless a canonical infra doc requires otherwise.
- Never print secret values or prefixes.
- Never rely on global aliases.

## Queue Standards

- All task state transitions go through `queue-manager.py`.
- Use lock plus atomic rename for writes.
- Treat malformed queue JSON as controlled health failure, not traceback.
- Use temporary queues for smoke and stress tests.
- Preserve real queue state during tests unless explicitly marked destructive.

## Worker Standards

- Timebox work and reassess slow tasks.
- Use app-scoped verification where possible.
- Mark blocked work as `failed` or `frozen`; do not leave stale `running`.
- Avoid broad edits and unrelated refactors.
- Do not commit automatically from worker scripts.

## Documentation Standards

- Put operational truth in short runbooks.
- Move historical detail to audit docs only when still useful.
- Remove duplicated architecture diagrams when they no longer match code.
- Mark future features as `PLACEHOLDER`.
- Include verification commands for any operational claim.

## Deployment Standards

Coolify publishes apps; it does not govern the homelab. Coolify API deploy remains `BLOCKED` unless the source IP is AllowListed. DNS and public route changes require the canonical infra docs and explicit approval.
