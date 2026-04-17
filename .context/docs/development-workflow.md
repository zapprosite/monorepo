# Development Workflow

This guide outlines the engineering process, branching strategies, and local development setup for the monorepo. Our workflow is designed for high velocity with a strong emphasis on automation, type safety via Zod, and standardized CLI tooling.

## Core Philosophy

*   **Types-First Development**: Define data models in `packages/zod-schemas` before implementing business logic in the API or UI. This ensures a single source of truth for validation.
*   **Trunk-Based Development**: Use short-lived feature branches merged frequently into `main`.
*   **Automated Validation**: All changes must pass CI (Lint, Type Check, Tests) before merging.
*   **Port Governance**: Adhere to assigned ports to avoid infrastructure conflicts (specifically with CapRover).

---

## Branching & Release Management

We follow a **Trunk-Based Development** model to ensure the code in `main` is always deployable.

### Branch Naming Conventions
Use standardized CLI commands to generate branches:
*   **`feature/*`**: New functional development or enhancements.
*   **`fix/*`**: Bug fixes for production or QA issues.
*   **`chore/*`**: Dependency updates, configuration changes, or non-functional maintenance.

### Release Process
1.  **Merge to Main**: Once a PR is approved and CI passes, it is merged into `main`.
2.  **Semantic Versioning**: We use SemVer. Merges to `main` trigger automated version tagging (e.g., `v1.2.3`) based on conventional commit messages.
3.  **Deployment**: Successful builds on `main` are automatically deployed to staging or production environments via our CI/CD pipeline.

---

## Local Development Setup

Follow these steps to initialize your environment and run services locally.

### 1. Prerequisites
*   **Node.js**: Ensure the version matches `.nvmrc`.
*   **Yarn**: Version 1.x (Classic).
*   **Docker**: Required for database (PostgreSQL) and cache (Redis) services.

### 2. Initialization
```bash
# Install dependencies across the monorepo
yarn install

# Start local infrastructure (PostgreSQL 15 and Redis)
docker compose up -d

# Run database migrations (using Orchid ORM)
yarn db -- up
```

### 3. Running Applications
Use the root `yarn dev` command to start the core services concurrently:
*   **Backend API**: `http://localhost:4000`
*   **Web Frontend**: `http://localhost:5173`
*   **AI Gateway**: (Consult `apps/ai-gateway/src/config` for specific ports)

> [!CAUTION]
> **Port Safety**: NEVER use port `3000` on your local host. This port is strictly reserved for internal CapRover infrastructure.

### 4. Validation Commands
*   **Type Check**: `yarn check-types`
*   **Full Build**: `yarn build` (Validates the entire monorepo connectivity)
*   **Database Seed**: `yarn db:seed` (Populates local DB with development data)

---

## Code Review Expectations

All Pull Requests require at least one maintainer approval. Reviews focus on:

1.  **Type Integrity**: Zod schemas in `packages/zod-schemas` must accurately reflect the database (via Orchid ORM) and API contracts.
    *   *Example*: `UserSelectAll` (from `packages/zod-schemas/src/user.zod.ts`) should match the fields in `UserTable` (from `apps/api/src/modules/users/users/users.table.ts`).
2.  **Performance**: 
    *   **API**: Check for "N+1" query patterns in `apps/api` controllers and routers.
    *   **Web**: Audit for unnecessary re-renders in `apps/web` components.
3.  **Consistency**: Use shared components from `packages/ui` instead of raw HTML/CSS. Utilize existing hooks like `useRhfForm` for form state management.
4.  **Testing**: Ensure appropriate Vitest or E2E tests are included. Refer to the [Testing Strategy](./testing-strategy.md).

### AI Agent Collaboration
When using AI tools (Cursor, Claude, etc.), follow the patterns established in `AGENTS.md`. Ensure AI-generated code respects:
*   The centralized Zod schemas for all data boundaries.
*   The repository's **Module-based architecture** (grouping routes, tables, and services by domain).

---

## New Developer Onboarding

If you are new to the codebase, complete these tasks to familiarize yourself with the stack:

1.  **Explore the Schema**: Compare `packages/zod-schemas/src/user.zod.ts` and `apps/api/src/modules/users/users/users.table.ts`. Observe how types flow from the database layer to the application validation layer.
2.  **Login to Dashboard**: Run `yarn db:seed`, navigate to the Web app at `localhost:5173`, and log in using the credentials generated in the `seedDevTeam` script.
3.  **Scaffold a Module**: Run the `/scaffold` command (see [Tooling Guide](./tooling.md)) to generate a new CRUD module. This demonstrates how the API, DB, and UI layers are connected in this monorepo.
4.  **First Issue**: Search the backlog for `good-first-issue` tags. These typically involve UI adjustments in `packages/ui` or adding fields to existing Zod schemas and tables.

---

### Related Resources
*   [Testing Strategy](./testing-strategy.md) - Unit, Integration, and E2E patterns.
*   [Tooling Guide](./tooling.md) - Reference for CLI slash commands and automation scripts.
*   [Agent Guidelines](../../AGENTS.md) - Best practices for AI-assisted engineering in this repository.
