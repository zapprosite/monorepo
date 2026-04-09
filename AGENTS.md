# Project Rules and Guidelines

> Auto-generated from .context/docs on 2026-03-18T22:41:14.268Z

## README

# Documentation Index

Welcome to the repository knowledge base. Start with the project overview, then dive into specific guides as needed.

## Core Guides
- [Project Overview](./project-overview.md)
- [Architecture Notes](./architecture.md)
- [Development Workflow](./development-workflow.md)
- [Testing Strategy](./testing-strategy.md)
- [Glossary & Domain Concepts](./glossary.md)
- [Data Flow & Integrations](./data-flow.md)
- [Security & Compliance Notes](./security.md)
- [Tooling & Productivity Guide](./tooling.md)
- [CLI Shortcuts Reference](./docs/CLI-SHORTCUTS.md)
- [Toolchain Reference](./docs/TOOLCHAIN.md)

## Repository Snapshot
- `AGENTS.md/`
- `apps/`
- `package.json/`
- `packages/` — Workspace packages or modules.
- `pnpm-workspace.yaml/`
- `README.md/`

## Document Map
| Guide | File | Primary Inputs |
| --- | --- | --- |
| Project Overview | `project-overview.md` | Roadmap, README, stakeholder notes |
| Architecture Notes | `architecture.md` | ADRs, service boundaries, dependency graphs |
| Development Workflow | `development-workflow.md` | Branching rules, CI config, contributing guide |
| Testing Strategy | `testing-strategy.md` | Test configs, CI gates, known flaky suites |
| Glossary & Domain Concepts | `glossary.md` | Business terminology, user personas, domain rules |
| Data Flow & Integrations | `data-flow.md` | System diagrams, integration specs, queue topics |
| Security & Compliance Notes | `security.md` | Auth model, secrets management, compliance requirements |
| Tooling & Productivity Guide | `tooling.md` | CLI scripts, IDE configs, automation workflows |
| CLI Shortcuts Reference | `docs/CLI-SHORTCUTS.md` | All `/` slash commands in Claude Code, git aliases, mirror push |
| Toolchain Reference | `docs/TOOLCHAIN.md` | pnpm/bun/yarn/npm, Turbo, Biome, TypeScript, Python, Docker |

## Scripts (`/srv/monorepo/scripts/`)

Operational bash scripts for monorepo tasks:

| Script | Purpose |
|--------|---------|
| `scripts/health-check.sh` | Full health: Docker, services, ZFS, disk, git status |
| `scripts/deploy.sh` | Pre-deploy validation + optional ZFS snapshot + push |
| `scripts/backup.sh` | Backup monorepo (git bundle, apps, packages, configs) |
| `scripts/restore.sh <name>` | Restore from a named backup in `/srv/backups/monorepo/` |
| `scripts/mirror-push.sh` | Push current branch to Gitea + GitHub simultaneously |
| `scripts/sync-env.js` | Sync environment variables to workspaces (already existed) |

