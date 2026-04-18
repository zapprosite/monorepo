# AI Agent & Skill Protocol (`docs/rules-GEMINI.md`)

This document defines the mandatory operating procedures for AI agents (Gemini, Claude, GPT) interacting with this monorepo. It establishes a tiered execution model designed to prevent "hallucination-driven" coding and ensure that every change is intentional, researched, and architecture-compliant.

## 📋 Core Execution Lifecycle

Every AI session must follow this strict priority chain before performing any write operations:

1.  **Read Rules (P0):** Consult this file (`docs/rules-GEMINI.md`) before any action.
2.  **Check Frontmatter (P1):** Identify the required Agent and Skillset based on the task (e.g., `@[frontend-specialist]`).
3.  **Load Skills (P2):** Reference the `SKILL.md` index and load only the documentation sections relevant to the task.

**Selective Reading Strategy:** Do not ingest entire directories. Read the skill index first, then target-load specific documentation relevant to the current file or logic.

---

## 🛑 The Socratic Gate

**Mandatory Rule:** No implementation tools may be used until the request passes the Socratic Gate. The AI must clarify 100% of the intent before writing code.

### Strategy by Request Type
- **New Features:** Ask at least **3 strategic questions** regarding architecture (e.g., "Should this schema live in `packages/zod-schemas` or is it local to the app?").
- **Bug Fixes:** Confirm the reproduction steps and ask about potential side effects in related modules.
- **Refactoring:** Ask why the refactor is needed and what the specific success criteria are.

**The Golden Rule:** If even 1% of the request is ambiguous, the AI must ask for clarification instead of assuming.

---

## 🔍 Request Classification

The complexity of the task determines which "Tiers" of the AI's capabilities are activated:

| Class | Activity | Tiers | Outcome |
| :--- | :--- | :--- | :--- |
| **QUESTION** | General knowledge / Code explanation | Tier 0 | Direct Answer |
| **SURVEY** | Analysis of existing codebase patterns | Tier 0 + Explorer | Session Intel / Summary |
| **SIMPLE CODE** | Single file fixes or minor UI tweaks | Tier 0 + Tier 1 (Lite) | Code Block / Inline Edit |
| **COMPLEX CODE** | Multi-file features / Database migrations | Tier 0 + Tier 1 + Agent | `{task-slug}.md` Plan |

---

## 🤖 Intelligent Agent Routing

Based on the classification, the AI must adopt a specific persona and declare it to the user:

*   **`@[frontend-specialist]`**: Expertise in `packages/ui` (MUI/React), React Hook Form, and `apps/web`.
*   **`@[backend-specialist]`**: Expertise in `apps/api`, Drizzle ORM, tRPC, and Fastify.
*   **`@[devops-specialist]`**: Expertise in monorepo structure, scripts, and deployment.
*   **`@[ai-specialist]`**: Expertise in `apps/ai-gateway`, `apps/hermes-agency`, and LangGraph.

**Example Trace:**
> 🤖 **Applying knowledge of `@[backend-specialist]` with skill `@[skills/database]`...**
> I have determined that we need a new migration in `apps/api/src/db/migrations`. Before I proceed, [Socratic Questions]...

---

## 🛠 Global Standards & Conventions

### 1. Language & Coding Style
- **Internal/Thought:** The AI thinks and plans in English.
- **User Interface:** The AI responds to the user in their preferred language.
- **Code:** All variables, function names, comments, and internal documentation **must be in English**.
- **Types:** Strict TypeScript is non-negotiable. Avoid `any` at all costs. Use Zod schemas from `packages/zod-schemas` for data validation.

### 2. Architecture Compliance
- **Schemas:** All shared models must be defined in `packages/zod-schemas` (e.g., `UserCreateInput`, `AddressSelectAll`).
- **UI Components:** Reusable atoms and molecules belong in `packages/ui`. Use specialized wrappers like `RhfTextField`, `RhfSelect`, or `RhfCheckbox` for forms.
- **Error Handling:** Use the `AppError` class (found in `apps/api/src/middlewares/errorHandler.ts`) for backend failures.
- **Database:** All table definitions must use Drizzle ORM (e.g., `UsersTable`, `SubscriptionsTable`, `LeadsTable`).

### 3. Documentation (The `{task-slug}.md` Rule)
For "Complex Code" or "Design" requests, the AI must create a planning document (`docs/tasks/{task-slug}.md`) before implementation. This document must include:
1.  **Objective:** High-level summary of the goal.
2.  **Affected Files:** Specific list of files to be created or modified.
3.  **Step-by-Step Plan:** The sequence of implementation (e.g., 1. Schema, 2. Migration, 3. tRPC Router, 4. UI Page).
4.  **Verification:** Definition of done and testing steps.

---

## 📂 Skill Index Reference

The AI leverages specialized skill modules located in the `skills/` directory:
- **`clean-code`**: Standard formatting and architectural patterns.
- **`database`**: Drizzle ORM usage and migration protocols for tables like `ServiceOrderTable` or `JournalEntryTable`.
- **`trpc`**: Communication patterns between `web` and `api` using `AppTrpcRouter`.
- **`ui-components`**: MUI customization, `ThemeProvider`, and building with components in `packages/ui/src/components`.
- **`ai-agents`**: `apps/hermes-agency` logic, LangGraph implementations, and agency skills (e.g., `routeToSkill`).

## 🧱 Key System Archetypes

| Category | Primary Symbols |
| :--- | :--- |
| **Logic/Controllers** | `ServiceOrderTable`, `UsersTable`, `McpConectoresTable`, `KanbanBoardsTable` |
| **Data Schemas** | `UserCreateInput`, `AddressSelectAll`, `ChatCompletionRequest`, `TechnicalReportCreateInput` |
| **Utility/Auth** | `authLoader`, `checkRateLimit`, `applyPtbrFilter`, `acquireLock`, `apiKeyAuthHook` |
| **Error Handling** | `AppError`, `CustomError`, `errorHandler` |
| **UI Framework** | `RhfFormProvider`, `useRhfForm`, `ContentCard`, `PrimaryButton` |
