# Development Workflow

This guide outlines the engineering process, branching strategies, and local development setup for the monorepo. Our workflow is designed for high velocity with a strong emphasis on automation, type safety via Zod, and standardized CLI tooling.

## Core Philosophy

*   **Types-First Development**: Define data models in `packages/zod-schemas` before implementing business logic in the API or UI. This ensures a single source of truth for validation across the stack.
*   **Trunk-Based Development**: Use short-lived feature branches merged frequently into `main`.
*   **Automated Validation**: All changes must pass CI (Lint, Type Check, Vitest) before merging.
*   **Port Governance**: Adhere to assigned ports to avoid infrastructure conflicts (specifically with internal deployment tools).

---

## Branching & Release Management

We follow a **Trunk-Based Development** model to ensure the code in `main` is always deployable.

### Branch Naming Conventions
*   **`feature/*`**: New functional development or enhancements.
*   **`fix/*`**: Bug fixes for production or QA issues.
*   **`chore/*`**: Dependency updates, configuration changes, or non-functional maintenance.

### Release Process
1.  **Merge to Main**: Once a Pull Request is approved and CI passes, it is merged into `main`.
2.  **Semantic Versioning**: Merges to `main` trigger automated version tagging (e.g., `v1.2.3`) based on conventional commit messages.
3.  **Deployment**: Successful builds on `main` are automatically deployed to staging or production via the CI/CD pipeline.

---

## Local Development Setup

Follow these steps to initialize your environment and run services locally.

### 1. Prerequisites
*   **Node.js**: Version 20+ (managed via `.nvmrc`).
*   **Yarn**: Version 1.x (Classic).
*   **Docker**: Required for database (PostgreSQL 15) and cache (Redis) services.
*   **Python**: v3.10+ (Required for `scripts/hvac-rag` utilities if working on AI features).

### 2. Initialization
```bash
# Install dependencies across the monorepo
yarn install

# Start local infrastructure
docker compose up -d

# Run database migrations (using Orchid ORM)
yarn db -- up
```

### 3. Running Applications
Use the root `yarn dev` command to start core services concurrently. The following ports are standard:

| Service | Local URL | Description |
| :--- | :--- | :--- |
| **Backend API** | `http://localhost:4000` | Main Fastify/tRPC server |
| **Web Frontend** | `http://localhost:5173` | React/Vite dashboard |
| **AI Gateway** | `http://localhost:3001` | OpenAI-compatible proxy for LLMs |

> [!CAUTION]
> **Port Safety**: NEVER use port `3000` on your local host. This port is strictly reserved for internal infrastructure (CapRover).

### 4. Validation Commands
*   **Type Check**: `yarn check-types`
*   **Full Build**: `yarn build` (Validates the entire monorepo connectivity)
*   **Database Seed**: `yarn db:seed` (Populates local DB with development data via `apps/api/src/db/seed.ts`)

---

## Code Review Expectations

All Pull Requests require at least one maintainer approval. Reviews focus on:

### 1. Type Integrity
Zod schemas in `packages/zod-schemas` must accurately reflect the database (via Orchid ORM) and API contracts.
*   **Process**: If you modify a table in `apps/api/src/modules/*/tables/*.table.ts`, you **must** update the corresponding `.zod.ts` in `packages/zod-schemas/src/`.
*   **Validation**: Ensure exported types like `UserSelectAll` or `ServiceOrderCreateInput` match the runtime requirements.

### 2. Performance
*   **N+1 Queries**: Audit loaders in `apps/api`. Use Orchid ORM's `.join()` or `.select({ ... })` to fetch nested data efficiently.
*   **Client Rendering**: Use specialized UI components from `packages/ui` and avoid expensive calculations inside the render cycle of `apps/web`.

### 3. Consistency
*   **UI Standard**: Use shared components from `packages/ui` (e.g., `PrimaryButton`, `ContentCard`) instead of raw HTML/CSS.
*   **Forms**: Standardize on the `useRhfForm` hook and `RhfTextField` components from `packages/ui/src/rhf-form`.

### 4. Error Handling
*   Use the `AppError` class (found in `apps/api/src/middlewares/errorHandler.ts`) for business logic errors.
*   Ensure the AI Gateway correctly maps errors through `applyPtbrFilter` for Portuguese language support.

---

## New Developer Onboarding

If you are new to the codebase, complete these tasks:

1.  **Explore the Schema**: Compare `packages/zod-schemas/src/user.zod.ts` and `apps/api/src/modules/users/users/users.table.ts`. Observe how types flow from the DB to validation.
2.  **Login to Dashboard**: Run `yarn db:seed`, navigate to the Web app at `localhost:5173`, and log in using the credentials generated in the `seedDevTeam` script.
3.  **Module Exploration**: Look at `apps/api/src/modules/service-orders`. This is a reference implementation of a complete CRUD module with tables, routers, and schemas.
4.  **AI Pipeline**: If working on retrieval features, check `scripts/hvac-rag/hvac_rag_pipe.py` to see how the RAG context is built and passed to LLMs.

---

### Related Resources
*   [Testing Strategy](./testing-strategy.md) - Unit, Integration, and E2E patterns.
*   [Tooling Guide](./tooling.md) - Reference for CLI slash commands and automation scripts.
*   [Agent Guidelines](../../AGENTS.md) - Best practices for AI-assisted engineering.
