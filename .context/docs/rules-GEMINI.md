# AI Agent & Skill Protocol (The Antigravity Kit)

The `docs/rules-GEMINI.md` protocol defines the mandatory operating procedures for AI agents interacting with this monorepo. It establishes a tiered execution model designed to prevent "hallucination-driven" coding and ensure that every change is intentional, researched, and architecture-compliant.

## 📋 Core Execution Lifecycle

Every AI session must follow this strict priority chain:

1.  **Read Rules (P0):** Consult `docs/rules-GEMINI.md` before any action.
2.  **Check Frontmatter (P1):** Identify the required Agent and Skillset based on the task.
3.  **Load Skills (P2):** Reference the `SKILL.md` index and load only the necessary technical sections.

> **Selective Reading Strategy:** Do not ingest entire directories. Read the skill index first, then target-load specific documentation relevant to the current file or logic.

---

## 🛑 Step 1: The Socratic Gate

**Mandatory Rule:** No implementation tools may be used until the request passes the Socratic Gate. The AI must clarify 100% of the intent before writing code.

### Strategy by Request Type
- **New Features:** Ask at least **3 strategic questions** regarding architecture (e.g., "Should this schema live in `zod-schemas` or is it local to the app?").
- **Bug Fixes:** Confirm the reproduction steps and ask about potential side effects in related modules.
- **Refactoring:** Ask why the refactor is needed and what the success criteria are.

**The Golden Rule:** If even 1% of the request is ambiguous, the AI must ask for clarification instead of assuming.

---

## 🔍 Step 2: Request Classification

The complexity of the task determines which "Tiers" of the AI's capabilities are activated:

| Class | Activity | Tiers | Outcome |
| :--- | :--- | :--- | :--- |
| **QUESTION** | General knowledge / Code explanation | Tier 0 | Direct Answer |
| **SURVEY** | Analysis of existing codebase patterns | Tier 0 + Explorer | Session Intel / Summary |
| **SIMPLE CODE** | Single file fixes or minor UI tweaks | Tier 0 + Tier 1 (Lite) | Code Block / Inline Edit |
| **COMPLEX CODE** | Multi-file features / Database migrations | Tier 0 + Tier 1 + Agent | `{task-slug}.md` Plan |

---

## 🤖 Step 3: Intelligent Agent Routing

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
- **Types:** Strict TypeScript is non-negotiable. Avoid `any` at all costs.

### 2. Architecture Compliance
- **Schemas:** All shared models must be defined in `packages/zod-schemas`.
- **UI Components:** Reusable atoms and molecules belong in `packages/ui`.
- **Error Handling:** Use the `AppError` class (found in `apps/api/src/middlewares/errorHandler.ts`) for backend failures.

### 3. Documentation (The `{task-slug}.md` Rule)
For "Complex Code" or "Design" requests, the AI must create a planning document (`docs/tasks/{task-slug}.md`) before implementation. This document must include:
1.  **Objective:** What are we building?
2.  **Affected Files:** List of files to be created/modified.
3.  **Step-by-Step Plan:** The sequence of implementation (e.g., 1. Schema, 2. Endpoint, 3. UI).
4.  **Verification:** How will we test this?

---

## 📂 Skill Index Reference

The AI uses the following skill categories located in the `skills/` directory:
- **`clean-code`**: Standard formatting and architectural patterns.
- **`database`**: Drizzle ORM usage (e.g., `UsersTable`, `TeamTable`) and migration protocols.
- **`trpc`**: Communication patterns between `web` and `api` using the `AppTrpcRouter`.
- **`ui-components`**: Theming (MUI), specialized wrappers (e.g., `RhfTextField`), and `packages/ui` usage.
- **`ai-agents`**: LangGraph, LiteLLM, tool-calling structures, and agency routing (`routeToSkill`).

## 🧱 Key System Archetypes

When working within this protocol, refer to these core classes and structures:
- **Controllers/Tables**: `UsersTable`, `SubscriptionsTable`, `ServiceOrderTable`.
- **Zod Schemas**: `UserCreateInput`, `AddressSelectAll`, `ChatCompletionRequest`.
- **Utility Functions**: `authLoader`, `checkRateLimit`, `applyPtbrFilter`.
- **Error Management**: `AppError`, `CustomError`.
