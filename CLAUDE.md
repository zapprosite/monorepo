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


## Security Guidelines
- NEVER hardcode secrets, API keys, tokens or passwords
- Always use process.env.VARIABLE or ${ENV_VAR} in scripts
- Secrets go in .env (gitignored) or Infisical
- Before any deploy: bash scripts/pre-deploy-check.sh
- Before any commit: sec hook scans automatically

## API Architecture
- API: apps/api (Fastify + tRPC + Zod)
- Schemas: packages/zod-schemas
- Routers: packages/trpc
- DB: packages/db (Drizzle ORM)
- Emergency rollback: git revert HEAD && pnpm run deploy

## Development Flow
1. /plan → gera PRD em docs/specflow/
2. /pg → gera tasks em tasks/pipeline.json
3. /cursor-loop → executa loop autônomo
4. scripts/pipeline-runner.sh → valida testes e lint
5. git push → Gitea CI → Coolify deploy automático
