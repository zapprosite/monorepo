# AI Agent & Skill Protocol Guide

This documentation outlines the mandatory operational framework for AI agents (Gemini, Claude, GPT) and developers interacting with this monorepo. It defines a structured protocol designed to ensure architectural consistency, prevent technical debt, and eliminate "hallucination-driven" development.

---

## 🏗 High-Level Architecture

The monorepo is organized into specialized workspaces to separate concerns and maximize reusability:

-   **`packages/zod-schemas`**: Centralized source of truth for all data definitions. Contains Zod schemas used for validation in both the API and the Web frontend.
-   **`packages/ui`**: Shared UI library built with Material UI (MUI). Includes specialized form wrappers (e.g., `RhfTextField`) and the global `ThemeProvider`.
-   **`apps/api`**: Fastify-based backend utilizing tRPC for type-safe communication and Drizzle ORM for database management.
-   **`apps/web`**: React-based frontend application.
-   **`apps/ai-gateway`**: Specialized service for managing AI model routing, PT-BR filtering, and OpenAI-compatible endpoints.
-   **`scripts/hvac-rag`**: Python-based Retrieval-Augmented Generation (RAG) pipeline for technical HVAC data.

---

## 📋 The Execution Lifecycle

Every AI-driven or complex manual change must follow these three priority levels:

### P0: Rule Consultation
Before any action, review the core constraints in `docs/rules-GEMINI.md`. This guide is the primary authority on how code should be written and organized in this repository.

### P1: Persona Identification
Identify the required expertise based on the task:
-   **`@[frontend-specialist]`**: For `apps/web` or `packages/ui` tasks. Focuses on React, MUI, and React Hook Form.
-   **`@[backend-specialist]`**: For `apps/api` or database tasks. Focuses on tRPC, Drizzle, and Fastify.
-   **`@[ai-specialist]`**: For `apps/ai-gateway`, RAG pipelines, or LangGraph logic.

### P2: Selective Loading
Do not analyze the entire repository. Use the `SKILL.md` index to find and load only the relevant documentation for the specific module you are touching (e.g., loading `database` skills when creating migrations).

---

## 🛑 The Socratic Gate

**Mandatory Procedure:** No implementation may begin until the request is 100% clarified.

-   **Strategic Questioning:** Ask at least 3 questions regarding architectural boundaries (e.g., "Should this validation live in the Zod schema package or the local controller?").
-   **Reproduction & Side Effects:** For bugs, define the reproduction path and identify potential regressions in downstream modules.
-   **The 1% Rule:** If any part of the requirement is ambiguous, you must seek clarification rather than assuming a solution.

---

## ⚙️ Standard Conventions

### 1. Language & Typing
-   **Internal Thought/Plan:** English.
-   **Code & Docs:** All code (variables, functions, comments) must be in **English**.
-   **UI:** User-facing labels follow the user's language preference.
-   **The `any` Ban:** Strict TypeScript is required. Use the exported types from `packages/zod-schemas` (e.g., `UserCreateInput`).

### 2. Database & Schemas
-   **ORM:** All tables must be defined using Drizzle ORM.
-   **Shared Logic:** If a schema is used by both the API and Web apps, it **must** reside in `packages/zod-schemas`.
-   **Migrations:** Use the standard migration folder: `apps/api/src/db/migrations`.

### 3. UI Development
-   **Components:** Prefer reusing components from `packages/ui`.
-   **Forms:** Always use the `RhfFormProvider` and its associated components (`RhfTextField`, `RhfSelect`, `RhfCheckbox`) for consistency and validation.

---

## 📂 Task Planning (Complex Tasks Only)

For multi-file features or database changes, a planning document must be created at `docs/tasks/{task-slug}.md` containing:

1.  **Objective:** A concise statement of "what" and "why".
2.  **Affected Files:** A manifest of every file to be touched.
3.  **Step-by-Step Plan:** The logical order of operations (e.g., Define Zod Schema -> Create Migration -> Update tRPC Router -> Build UI Page).
4.  **Verification:** Specific steps to test and confirm the feature works.

---

## 🛠 Key Symbols Reference

| Symbol | Location | Use Case |
| :--- | :--- | :--- |
| `AppTrpcRouter` | `apps/api/src/routers/trpc.router.ts` | The root of all type-safe API calls. |
| `AppError` | `apps/api/src/middlewares/errorHandler.ts` | Standardized error throwing for the backend. |
| `RhfFormProvider` | `packages/ui/src/rhf-form/` | Wrapper for all complex data entry forms. |
| `UserTable` | `apps/api/src/modules/users/users/users.table.ts` | Example of a Drizzle table definition. |
| `applyPtbrFilter` | `apps/ai-gateway/src/middleware/ptbr-filter.ts` | Middleware for sanitizing AI responses. |

---

## 📂 Skill Modules Index

-   **`clean-code`**: Principles for formatting and DRY architecture.
-   **`database`**: Protocals for Drizzle schemas and migrations.
-   **`trpc`**: Type-safe contract definitions between client and server.
-   **`ui-components`**: Material UI customization and shared component usage.
-   **`ai-agents`**: LangGraph implementations and AI gateway routing.
