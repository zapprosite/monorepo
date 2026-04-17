# Development Workflow

This guide outlines the engineering process, branching strategies, and local development setup for the monorepo. Our workflow is designed for high velocity with a strong emphasis on automation, type safety via Zod, and standardized CLI tooling.

## Core Philosophy

- **Types-First Development**: Define data models in `packages/zod-schemas` before implementing business logic in the API or UI.
- **Trunk-Based Development**: Use short-lived feature branches merged into `main`.
- **Automated Validation**: All changes must pass CI (Lint, Type Check, Tests) before merging.
- **Port Governance**: Adhere to assigned ports to avoid infrastructure conflicts (specifically with CapRover).

---

## Branching & Release Management

We follow a **Trunk-Based Development** model to ensure the code in `main` is always deployable.

### Branch Naming Conventions
Use the standardized CLI commands (see [Tooling Guide](./tooling.md)) to generate branches:
- **`feature/*`**: New functional development.
- **`fix/*`**: Bug fixes for production or QA issues.
- **`chore/*`**: Dependency updates, config changes, or non-functional maintenance.

### Release Process
1. **Merge to Main**: Once a PR is approved and CI passes, it is merged into `main`.
2. **Semantic Versioning**: We use SemVer. Merges to `main` trigger automated version tagging (e.g., `v1.2.3`) based on conventional commit messages.
3. **Deployment**: Successful builds on `main` are automatically deployed to the staging/production environments.

---

## Local Development Setup

Follow these steps to initialize your environment and run services locally.

### 1. Prerequisites
- **Node.js**: Ensure the version matches `.nvmrc`.
- **Yarn**: Version 1.x (Classic).
- **Docker**: Required for database and cache services.

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
- **Backend API**: `http://localhost:4000`
- **Web Frontend**: `http://localhost:5173`
- **AI Gateway**: (Check specific app config for port)

> [!CAUTION]
> **Port Safety**: NEVER use port `3000` on your local host. This port is strictly reserved for CapRover infrastructure.

### 4. Validation Commands
- **Type Check**: `yarn check-types`
- **Full Build**: `yarn build` (Validates the entire monorepo connectivity)
- **Database Seed**: `yarn db:seed` (Populates local DB with development data)

---

## Code Review Expectations

All Pull Requests require at least one maintainer approval. Reviews focus on:

1. **Type Integrity**: Zod schemas in `packages/zod-schemas` must accurately reflect the database (via Orchid ORM) and API contracts.
2. **Performance**: 
   - **API**: Check for "N+1" query patterns in `apps/api`.
   - **Web**: Audit for unnecessary re-renders in `apps/web`.
3. **Consistency**: Use components from `packages/ui` instead of raw HTML/CSS. Utilize existing hooks like `useRhfForm`.
4. **Testing**: Ensure appropriate Vitest or E2E tests are included. Refer to the [Testing Strategy](./testing-strategy.md).

### AI Agent Collaboration
When using AI tools (Cursor, Claude, etc.), follow the patterns established in `AGENTS.md`. Ensure AI-generated code respects:
- The centralized Zod schemas.
- The repository's directory structure (Modules-based architecture).

---

## New Developer Onboarding

If you are new to the codebase, complete these tasks:

1. **Explore the Schema**: Open `packages/zod-schemas/src/user.zod.ts` and `apps/api/src/modules/users/users/users.table.ts`. This shows how types flow from the database to the application.
2. **Login to Dashboard**: Use `yarn db:seed` and then log in to the Web app at `:5173` using the credentials generated in the `seedDevTeam` script.
3. **Scaffold a Module**: Run the `/scaffold` command (see [Tooling Guide](./tooling.md)) to generate a new CRUD module. This will help you understand how the API, DB, and UI layers connect.
4. **First Issue**: Search the backlog for `good-first-issue` tags. These usually involve small UI fixes in `packages/ui` or adding fields to existing Zod schemas.

---

### Related Resources
- [Testing Strategy](./testing-strategy.md) - Unit, Integration, and E2E patterns.
- [Tooling Guide](./tooling.md) - Reference for CLI slash commands.
- [Agent Guidelines](../../AGENTS.md) - Best practices for AI-assisted engineering.
