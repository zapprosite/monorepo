# Document Structure: Tooling & Productivity Guide

The development environment at `/srv/monorepo` is optimized for a monorepo architecture using **Turbo**, **Yarn**, and **Biome**. This guide details the scripts, automation, and editor configurations that ensure high-velocity contributions while maintaining strict type safety and architectural consistency.

## Tooling & Productivity Guide

Efficiency in this codebase relies on a "Fast-Feedback Loop." We prioritize tools that provide immediate validation (like Biome and TypeScript) and automation that handles repetitive boilerplate (like our custom scaffolders). 

All developers are expected to adhere to the project's **Port Governance** to avoid conflicts with infrastructure services like CapRover. Always refer to `/srv/ops/ai-governance/PORTS.md` before adding new network-exposed services.

---

## Required Tooling

To contribute effectively, the following tools must be installed and configured on your local machine:

*   **Node.js (v22.x or higher):** The codebase leverages modern JavaScript features and performance improvements found in the latest LTS/Current versions.
*   **Yarn (v1.22.x):** Used as the primary package manager for workspace management.
*   **Docker & Docker Compose:** Required to run the local PostgreSQL instance and any secondary services (like Redis or local emulators).
*   **Biome (CLI):** Our unified tool for linting and formatting. It replaces the traditional ESLint/Prettier stack with 10x faster performance.
*   **Turbo (Turborepo):** Powers the build system. It handles task orchestration, caching, and parallel execution across `apps/` and `packages/`.
*   **Orchid ORM CLI:** Used via `yarn db` for database migrations and schema management.
*   **PostgreSQL 15+:** The primary relational database.

---

## Recommended Automation

We automate as much of the "plumbing" as possible so you can focus on feature logic.

### 1. Code Generation & Scaffolding
The repository includes a powerful scaffolding system accessible via Claude Code or manual scripts.
*   **Full-Stack Scaffolding:** Use `.agent/scripts/scaffold-module.sh` (or `/scaffold` in Claude) to generate a complete slice including:
    *   **Backend:** Orchid ORM table definition → Zod Schema → tRPC Router.
    *   **Frontend:** API Client → React Page → UI Components.

### 2. Form & Validation Workflows
We use a centralized Zod-to-UI pipeline. 
*   **Schema First:** Define models in `packages/zod-schemas`.
*   **Auto-Sync:** Use `yarn check-types` to ensure that changes in schemas automatically flag errors in the `apps/web` forms utilizing `UseRhfForm` and `RhfTextField`.

### 3. Git & Commit Automation
We follow **Conventional Commits**. You are encouraged to use the following shortcuts:
*   `yarn commit`: Triggers a scripted flow that generates a semantic commit message based on your `git diff`.
*   **Pre-commit Hooks:** Executed via `husky`. These run `biome check --apply` and `yarn check-types` on staged files to prevent "broken" code from reaching the remote.

### 4. Database Lifecycle
Managed via `apps/api/src/db/db_script.ts`:
*   `yarn db -- g <name>`: Generates a new migration file.
*   `yarn db -- up`: Migrates the local database to the latest version.
*   `yarn db -- seed`: Populates the database with essential dev data (Users, Teams, CRM base).

---

## IDE / Editor Setup

### VS Code Recommended Configuration
Our workspace settings are checked into `.vscode/settings.json`. Key highlights:
*   **Format on Save:** Enabled using the **Biome VS Code Extension**.
*   **TypeScript Integration:** Always use the "Workspace Version" of TypeScript (v5.x+).
*   **Tailwind CSS IntelliSense:** Essential for styling components in `packages/ui`.

### Recommended Extensions:
*   `biomejs.biome`: Official Biome extension for linting/formatting.
*   `tamasfe.even-better-toml`: For managing configuration files.
*   `bradlc.vscode-tailwindcss`: For CSS utility autocompletion.
*   `OrchidORM.orchid-orm-vscode`: (If available) for SQL/Schema navigation.

### Snippets
Common patterns for `trpcQuery` and `trpcMutation` are available in `.vscode/typescript.code-snippets` to speed up backend-to-frontend integration.

---

## Productivity Tips

### Terminal Aliases
Add these to your `.zshrc` or `.bashrc` to move faster in the monorepo:
```bash
alias yb="yarn build"
alias yd="yarn dev"
alias yt="yarn test"
alias ydk="yarn db --"
```

### Local Development Workflow
1.  **Parallel Execution:** `yarn dev` uses Turbo to start the API (Port 4000) and Web (Port 5173) simultaneously. If you only need one, use `yarn turbo run dev --filter=api`.
2.  **Environment Sync:** If you update `packages/env`, run `yarn env:sync`. This script ensures that `.env.example` files across all apps are updated with the new required keys.
3.  **Port Safety:** Never use Port **3000** locally; it is reserved for the CapRover management dashboard.
4.  **Cleaning the Slate:** If you encounter weird build cache issues, run `yarn clean`. This recursively deletes all `node_modules`, `dist`, `.turbo`, and `.next` (if applicable) folders.

### Related Documentation
- [Development Workflow](./development-workflow.md): Detailed guide on branching and PRs.
- [Testing Strategy](./testing-strategy.md): How to use Vitest for unit and integration testing.
