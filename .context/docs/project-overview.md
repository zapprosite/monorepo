# Project Overview

The **connected-repo** is a high-performance full-stack monorepo designed to accelerate the development of feature-rich web applications through automated scaffolding and unified type safety. It serves as a comprehensive "feature factory," enabling developers to transform entity definitions into complete software modules—spanning database schemas, API endpoints, and user interfaces—within minutes.

## Codebase Reference

> **Detailed Analysis**: For complete symbol counts, architecture layers, and dependency graphs, see [`codebase-map.json`](./codebase-map.json).

## Quick Facts

- **Root**: `/srv/monorepo`
- **Primary Languages**: TypeScript (React 19, Fastify 5), Python (AI Skills/Workflows)
- **Key Entry Points**: 
  - Backend: `apps/api/src/index.ts` (Port 4000)
  - Frontend: `apps/web/src/main.tsx` (Port 5173)
  - Orchestrator: `apps/orchestrator/src/core/workflow-engine.ts`
- **Full analysis**: [`codebase-map.json`](./codebase-map.json)

## Entry Points

- **API Server**: [`apps/api/src/index.ts`](../apps/api/src/index.ts) — Main Fastify application hosting tRPC, REST, and Webhook processors.
- **Web Application**: [`apps/web/src/main.tsx`](../apps/web/src/main.tsx) — React SPA entry point using TanStack Query and tRPC clients.
- **Workflow Orchestrator**: [`apps/orchestrator/src/core/workflow-engine.ts:22`](../apps/orchestrator/src/core/workflow-engine.tsL22) — Core engine for managing multi-step AI and human-in-the-loop processes.
- **CLI/Scaffold Tools**: [`.claude/`](../.claude/) — Custom slash commands for code generation and maintenance.

## Key Exports

For a complete list of the 300+ exported symbols including `AppRouter`, `OrchestratorEngine`, and shared Zod schemas like `UserCreateInput`, please refer to the [`codebase-map.json`](./codebase-map.json).

## File Structure & Code Organization

- `apps/api/` — Fastify backend service containing tRPC routers, database migrations, and business logic modules.
- `apps/web/` — Frontend React application organized by functional modules (Schedule, Kanban, Maintenance, etc.).
- `apps/orchestrator/` — Specialized engine for managing complex agentic workflows and human approval gates.
- `packages/zod-schemas/` — Single source of truth for data validation, shared between backend and frontend for end-to-end type safety.
- `packages/db/` — Centralized database configuration and Orchid ORM instance management.
- `packages/ui/` — Shared Material-UI component library and React Hook Form integrations.
- `.agent/` — Antigravity Kit containing AI skills (Python), agent definitions, and workflow configurations.
- `docs/` — Technical documentation, architectural guides, and operational manuals.

## Technology Stack Summary

The project utilizes a modern **TypeScript-first** stack optimized for developer velocity and runtime performance. The backend is built on **Fastify 5** for its low overhead and **tRPC 11** for seamless type sharing with the frontend. Data persistence is handled by **PostgreSQL 15** via the **Orchid ORM**, which provides a powerful, type-safe query builder. 

The frontend leverages **React 19** and **Material-UI (MUI)** for a responsive, accessible interface, managed by **TanStack Query** for state synchronization. Build and monorepo management are handled by **Turbo 2** and **Yarn Workspaces**, ensuring efficient caching and dependency management across the repository.

## Core Framework Stack

- **Backend**: Fastify 5 (Core), tRPC (API Layer), Orchid ORM (Data Layer).
- **Frontend**: React 19, Vite (Build tool), TanStack Query (Data fetching).
- **Data/Validation**: Zod (Schema definition and validation).
- **AI/Automation**: Custom Python-based MCP (Model Context Protocol) skills and an internal Workflow Orchestrator.

## Development Tools Overview

This repository is designed for "AI-augmented" development. It includes a suite of custom **Slash Commands** integrated with Claude Code (located in `.claude/`) to automate repetitive tasks:
- **/scaffold**: Generates a full vertical slice (Schema + API + UI) for a new entity.
- **/feature**: Automates branch creation and upstream tracking.
- **/ship**: Handles semantic commits and automated Pull Request creation.

## Getting Started Checklist

1. **Environment Setup**: Copy `.env.example` to `.env` and configure your local database credentials.
2. **Install Dependencies**: Run `yarn install` from the root directory.
3. **Database Preparation**: Start the local database container with `docker compose up -d` and run migrations with `yarn db -- up`.
4. **Launch Development Environment**: Execute `yarn dev` to start the backend (port 4000) and frontend (port 5173) simultaneously.
5. **Verify Installation**: Navigate to `http://localhost:5173` and ensure the dashboard loads successfully.
6. **Review Workflow**: Read the [Development Workflow](./development-workflow.md) to understand the `/scaffold` to `/ship` cycle.

## Next Steps

For a deeper dive into the system's design, consult the [Architecture Documentation](./architecture.md). If you are setting up CI/CD or production environments, refer to the [Tooling Guide](./tooling.md) and the operational skills catalog in `docs/OPERATIONS/`.
