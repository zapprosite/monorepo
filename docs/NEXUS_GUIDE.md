# Nexus Guide

Classification: INTERNAL
Status: `ACTIVE`
Updated: 2026-05-01

## What Nexus Means Here

Nexus is the monorepo-local control surface for automation. The active execution layer is vibe-kit.

Use:

```bash
bash scripts/vibe.sh --status
bash scripts/vibe.sh --spec SPEC-ID --app app --plan
bash scripts/vibe.sh --spec SPEC-ID --app app --do
bash scripts/nexus-ctl.sh status
bash scripts/nexus-ctl.sh queue
```

## What Is Deprecated

The old 7 x 7 agent harness and `nexus.sh` mode matrix are `DEPRECATED` as operational instructions. They may remain as historical research, but they are not the safe path for running work now.

## Safe Workflow

1. Write or choose a SPEC in `docs/SPECS/`.
2. Confirm tasks are checkbox lines.
3. Plan the queue.
4. Execute bounded tasks.
5. Verify.
6. Freeze protected/manual work.

## Protected Boundaries

Before infra, public route, DNS, Coolify, or deployment changes, read the canonical infra docs listed in `AGENTS.md`. Coolify API deploy is blocked unless the source IP is in AllowList.

## Useful Docs

- `docs/OPERATIONS/NEXUS-VIBEKIT-ARCHITECTURE.md`
- `.claude/vibe-kit/README.md`
- `.claude/vibe-kit/AGENTS.md`
- `docs/OPERATIONS/NEXUS-ERROR-PLAYBOOK.md`
- `docs/OPERATIONS/NEXUS-STANDARDS.md`
