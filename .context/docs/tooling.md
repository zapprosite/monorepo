# Tooling & Productivity Guide

The development environment is optimized for a monorepo architecture using **Turbo**, **Yarn**, and **Biome**. This guide details the scripts, automation, and configurations that ensure high-velocity contributions while maintaining strict type safety and architectural consistency.

Efficiency in this codebase relies on a **"Fast-Feedback Loop."** We prioritize tools that provide immediate validation (like Biome and TypeScript) and automation that handles repetitive boilerplate.

---

## Required Tooling

To contribute effectively, install and configure the following on your local machine:

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v22.x+` | Modern JS features & performance. |
| **Yarn** | `v1.22.x` | Workspace and package management (v1 Classic). |
| **Docker** | Latest | Running local PostgreSQL, Redis, and internal services. |
| **Biome** | Latest | 10x faster linting and formatting than ESLint/Prettier. |
| **Turbo** | Latest | Task orchestration, caching, and parallel execution. |
| **PostgreSQL**| `15+` | Primary relational database managed via Orchid ORM. |

---

## Architecture & Service Map

The monorepo architecture segments logic across specialized applications. Ensure these core services are operational for local development:

*   **API Gateway (`apps/ai-gateway`)**: Listens on **Port 4001**. Handles OpenAI-compatible routing, audio transcription (Whisper), and PT-BR content filtering.
*   **Main API (`apps/api`)**: Listens on **Port 4000**. The primary tRPC server and interface for the PostgreSQL database.
*   **Agency Service (`apps/hermes-agency`)**: Orchestrates AI agents using LangGraph and LiteLLM. Integrated with Telegram and Qdrant.
*   **Frontend (`apps/web`)**: Listens on **Port 5173**. The primary React/Vite administration and CRM dashboard.
*   **Shared UI (`packages/ui`)**: Atomic components and theme configurations used by the web application.
*   **Shared Schemas (`packages/zod-schemas`)**: The "Single Source of Truth" for data validation across all apps.

---

## Automation Workflows

We automate "plumbing" tasks so you can focus on business logic.

### 1. Code Generation & Scaffolding
The repository includes a scaffolding system to reduce boilerplate across the stack.
*   **Module Generation:** Run `.agent/scripts/scaffold-module.sh` to generate a synchronized vertical slice:
    *   **Backend:** Orchid ORM table definition → Zod Schema → tRPC Router.
    *   **Frontend:** API Client → React Page → UI Components.

### 2. Form & Validation (Zod-to-UI)
We use a centralized Zod pipeline to ensure frontend/backend parity:
*   **Schema Source:** Define all models and inputs in `packages/zod-schemas` (e.g., `UserCreateInput`).
*   **Type Safety:** `apps/web` consumes these schemas via the `useRhfForm` hook (`packages/ui/src/rhf-form/useRhfForm.tsx`) and standard components like `RhfTextField`.
*   **Validation:** Use `yarn check-types` to find breaking changes across the monorepo when a shared schema is updated.

### 3. Database Lifecycle
Database management is handled via **Orchid ORM** in `apps/api/src/db`.
*   `yarn db g <name>`: Generate a new migration file.
*   `yarn db up`: Migrate the local database to the latest version.
*   `yarn db seed`: Populate the database with essential dev data (Users, Teams, CRM base).
*   **Safety:** Always audit `apps/api/src/db/migrations` before committing to prevent schema drift.

### 4. Git & Commit Quality
*   **Conventional Commits:** Use `yarn commit` to trigger a scripted flow that generates semantic commit messages based on your `git diff`.
*   **Pre-commit Hooks:** Managed via `husky`. These run `biome check --apply` and `yarn check-types` on staged files to prevent "lint-only" commits.

---

## IDE / Editor Setup

### VS Code Configuration
The repository includes `.vscode` settings for an "out-of-the-box" experience:
*   **Formatter:** Set to **Biome** (`biomejs.biome`).
*   **TypeScript:** Ensure you use the "Workspace Version" (found in `node_modules`).
*   **Tailwind CSS:** Essential for the design system in `packages/ui`. Use the `bradlc.vscode-tailwindcss` extension.

### Essential Extensions
- **Biome:** Fast linting and formatting.
- **Even Better TOML:** For `biome.json` and workflow configs.
- **Tailwind CSS IntelliSense:** For utility class autocompletion.

---

## Productivity Tips

### Terminal Aliases
Add these to your shell profile (`.zshrc` or `.bashrc`) for speed:
```bash
alias yb="yarn build"
alias yd="yarn dev"
alias yt="yarn test"
alias ydb="yarn db"
```

### Development Commands
*   **Parallel Startup:** `yarn dev` uses **Turbo** to start all apps.
*   **Targeted Start:** `yarn turbo run dev --filter=api` (Starts only the API).
*   **Clean Cache:** `yarn clean` recursively deletes `node_modules`, `dist`, and `.turbo` if you encounter persistent build issues.
*   **Port Safety:** **Never use Port 3000** locally. It is strictly reserved for CapRover management. Refer to `apps/api/src/configs/app.config.ts` for service port assignments.

### Diagnostics & Testing
If AI services or background tasks are failing, use these internal utilities:
*   **Redis Check:** `yarn tsx apps/hermes-agency/src/telegram/redis.ts` to test connectivity.
*   **Smoke Tests:** Run `python smoke-tests/smoke_hermes_telegram.py` to validate the Telegram bot pipeline.
*   **API Gateway Logs:** Analyze logs for `apps/ai-gateway` to debug Whisper (STT) or Kokoro (TTS) connectivity issues.

---

## Related Documentation
- [Development Workflow](./development-workflow.md)
- [Testing Strategy](./testing-strategy.md)
