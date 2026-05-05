# System Architecture

This document outlines the high-level architecture, design patterns, and technical structure of the monorepo. The system is designed as a **Modular Monolith**, maximizing type safety via shared schemas while maintaining clear boundaries between domains.

## Core System Topology

The platform provides a suite of CRM, ERP, and AI-driven workflow tools specifically optimized for the HVAC and service industries.

| Layer | Responsibility | Primary Technologies |
|:---|:---|:---|
| **Frontend** | User Interface & Client State | React, Vite, MUI, tRPC Client |
| **API Gateway** | Entry point for Web UI and REST integrations | Fastify, tRPC, Zod |
| **AI Gateway** | Specialized proxy for LLM/OpenAI-compatible flows | Node.js, Groq, OpenAI SDK |
| **Domain Logic** | Business rules for CRM, HVAC, and Financials | TypeScript, Orchid ORM |
| **RAG / AI Engine** | Vector retrieval and Agentic workflows | Python, Qdrant, LangGraph |
| **Data Layer** | Relational and Vector storage | PostgreSQL, Redis, Qdrant |

---

## Workspace Structure

### Shared Packages (`/packages`)
- **`zod-schemas`**: The core source of truth. Defines Zod schemas used for database modeling, API validation, and frontend form validation.
- **`ui`**: Shared component library. Includes the MUI theme, layout components, and a custom React Hook Form integration (`rhf-form`).

### Applications (`/apps`)
- **`apps/api`**: The primary backend. It hosts the tRPC server used by the Web UI and a REST API for external integrations. It handles database migrations and domain modules.
- **`apps/web`**: The main user dashboard. A Single Page Application (SPA) consuming the tRPC API.
- **`apps/ai-gateway`**: A specialized proxy designed to handle Portuguese language filtering (`ptbr-filter`), Speech-to-Text (STT) preprocessing, and model routing.

### Scripts & AI Pipes (`/scripts`)
- **`scripts/hvac-rag`**: A Python-based Retrieval-Augmented Generation (RAG) pipeline. It handles technical manual indexing, field tutor logic, and safety procedure generation.

---

## Architectural Patterns

### 1. Unified Type-Safe Pipeline
The system utilizes **Zod** for "End-to-End Type Safety":
1.  **Database**: Table definitions in `apps/api/src/modules/` (e.g., `ServiceOrderTable`) extend Zod-derived types.
2.  **Transport**: tRPC procedures (e.g., `user-roles.trpc.ts`) use Zod inputs for automatic runtime validation and TypeScript inference on the client.
3.  **UI**: The `useRhfForm` hook in `packages/ui` consumes the same Zod schema to provide validation errors and type-safe form submission.

### 2. Domain-Driven Modules
The backend is organized into vertical modules within `apps/api/src/modules/`. Each module is self-contained:
- **Tables**: `*.table.ts` (e.g., `LeadsTable`, `MaintenancePlansTable`).
- **Logic/Routers**: `*.trpc.ts` or `*.routes.ts`.
- **Tests**: `__tests__` folder for integration testing of that specific domain.

### 3. HVAC RAG Architecture
The RAG pipeline follows a multi-stage process for technical data:
- **Resolver**: The `hvac_resolver.py` maps manufacturer-specific error codes and technical specs to a unified context.
- **Vision**: `hvac_vision.py` processes equipment plate photos to extract model/serial information.
- **Retriever**: Queries `Qdrant` using filtered payloads to find specific service procedures or safety protocols.

### 4. Security & Middleware
- **Session Security**: A multi-level protocol (`sessionSecurity.middleware.ts`) that validates sessions based on IP whitelisting, domain origin, and device fingerprinting.
- **API Secret Guard**: Used in routes like `hvac.routes.ts` to allow specific internal tools (like Open WebUI) to interact with the API without a standard browser session.

---

## Data Flow

### Web Request Flow
1.  **Frontend**: User submits a form (e.g., creating a Service Order).
2.  **tRPC**: Client calls a mutation; Zod validates the input on the client.
3.  **API**: `authMiddleware` verifies the session.
4.  **Service**: The module logic executes (e.g., `service_order.trpc.ts`).
5.  **DB**: Orchid ORM performs a type-safe insert into PostgreSQL.
6.  **Response**: The new record is returned to the UI with exact type matching.

### AI Retrieval Flow (RAG)
1.  **Input**: Technician asks a question via the UI or Telegram.
2.  **Search**: `searchMemories` or `callHvacPipe` is triggered in the API.
3.  **Pipeline**: The Python backend builds a context pack using `hvac_memory_context.py`.
4.  **LLM**: The context is sent to the LLM (via `ai-gateway`) to generate a grounded technical answer.

---

## Database Schema Highlights

The system uses a highly relational structure in PostgreSQL:
- **CRM**: `Clients` -> `Addresses` -> `Units` -> `Equipment`.
- **Operations**: `ServiceOrders`, `MaintenanceSchedules`, and `KanbanBoards`.
- **Infrastructure**: `Users`, `Teams`, `ApiProductRequestLogs`.

---

## Developer Guidelines

1.  **Schema First**: When adding a feature, start by defining the Zod schema in `packages/zod-schemas`.
2.  **Shared UI**: Do not rebuild standard inputs. Use the components in `packages/ui/src/rhf-form` (e.g., `RhfTextField`, `RhfSelect`) to ensure consistent styling and validation.
3.  **Internal APIs**: For cross-app communication (e.g., API calling Python script), use the client wrappers found in `apps/api/src/routes/hvac.client.ts`.
4.  **Error Handling**: Throw `AppError` on the backend. This ensures the frontend receives a parsed, actionable error message via the `trpcErrorParser`.
