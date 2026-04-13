# Architecture Notes

The system is designed as a **Modular Monolith** within a monorepo structure. This design choice prioritizes developer velocity and type safety by keeping the backend and frontend in a single repository while strictly enforcing domain boundaries through a directory-per-module pattern. The architecture avoids the operational complexity of microservices but maintains a "service-ready" structure where domains (e.g., Auth, Kanban, CRM) are decoupled at the logic layer.

A centralized `packages/zod-schemas` library serves as the single source of truth for data validation, ensuring that the database (Orchid ORM), the API (tRPC/Fastify), and the Frontend (React) always share synchronized type definitions without manual code generation steps.

## System Architecture Overview

The system follows a top-level topology of a **Monolithic Monorepo** deployed as containerized services via Coolify. 

- **Frontend Connectivity:** Requests originate from the browser using the tRPC client, providing a type-safe bridge to the backend procedures. 
- **Backend Processing:** The backend is powered by **Fastify**, acting as both a tRPC server for the internal frontend and a standard REST API Gateway for external product integrations.
- **Control Pivot:** Control pivots from the transport layer (Fastify/tRPC) to the domain logic layer (Modules) via identified user sessions.
- **Data Layer:** The system uses **PostgreSQL** with **Orchid ORM**, which provides a TypeScript-native query builder that mirrors the Zod schemas used in the upper layers.
- **Orchestration:** A dedicated `orchestrator` service handles complex workflows involving LLMs (Claude/Anthropic), MCP (Model Context Protocol) adapters, and human-in-the-loop approval gates.

## Architectural Layers

- **Apps**: High-level entry points and deployment units (`apps/api`, `apps/web`, `apps/orchestrator`).
- **Modules**: Domain-specific business logic, controllers, and table definitions (`apps/api/src/modules/`).
- **Core Orchestrator**: Workflow engines and state machines for agentic behavior (`apps/orchestrator/src/core/`).
- **Packages**: Shared libraries for schemas, UI components, and environment configuration (`packages/`).

> See [`codebase-map.json`](./codebase-map.json) for complete symbol counts and dependency graphs.

## Detected Design Patterns

| Pattern | Confidence | Locations | Description |
|---------|------------|-----------|-------------|
| **Modular Monolith** | 100% | `apps/api/src/modules/` | Domain-based directory structure with isolated logic. |
| **State Machine** | 90% | `WorkflowStateMachine` | Manages complex LLM-driven workflow states in the orchestrator. |
| **Adapter Pattern** | 95% | `ClaudeMcpAdapter`, `ZapierMcpAdapter` | Standardizes different MCP tool providers into a unified interface. |
| **Middleware Chain** | 100% | `apps/api/src/modules/api-gateway/middleware/` | Sequential processing for API keys, rate limits, and logging. |
| **Repository/Table** | 95% | `*.table.ts` | Orchid ORM table objects acting as the data access layer. |
| **Event Bus** | 80% | `apps/orchestrator/src/core/event-bus.ts` | Decouples workflow steps from side effects like notifications. |

## Entry Points

- [Backend Server (`apps/api/src/server.ts`)](../apps/api/src/server.ts): The main Fastify server entry point.
- [Frontend Entry (`apps/web/src/App.tsx`)](../apps/web/src/App.tsx): React application root with providers.
- [Orchestrator (`apps/orchestrator/src/core/workflow-engine.ts`)](../apps/orchestrator/src/core/workflow-engine.ts): Entry for the agentic workflow system.
- [API Gateway (`apps/api/src/modules/api-gateway/api-gateway.router.ts`)](../apps/api/src/modules/api-gateway/api-gateway.router.ts): REST entry for external consumers.

## Public API

| Symbol | Type | Location |
|--------|------|----------|
| `AppTrpcRouter` | Router | `apps/api/src/routers/trpc.router.ts` |
| `OrchestratorEngine` | Class | `apps/orchestrator/src/core/workflow-engine.ts` |
| `UserTable` | Class | `apps/api/src/modules/users/users/users.table.ts` |
| `createTRPCClient` | Function | `packages/trpc/src/client.ts` |
| `AgentPool` | Interface | `apps/orchestrator/src/modules/agent-pool/types.ts` |
| `ApiKeyAuthHook` | Middleware | `apps/api/src/modules/api-gateway/middleware/apiKeyAuth.middleware.ts` |

## Internal System Boundaries

The system enforces boundaries between **Internal Core** and **External Gateway**:
- **Internal Boundary:** Communication between `apps/web` and `apps/api` is exclusively via tRPC. This boundary assumes a shared session and full trust in the types provided by the shared schema package.
- **External Boundary:** The `api-gateway` module creates a "DMZ" where incoming REST requests are strictly validated, rate-limited by team/subscription quotas, and logged for auditing before hitting internal services.
- **Domain Seams:** Each module in `apps/api/src/modules` is intended to own its tables. Cross-domain queries are minimized, usually handled at the tRPC router aggregation level.

## External Service Dependencies

- **PostgreSQL**: Primary persistence layer.
- **Google OAuth2**: Secondary authentication provider for SSO.
- **Claude/Anthropic API**: Core LLM providers for the Orchestrator.
- **Coolify/CapRover**: Deployment and container orchestration infrastructure.
- **Cloudflare Tunnels**: Secure ingress for local and staging environments.

## Key Decisions & Trade-offs

- **tRPC vs. REST/GraphQL:** tRPC was chosen for the primary internal API to eliminate the need for OpenAPI code generation while maintaining 100% type safety. REST is maintained only for external product APIs where third-party compatibility is required.
- **Epoch Timestamps:** The decision to use `timestampNumber` (milliseconds since epoch) across the DB and API was made to prevent time-zone-related string parsing issues common in JavaScript.
- **Modular vs. Microservices:** A modular monolith was selected to keep deployment simple (single Docker image per app) while allowing for extraction into microservices later if load on specific domains (like the Content Engine) warrants it.

## Top Directories Snapshot

- `apps/api/src/modules/`: ~45 directories (Feature-rich domain layer)
- `apps/web/src/modules/`: ~20 directories (Frontend feature pages)
- `packages/zod-schemas/src/`: ~35 files (Centralized data contracts)
- `apps/orchestrator/src/core/`: ~10 files (Workflow engine internals)

## Related Resources

- [Project Overview](./project-overview.md)
- [Data Flow Documentation](./data-flow.md)
- [Codebase Map](./codebase-map.json)
