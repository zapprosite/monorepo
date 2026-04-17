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
- **`zod-schemas`**: The single source of truth for data validation. These schemas drive the database layer, API validation, and frontend forms.
- **`ui`**: A centralized library of React components, theme configurations, and custom hook-based form builders (`rhf-form`).

### Applications (`/apps`)
- **`apps/api`**: The primary backend. It hosts the tRPC server for the web app and a REST API Gateway for external products.
- **`apps/web`**: The main administrative and user dashboard.
- **`apps/hermes-agency`**: The AI/Agentic service. It manages long-running workflows using LangGraph and provides vector search capabilities via Qdrant.
- **`apps/ai-gateway`**: A specialized proxy for handling LLM requests (OpenAI-compatible) with built-in filtering (e.g., PT-BR filters).

---

## Key Design Patterns

### 1. Unified Schema validation
The system uses Zod schemas defined in `packages/zod-schemas` to synchronize types across the entire stack.
*   **Database**: Orchid ORM uses these schemas for type-safe queries.
*   **API**: Fastify/tRPC uses them to validate inputs (`UserCreateInput`) and format outputs (`UserSelectAll`).
*   **Frontend**: React Hook Form uses the same schemas for client-side validation.

### 2. Domain-Driven Modules
The backend logic is partitioned into modules found in `apps/api/src/modules/`. Each module typically contains:
*   `*.table.ts`: Database table definitions.
*   `*.router.ts`: tRPC or REST route definitions.
*   `__tests__`: Unit and integration tests for that specific domain.

### 3. Agentic Workflow (Hermes Agency)
The AI layer uses an **Agentic Router** pattern:
*   **CEO/Router**: Analyzes user intent and routes to specific "Skills".
*   **Skills**: Modular executable units (e.g., `executeStatusUpdate`, `social_calendar`).
*   **Human-in-the-loop**: Approval stages in the graph (e.g., `approveContentPipeline`) allow manual oversight of AI-generated content.

### 4. Distributed Locking & Rate Limiting
To handle concurrent agent operations and external API constraints, the system implements:
*   **Redis-backed locks**: Found in `distributed_lock.ts` to prevent race conditions during agent executions.
*   **Circuit Breakers**: Implemented in the `agency_router.ts` to fail fast when external AI services or skills are unstable.

---

## Data Flow

1.  **Client Request**: A user interacts with a React component in `apps/web`.
2.  **Transport**: The tRPC client sends a request. If it's an external tool, it hits the `api-gateway` REST endpoint.
3.  **Authentication**: Middleware (`apiKeyAuthHook` or `sessionSecurity`) validates the request.
4.  **Logic Execution**: The corresponding module (e.g., `loyalty`, `kanban`) processes the request using Orchid ORM.
5.  **Agent Trigger**: If a workflow is required, the API communicates with `apps/hermes-agency` to trigger a LangGraph execution.
6.  **Response**: The validated data is returned to the client, ensuring the UI matches the server state exactly.

---

## Infrastructure & Deployment

- **Database**: PostgreSQL (Primary) + Qdrant (Vector Store).
- **Caching/State**: Redis (used for rate limiting and distributed locks).
- **Deployment**: Containerized environments (Docker) managed via Coolify.
- **Observability**: Request logging middleware and custom error parsers (`AppError`) provide consistent diagnostic data.

---

## Development Guidelines

- **Adding a Table**: Define the schema in `packages/zod-schemas`, then create the table definition in the relevant module in `apps/api`.
- **Cross-Module Logic**: Avoid tight coupling between modules. If `Module A` needs data from `Module B`, interact through service methods rather than reaching directly into foreign tables where possible.
- **Time Handling**: Always use `timestampNumber` (Unix epoch milliseconds) for date-time fields to avoid timezone ambiguity during serialization.
