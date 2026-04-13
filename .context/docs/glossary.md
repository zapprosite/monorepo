# Glossary & Domain Concepts

The project utilizes a domain-driven approach to manage AI-assisted journal entries, multi-tenant team structures, and a robust API Gateway for external integrations. The system is built on a monorepo architecture where types are shared between the core API, the Orchestrator (workflow engine), and the web frontend.

## Glossary & Domain Concepts

### Domain Entities
- **User**: A natural person authenticated via Google OAuth2. Users can belong to multiple Teams.
- **Team**: The primary unit of multi-tenancy. Subscriptions and API Keys are scoped to a Team.
- **Subscription**: A contractual agreement allowing a Team to consume specific API products (SKUs) within defined quotas.
- **Journal Entry**: The core functional unit of the application—a time-stamped record, often processed via AI prompts.
- **Service Order**: A specialized entity for managing maintenance or technical requests, including technical reports and material items.
- **Orchestrator**: The central engine (located in `apps/orchestrator`) that manages complex workflows, human-in-the-loop approvals, and agentic steps.
- **MCP (Model Context Protocol)**: A standard used to connect AI models to external tools and data sources via adapters (Claude, Anthropic, Zapier).

### Personas / Actors
- **End User**: Interacts with the Web UI to manage personal journal entries and view team dashboards.
- **Team Administrator**: Manages subscriptions, invites members, and monitors API usage/quotas.
- **External Developer**: Consumes the product API via REST endpoints using API Keys.
- **System Agent**: Autonomous and semi-autonomous processes within the Orchestrator that execute workflow steps.

## Type Definitions

Key types are centralized in `packages/zod-schemas` to ensure end-to-end type safety across the monorepo.

- **`UserSelectAll`**: Represents the complete user record including metadata and timestamps. [packages/zod-schemas/src/user.zod.ts]
- **`AgentSession`**: State and history of an active AI agent interaction. [apps/orchestrator/src/core/types.ts]
- **`WorkflowDefinition`**: The blueprint for a multi-phase automated process. [apps/orchestrator/src/core/types.ts]
- **`SubscriptionCreateInput`**: Data required to initialize a new billing/quota relationship for a team. [packages/zod-schemas/src/subscription.zod.ts]
- **`AddressType`**: Contextual categorization for physical locations (e.g., Billing, Shipping). [packages/zod-schemas/src/crm_enums.zod.ts]
- **`SessionUser`**: The subset of user data stored within the encrypted session cookie. [apps/api/src/modules/auth/session.auth.utils.ts]
- **`McpStep`**: A workflow step definition specifically for Model Context Protocol interactions. [apps/orchestrator/src/core/types.ts]

## Enumerations

- **`ApiProductSku`**: Definitive list of sellable API capabilities (e.g., `journal_entry_create`). [packages/zod-schemas/src/enums.zod.ts]
- **`ApiProductStatus`**: State of an API request (Success, Failed, No active subscription, Requests exhausted). [packages/zod-schemas/src/enums.zod.ts]
- **`ApprovalStatus`**: Status of a human-gate intervention (Pending, Approved, Rejected). [apps/orchestrator/src/core/types.ts]
- **`SessionSecurityLevel`**: Controls the strictness of session validation (Standard, Strict). [apps/api/src/middlewares/sessionSecurity.middleware.ts]
- **`WebhookStatus`**: Delivery state for outgoing system events (Pending, Sent, Failed). [packages/zod-schemas/src/enums.zod.ts]
- **`CategoryTemplate`**: Categorization for CRM-related entities. [packages/zod-schemas/src/crm_enums.zod.ts]

## Core Terms

- **tRPC (TypeScript Remote Procedure Call)**: Used for internal communication between the Web app and API. It provides a shared type boundary without needing code generation.
- **API Gateway**: A specialized router in `apps/api` that handles external REST traffic, enforcing API Key authentication, IP whitelisting, and rate limiting.
- **Human Gate**: A workflow checkpoint in the Orchestrator that pauses execution until a human actor provides approval or input.
- **Internal API Secret**: A pre-shared key used for secure communication between internal services (e.g., Orchestrator calling the API's webhook processor).
- **Quota Tracking**: The logic that monitors `api_product_request_logs` against `subscriptions` to enforce usage limits.
- **Exponential Backoff**: The algorithm used by the `webhookQueue` to retry failed deliveries with increasing delays.

## Acronyms & Abbreviations

- **MCP**: Model Context Protocol (AI-to-tool integration standard).
- **RHF**: React Hook Form (Standardized form handling in `packages/ui`).
- **SKU**: Stock Keeping Unit (Used here to identify specific API features for billing).
- **ULID**: Universally Unique Lexicographically Sortable Identifier (Used for non-sequential, sortable database IDs).
- **TRPC**: internal communication protocol ensuring type safety.

## Domain Rules & Invariants

- **Subscription Quota**: When a team reaches 90% of its monthly quota, the system must automatically queue a notification webhook.
- **API Key Security**: API Keys are never stored in plain text. They are hashed using `scrypt` before being persisted to the database.
- **Session Expiry**: Sessions are valid for 7 days. Any "soft-delete" of a session is handled via the `markedInvalidAt` timestamp.
- **Multi-Tenancy**: All data (Journal Entries, Leads, Contracts) must be scoped to a `teamId`. Direct access to data without a valid team context is prohibited by query-level filters.
- **Workflow Persistence**: Every step of an Orchestrator workflow must be logged to the `EventBus` to allow for state recovery and auditability.

## Related Resources
- [Project Overview](./project-overview.md)
- [Architecture Guide](./architecture.md)
