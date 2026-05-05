# Glossary & Domain Concepts

This document defines core terminology, technical constants, and business logic rules used across the platform. It serves as the primary reference for understanding the system's domain-driven design and architectural patterns.

## Domain Entities

| Entity | Description | Reference Table |
| :--- | :--- | :--- |
| **User** | A natural person authenticated via Google OAuth2. | `UserTable`, `UserRolesTable` |
| **Team** | The primary unit of multi-tenancy. All business data is scoped to a `teamId`. | `TeamTable` |
| **Subscription** | A contractual agreement defining quotas for API product (SKU) consumption. | `SubscriptionTable` |
| **Journal Entry** | A time-stamped record, often AI-processed, representing the core functional unit. | `JournalEntryTable` |
| **Service Order** | Specialized entity for managing maintenance, technical reports, and materials. | `ServiceOrderTable` |
| **Technical Report** | Detailed documentation linked to a Service Order containing findings and resolutions. | `TechnicalReportTable` |
| **Leads** | Potential clients or business opportunities. | `LeadsTable` |
| **Kanban Board** | Visual management tool organized into `Columns` and `Cards`. | `KanbanBoardsTable` |

---

## Technical Concepts & Components

### API & Connectivity
- **API Gateway**: A specialized router (`apps/ai-gateway`) that handles external traffic, enforcing authentication, PT-BR linguistic filters, and rate limiting via the `SlidingWindowLimiter`.
- **tRPC**: The protocol for internal communication between the Web app and API, ensuring end-to-end type safety. Defined in `apps/api/src/routers/trpc.router.ts`.
- **MCP (Model Context Protocol)**: A standard for connecting AI models to external tools and data sources.
- **Webhooks**: Outbound notifications for external systems, tracked via `WebhookDeliveriesTable`.

### AI & Agency (Hermes)
- **Orchestrator**: The engine managing multi-step workflows, agentic iterations, and human-in-the-loop approvals.
- **RAG (Retrieval-Augmented Generation)**: A technique utilized in `scripts/hvac-rag` to provide AI models with specific context from vector databases (Qdrant).
- **Human Gate**: A checkpoint that pauses execution until manual approval is provided (e.g., `approvecontentPipeline`).
- **Prompt**: A managed template for LLM interaction, versioned in the `PromptsTable`.
- **Skill**: A modular capability (e.g., `make_pdf`, `vision_analysis`) that the Agency can execute.

---

## Key Enumerations

Defined in `packages/zod-schemas/src/enums.zod.ts` and `crm_enums.zod.ts`.

| Enum | Key Values | Purpose |
| :--- | :--- | :--- |
| **`ApiProductSku`** | `journal_entry_create`, `stt_transcription` | Identifies billable API features. |
| **`ApiProductStatus`** | `SUCCESS`, `FAILED`, `EXHAUSTED` | Tracks API request outcomes relative to quotas. |
| **`SessionSecurity`** | `Standard`, `Strict` | Level of validation for encrypted session cookies. |
| **`AddressType`** | `BILLING`, `SHIPPING`, `RESIDENTIAL` | Categorizes physical locations for CRM entities. |
| **`WebhookStatus`** | `PENDING`, `SENT`, `FAILED` | Tracks the lifecycle of a webhook delivery attempt. |

---

## Business Logic & Invariants

1.  **Multi-Tenancy Isolation**: Queries are strictly filtered by `teamId`. Cross-team data access is prohibited at the database schema and middleware levels.
2.  **Quota Enforcement**: The system monitors `api_product_request_logs` against the team’s `Subscription`. A notification is triggered when a Team reaches 90% of its monthly quota.
3.  **Security Guards**:
    *   **IP Whitelisting**: Managed via `isIPWhitelisted` to restrict access to sensitive endpoints.
    *   **API Secret Guard**: Internal guard (`validateApiSecret`) allowing tools like Open WebUI to interact with the API without a standard user session.
4.  **Session Lifecycle**: sessions are stored in `DatabaseSessionStore`. Invalidation utilizes the `markedInvalidAt` timestamp to maintain audit trails while revoking access.
5.  **Data Persistence**: Primary keys typically use **ULIDs** or standard UUIDs for non-sequential, sortable, and globally unique identification.

---

## Acronyms & Abbreviations

*   **CRM**: Customer Relationship Management (Clients, Contacts, Addresses).
*   **LLM**: Large Language Model (e.g., GPT-4, Claude).
*   **PT-BR**: Portuguese (Brazilian). The system uses `applyPtbrFilter` to ensure responses adhere to regional language standards.
*   **RHF**: React Hook Form (Standardized framework in `packages/ui/src/rhf-form`).
*   **STT / TTS**: Speech-to-Text and Text-to-Speech capabilities.
*   **ULID**: Universally Unique Lexicographically Sortable Identifier.

---

## Related Resources
- [Architecture Guide](./architecture.md)
- [Project Overview](./project-overview.md)
