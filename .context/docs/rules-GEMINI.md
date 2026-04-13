# GEMINI.md - AI Agent & Skill Protocol

The `docs/rules-GEMINI.md` file defines the **Antigravity Kit**, a set of mandatory protocols governing how AI agents interact with the monorepo. It establishes a tiered execution model, request classification systems, and a "Socratic Gate" to ensure high-quality, intentional code generation.

## 📋 Core Execution Protocol

Before performing any implementation, the AI follows a strict three-step lifecycle:

1.  **Read Rules**: Consult `GEMINI.md` (P0 priority).
2.  **Check Frontmatter**: Identify the specific Agent and Skills required for the task (P1 priority).
3.  **Load Skills**: Reference the `SKILL.md` index and relevant sub-sections (P2 priority).

### Selective Reading Strategy
To optimize context and performance, the system follows a **Selective Reading** approach:
- Read the `SKILL.md` index first.
- Only load specific technical sections that directly match the user's request.
- **Forbidden:** Reading all files in a skill folder simultaneously.

---

## 🔍 Request Classification (Step 1)

All incoming requests are classified to determine the necessary depth of intervention:

| Type | Keywords | Active Tiers | Outcome |
| :--- | :--- | :--- | :--- |
| **QUESTION** | "what is", "how does" | Tier 0 | Text Response |
| **SURVEY/INTEL** | "analyze", "list files" | Tier 0 + Explorer | Session Intel |
| **SIMPLE CODE** | "fix", "add" (single file) | Tier 0 + Tier 1 (lite) | Inline Edit |
| **COMPLEX CODE** | "build", "implement" | Tier 0 + Tier 1 + Agent | `{task-slug}.md` |
| **DESIGN/UI** | "design", "page" | Tier 0 + Tier 1 + Agent | `{task-slug}.md` |

---

## 🤖 Intelligent Agent Routing (Step 2)

The AI automatically selects specialized personas based on the request domain. When an agent is activated, it must be declared to the user:

**Example Interaction:**
> 🤖 **Applying knowledge of `@[frontend-specialist]`...**
>
> [Specialized implementation follows]

---

## 🛑 Global Socratic Gate (Tier 0)

**Mandatory Rule:** No tools or code implementation may begin until the request passes the Socratic Gate.

### Strategy by Request Type
- **New Features:** Must ask at least **3 strategic questions** regarding architecture and purpose.
- **Bug Fixes:** Confirm context and ask about collateral impact.
- **Vague Requests:** Ask for explicit scope, target users, and intended purpose.

**The Golden Rule:** If even 1% of the request is ambiguous, the AI must ask for clarification instead of assuming.

---

## 🛠 Global Standards

### Language Handling
- **Internal Processing:** Prompts are translated to English for internal comprehension.
- **User Facade:** Responses are delivered in the user's language.
- **Code Standards:** All variables, comments, and documentation within code must remain in **English**.

### Clean Code
All generated code is bound by the rules defined in `@[skills/clean-code]`. This includes:
- Strict adherence to TypeScript types.
- Modular architecture consistent with the "Architecture" section of the codebase context.
- Proper error handling using the `AppError` class or `trpcErrorParser`.

---

## 📂 Implementation Reference

For complex tasks, the AI is required to generate or update a `{task-slug}.md` file. This ensures that:
1. The plan is documented before execution.
2. Changes across multiple packages (e.g., `packages/zod-schemas` and `apps/api`) are tracked.
3. The relationship between UI components in `packages/ui` and business logic in `apps/web` is maintained.
