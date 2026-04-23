# Contributing Guide

**Project:** Homelab Multi-Claude Monorepo
**Last Updated:** 2026-04-23

---

## Project Overview

This monorepo contains the core infrastructure for the homelab at `zappro.site`, including:

- **apps/** — Deployable applications (Fastify/tRPC)
- **packages/** — Shared libraries (Zod-first validation schemas)
- **orchestrator/** — 3-phase pipeline (snapshot, run, rollback)
- **docs/** — Architecture, runbooks, and operational guides

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js / pnpm workspaces |
| Language | TypeScript (strict mode) |
| API | Fastify + tRPC |
| Validation | Zod (shared schemas via `packages/zod-schemas`) |
| Formatting | Biome |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- Access to homelab infrastructure

### Initial Setup

```bash
# Clone the monorepo
git clone git@github.com:zappro/monorepo.git /srv/monorepo
cd /srv/monorepo

# Install dependencies
pnpm install

# Verify TypeScript compilation
pnpm typecheck

# Run tests
pnpm test
```

### Environment Setup

Copy the example environment file and configure secrets:

```bash
cp .env.example .env
# Edit .env with your secrets
```

Required environment variables:
- `DATABASE_URL` — PostgreSQL connection string
- `LITELLM_API_KEY` — LiteLLM proxy authentication
- `QDRANT_URL` — Vector database endpoint

---

## Coding Standards

### TypeScript

- Strict mode enabled globally
- No `any` types — use `unknown` and narrow appropriately
- Use Zod for runtime validation (shared via `packages/zod-schemas`)

### Formatting (Biome)

```bash
# Format all files
pnpm format

# Lint all files
pnpm lint
```

### Language Standards

| Type | Language | Example |
|------|----------|---------|
| Code / Functions | EN (camelCase) | `getUserById()` |
| Variables | EN (camelCase) | `userId`, `isAuthenticated` |
| Types/Interfaces | EN (PascalCase) | `UserProfile`, `AuthConfig` |
| Files | EN (kebab-case) | `auth-service.ts` |
| Documentation | PT-BR | "Este documento descreve..." |
| Commit Messages | EN | `feat: add user authentication` |

**Reference:** [LANGUAGE-STANDARDS.md](/srv/monorepo/docs/GUIDES/LANGUAGE-STANDARDS.md)

---

## Commit Message Format

Use Conventional Commits with Angular convention:

```
<type>: <description>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `docs` | Documentation only changes |
| `chore` | Changes to build process or auxiliary tools |

### Examples

```
feat: add user authentication via JWT
fix: resolve race condition in connection pool
docs: update API documentation for /users endpoint
refactor: extract validation logic into separate module
```

---

## Pull Request Process

### 1. Branch Creation

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feat/my-feature

# Or use the turbo workflow
pnpm turbo:ship  # commit → push → merge → tag → new branch
```

### 2. Development

1. Make changes following coding standards
2. Run typecheck and tests before committing
3. Update documentation if needed
4. Commit using conventional commit format

### 3. Pull Request

```bash
# Push branch and create PR
git push -u origin feat/my-feature
gh pr create --title "feat: add my feature" --body "## Summary\n- Added new feature\n\n## Test plan\n- [ ] Unit tests\n- [ ] Integration tests"
```

### 4. Review

- Link related specs/ADRs if applicable
- Ensure all CI checks pass
- Update based on code review feedback

---

## Testing Guidelines

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test --watch

# Specific package
pnpm --filter @repo/api test
```

### Test Structure

```
packages/
└── zod-schemas/
    └── src/
        └── validate.test.ts  # Unit tests for validation schemas
```

### Coverage

- Aim for meaningful test coverage on validation logic
- Integration tests for API endpoints

---

## Documentation Structure

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](/srv/monorepo/docs/ARCHITECTURE.md) | System architecture and topology |
| [RUNBOOK.md](/srv/monorepo/docs/RUNBOOK.md) | Operational procedures and recovery |
| [GUIDES/](/srv/monorepo/docs/GUIDES/) | Language standards, env management |
| [SPECS/](/srv/monorepo/docs/SPECS/) | Active specifications |
| [ADRs/](/srv/monorepo/docs/ADRs/) | Architecture decision records |

---

## Infrastructure Operations

### Before Any Structural Change

1. Read `/srv/ops/ai-governance/CONTRACT.md`
2. Check `/srv/ops/ai-governance/GUARDRAILS.md` for approval requirements
3. Create ZFS snapshot before changes:

```bash
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-<reason>
```

### Safe Commands (No Approval Needed)

```bash
docker ps
docker compose -f /srv/apps/platform/docker-compose.yml ps
zpool status tank
zfs list -t snapshot
```

### NEVER DO

- `wipefs /dev/nvme*` — destroys ZFS pool
- `zpool destroy tank` — destroys all data
- `rm -rf /srv/data/*` — deletes production data
- `rm -rf /srv/backups/*` — deletes backups

---

## Related Documentation

- [ARCHITECTURE.md](/srv/monorepo/docs/ARCHITECTURE.md) — System architecture
- [RUNBOOK.md](/srv/monorepo/docs/RUNBOOK.md) — Recovery procedures
- [BACKUP-RUNBOOK.md](/srv/monorepo/docs/GUIDES/backup-runbook.md) — Backup procedures
- [DISASTER-RECOVERY.md](/srv/monorepo/docs/GUIDES/DISASTER-RECOVERY.md) — Disaster recovery
- [ENV-MANAGEMENT.md](/srv/monorepo/docs/GUIDES/env-management.md) — Environment variable management
