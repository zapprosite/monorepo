# Architecture Guide

This document provides a comprehensive overview of the system architecture, design patterns, and technical structure of the monorepo.

## System Topology

The project is structured as a **Modular Monolith** within a monorepo. This approach balances developer productivity and type safety with a clear separation of concerns, allowing specific domains to be extracted into independent services if needed in the future.

### Core Architecture Layers

| Layer | Responsibility | Key Technologies |
|:---|:---|:---|
| **Frontend** | User interface and client-side state management. | React, Vite, tRPC Client, MUI |
| **Transport** | Type-safe communication between client and server. | tRPC, Fastify |
| **API Gateway** | RESTful entry point for external integrations and AI tools. | Fastify, Zod |
| **Business Logic** | Domain-specific modules (Auth, CRM, Kanban). | TypeScript, Zod |
| **Orchestrator** | Agentic workflows, LLM routing, and MCP integrations. | LangGraph, LiteLLM, Qdrant |
| **Data Layer** | Schema definition, migrations, and query building. | PostgreSQL, Orchid ORM |

---

## Technical Stack & Packages

### Shared Packages (`/packages`)
- **`zod-schemas`**: The single source of truth for validation. It generates the types for the database layer, API validation, and frontend forms.
- **`ui`**: Centralized library of React components, MUI theme configurations, and custom hook-based form builders (`rhf-form`).

### Applications (`/apps`)
- **`apps/api`**: Primary backend hosting the tRPC server for the web app and a REST API Gateway for external products.
- **`apps/web`**: Administrative and user dashboard built with React.
- **`apps/hermes-agency`**: AI/Agentic service managing long-running workflows with LangGraph and vector search via Qdrant.
- **`apps/ai-gateway`**: Specialized proxy for LLM requests (OpenAI-compatible) with built-in Portuguese language filtering and audio/vision processing.

---

## Key Design Patterns

### 1. Unified Schema Validation
The system uses Zod schemas defined in `packages/zod-schemas` to synchronize types across the stack.
*   **Database**: Orchid ORM uses schemas (e.g., `AddressesTable`) for type-safe queries.
*   **API**: Fastify/tRPC uses inputs like `UserCreateInput` and outputs like `UserSelectAll`.
*   **Frontend**: React Hook Form uses these schemas via the `useRhfForm` hook for validated inputs.

### 2. Domain-Driven Modules
Backend logic is partitioned into modules in `apps/api/src/modules/`. Each module typically contains:
*   `*.table.ts`: Database table definitions (e.g., `LeadsTable`, `ContractsTable`).
*   `*.router.ts`: tRPC or REST route definitions.
*   `__tests__`: Domain-specific integration tests.

### 3. Agentic Workflow (Hermes Agency)
The AI layer uses an **Agentic Router** pattern:
*   **CEO/Router**: Analyzes user intent using `askCeoToRoute` and routes to specific "Skills".
*   **Skills**: Modular executable units (e.g., `executeStatusUpdate`, `social_calendar`).
*   **Human-in-the-loop**: Approval stages in the graph (e.g., `approveContentPipeline`) allow manual oversight via Telegram or Web UI.

### 4. Distributed Locking & Rate Limiting
To handle concurrent agent operations and external API constraints:
*   **Redis-backed locks**: Managed via `distributed_lock.ts` (`acquireLock`) to prevent race conditions during stateful operations.
*   **Circuit Breakers**: Implemented in `agency_router.ts` to fail fast when external AI services or specific skill integrations are unstable.
*   **Rate Limiter**: Tracks usage in `rate_limiter.ts` to respect provider limits across distributed instances.

---

## Data Flow

1.  **Client Request**: A user interacts with a React component in `apps/web`.
2.  **Transport**: The tRPC client sends a request. External tools hit `api-gateway` REST endpoints in `apps/api`.
3.  **Authentication**: Middleware such as `apiKeyAuthHook` or `sessionSecurity` validates the session or API key.
4.  **Logic Execution**: The corresponding module (e.g., `loyalty`, `kanban`) processes the request using Orchid ORM.
5.  **Agent Trigger**: If a workflow is required, the API communicates with `apps/hermes-agency` to trigger a LangGraph execution.
6.  **Response**: Validated data is returned via Zod-serialized objects, ensuring the UI matches the server state exactly.

---

## Infrastructure & Observability

- **Database**: PostgreSQL (Primary) + Qdrant (Vector Store for RAG/Agent Memory).
- **Caching/State**: Redis (used for rate limiting, distributed locks, and session storage).
- **Error Handling**: Custom `AppError` class and `errorParser` utility provide consistent API error responses.
- **Logging**: `requestLogger` middleware tracks API product request logs into the `ApiProductRequestLogsTable` for billing and analytics.

---

## Development Guidelines

- **Adding a Table**: Define the Zod schema in `packages/zod-schemas`, then create the table class inheriting from `BaseTable` in the relevant module in `apps/api/src/modules/`.
- **Cross-Module Logic**: Avoid tight coupling. Interact through service methods or hooks rather than reaching directly into foreign tables where possible.
- **Time Handling**: Always use `timestampNumber` (Unix epoch milliseconds) for date-time fields to avoid timezone ambiguity during JSON serialization and across different service runtimes (Python/Node).
- **UI Components**: Primarily use components from `packages/ui` (e.g., `RhfTextField`, `PrimaryButton`). Avoid creating local versions of buttons or inputs to maintain design system consistency.
