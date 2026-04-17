# Glossary & Domain Concepts

This document defines the core terminology, technical constants, and business logic rules used across the monorepo. It serves as a single source of truth for developers to understand the system's domain-driven design and architectural patterns.

## Domain Entities

| Entity | Description | Reference |
| :--- | :--- | :--- |
| **User** | A natural person authenticated via Google OAuth2. Users can belong to multiple Teams. | `UserTable` |
| **Team** | The primary unit of multi-tenancy. All data (Journal Entries, Leads, Contracts) is scoped to a `teamId`. | `TeamTable` |
| **Subscription** | A contractual agreement allowing a Team to consume specific API products (SKUs) within defined quotas. | `SubscriptionsTable` |
| **Journal Entry** | A time-stamped record, often processed via AI prompts, representing the core functional unit of the platform. | `JournalEntryTable` |
| **Service Order** | A specialized entity for managing maintenance or technical requests, including technical reports and materials. | `ServiceOrderTable` |
| **Unit** | A physical or logical location/subset belonging to a Client. | `UnitsTable` |
| **Technical Report** | Detailed documentation linked to a Service Order, often containing findings and resolutions. | `TechnicalReportTable` |

---

## Technical Concepts & Components

### API & Connectivity
- **API Gateway**: A specialized router in `apps/api` that handles external REST traffic. It enforces API Key authentication, IP whitelisting, and rate limiting.
- **tRPC (TypeScript Remote Procedure Call)**: The protocol used for internal communication between the Web app and the API, providing end-to-end type safety without code generation.
- **MCP (Model Context Protocol)**: A standard used to connect AI models to external tools and data sources via adapters (e.g., Claude, Anthropic, Zapier).
- **Webhooks**: Outsource notifications sent to external systems when specific events occur (e.g., status changes or quota alerts).

### AI & Workflow
- **Orchestrator**: The central engine that manages complex multi-step workflows, agentic iterations, and human-in-the-loop approvals.
- **Human Gate**: A workflow checkpoint that pauses execution until a human actor provides manual approval or input.
- **Prompt**: A managed template used to interact with LLMs, versioned and stored in the database.
- **Skill**: A specific capability or tool (e.g., vision analysis, transcription) that the AI Agency can route tasks to.

---

## Key Enumerations

Defined primarily in `packages/zod-schemas/src/enums.zod.ts`.

| Enum | Key Values | Purpose |
| :--- | :--- | :--- |
| **`ApiProductSku`** | `journal_entry_create`, `stt_transcription` | Identifies specific billable API features. |
| **`ApiProductStatus`** | `SUCCESS`, `FAILED`, `EXHAUSTED` | Tracks the outcome of an API request relative to quotas. |
| **`SessionSecurity`** | `Standard`, `Strict` | Controls the level of validation applied to encrypted session cookies. |
| **`AddressType`** | `BILLING`, `SHIPPING`, `RESIDENTIAL` | Categorizes physical locations for CRM entities. |
| **`WebhookStatus`** | `PENDING`, `SENT`, `FAILED` | Tracks the lifecycle of a webhook delivery attempt. |

---

## Core Domain Rules & Invariants

1.  **Multi-Tenancy Isolation**: No query may return data without a `teamId` filter. Cross-team data access is strictly prohibited at the database and middleware levels.
2.  **Quota Enforcement**:
    *   The system monitors `api_product_request_logs` against the team's active `Subscription`.
    *   **90% Rule**: When a team reaches 90% of its monthly quota, the `checkAndQueueWebhookAt90Percent` utility must trigger a notification.
3.  **API Key Security**: API Keys are never stored in plain text. They are transformed using `scrypt` hashing before being persisted to the `ApiKeys` table.
4.  **Session Lifecycle**: Sessions are valid for 7 days. Invalidation is handled via the `markedInvalidAt` timestamp rather than immediate row deletion to maintain audit trails.
5.  **Webhook Reliability**: Failed webhook deliveries must use **Exponential Backoff** for retries, managed via the `WebhookCallQueueTable`.

---

## Acronyms & Abbreviations

*   **RHF**: React Hook Form (Standardized form handling in `packages/ui`).
*   **STT**: Speech-to-Text (e.g., Whisper-based transcription).
*   **TTS**: Text-to-Speech (e.g., Kokoro-based synthesis).
*   **ULID**: Universally Unique Lexicographically Sortable Identifier (Used for non-sequential, sortable DB primary keys).
*   **LLM**: Large Language Model.
*   **CRM**: Customer Relationship Management.

---

## Related Resources
- [Architecture Guide](./architecture.md)
- [Project Overview](./project-overview.md)
