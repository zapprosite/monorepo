# Tooling & Productivity Guide

The development environment is optimized for a monorepo architecture using **Turbo**, **Yarn**, and **Biome**. This guide details the scripts, automation, and configurations that ensure high-velocity contributions while maintaining strict type safety and architectural consistency.

Efficiency in this codebase relies on a **"Fast-Feedback Loop."** We prioritize tools that provide immediate validation (like Biome and TypeScript) and automation that handles repetitive boilerplate.

---

## Required Tooling

To contribute effectively, install and configure the following on your local machine:

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v22.x+` | Modern JS features & performance. |
| **Yarn** | `v1.22.x` | Workspace and package management. |
| **Docker** | Latest | Running local PostgreSQL, Redis, and internal services. |
| **Biome** | Latest | 10x faster linting and formatting than ESLint/Prettier. |
| **Turbo** | Latest | Task orchestration, caching, and parallel execution. |
| **PostgreSQL**| `15+` | Primary relational database. |

---

## Recommended Automation

We automate "plumbing" tasks so you can focus on feature logic.

### 1. Code Generation & Scaffolding
The repository includes a scaffolding system to reduce boilerplate across the stack.
*   **Full-Stack Scaffolding:** Use `.agent/scripts/scaffold-module.sh` (or the `/scaffold` command in Claude Code) to generate:
    *   **Backend:** Orchid ORM table → Zod Schema → tRPC Router.
    *   **Frontend:** API Client → React Page → UI Components.

### 2. Form & Validation Workflows
We use a centralized Zod-to-UI pipeline:
*   **Schema First:** Define all models and inputs in `packages/zod-schemas` (e.g., `UserCreateInput`).
*   **Auto-Sync:** Use `yarn check-types`. Changes in schemas automatically flag errors in `apps/web` forms that utilize the `UseRhfForm` hook and UI components like `RhfTextField`.

### 3. Database Lifecycle
Database management is handled via `apps/api/src/db/db_script.ts`. Use these shortcuts:
*   `yarn db -- g <name>`: Generate a new migration file.
*   `yarn db -- up`: Migrate the local database to the latest version.
*   `yarn db -- seed`: Populate the database with essential dev data (Users, Teams, CRM base).
*   **Safety Note:** Always check `apps/api/src/db/migrations` before committing to ensure no unintended schema changes.

### 4. Git & Commit Automation
We follow **Conventional Commits**.
*   `yarn commit`: Triggers a scripted flow that generates a semantic commit message based on your `git diff`.
*   **Pre-commit Hooks:** Executed via `husky`. These run `biome check --apply` and `yarn check-types` on staged files.

---

## IDE / Editor Setup

### VS Code Configuration
The workspace settings in `.vscode/settings.json` include:
*   **Format on Save:** Enabled via the **Biome** extension.
*   **TypeScript:** Use the "Workspace Version" (TypeScript 5.x+).
*   **Tailwind CSS:** Essential for styling components in `packages/ui`.

### Recommended Extensions:
*   `biomejs.biome`: Official tool for linting/formatting.
*   `tamasfe.even-better-toml`: For configuration file management.
*   `bradlc.vscode-tailwindcss`: For utility class autocompletion.

### Snippets
Common patterns for `trpcQuery` and `trpcMutation` are available in `.vscode/typescript.code-snippets` to accelerate backend-to-frontend integration.

---

## Productivity Tips

### Terminal Aliases
Add these to your shell profile (`.zshrc` or `.bashrc`) for faster navigation:
```bash
alias yb="yarn build"
alias yd="yarn dev"
alias yt="yarn test"
alias ydk="yarn db --"
```

### Local Development Workflow
1.  **Parallel Execution:** `yarn dev` starts the API (Port 4000) and Web (Port 5173) simultaneously. 
    *   To target one: `yarn turbo run dev --filter=api`
2.  **Environment Sync:** If you update `packages/env`, run `yarn env:sync`. This ensures all `.env.example` files across the monorepo are updated.
3.  **Port Safety:** **Never use Port 3000** locally; it is strictly reserved for the CapRover management dashboard. Refer to `/srv/ops/ai-governance/PORTS.md` for the full registry.
4.  **Resetting Environment:** If you encounter persistent build cache issues, run `yarn clean`. This recursively deletes `node_modules`, `dist`, and `.turbo` folders throughout the workspace.

---

## Related Documentation
- [Development Workflow](./development-workflow.md)
- [Testing Strategy](./testing-strategy.md)
