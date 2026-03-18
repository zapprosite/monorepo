# Project Rules and Guidelines

> Auto-generated from .context/docs on 2026-03-17T17:09:05.953Z

## Infrastructure — Leitura Obrigatória

Se sua tarefa envolver portas, serviços externos, subdomínios, Docker ou banco de dados, leia ANTES:
- **[NETWORK_MAP.md](/srv/ops/ai-governance/NETWORK_MAP.md)** — mapa completo de rede, portas, subdomínios e estado dos serviços
- **[SERVICE_MAP.md](/srv/ops/ai-governance/SERVICE_MAP.md)** — dependências entre containers e VRAM budget

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
- `package.json/` — Yarn workspaces config (`workspaces` field)
- `packages/` — Workspace packages or modules.
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

