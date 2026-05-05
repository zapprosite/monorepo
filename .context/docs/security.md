# Security & Compliance Documentation

This document outlines the security architecture, authentication protocols, and safety mechanisms implemented across the monorepo. It serves as a technical reference for developers maintaining the API, AI Gateway, and RAG services.

## Security Philosophy

The platform follows a **Secure by Design** framework focused on three core pillars:
1.  **Strict Type Safety**: Every input/output boundary is enforced by [Zod](https://zod.dev) schemas (`packages/zod-schemas`) to prevent injection and data leakage.
2.  **Zero Trust Communication**: Service-to-service calls (e.g., AI Gateway to API) require shared secret authentication via `INTERNAL_API_SECRET`.
3.  **Comprehensive Auditing**: Sensitive mutations and AI inferences are logged with metadata for forensic analysis.

---

## Authentication & Identity

### User Authentication (OAuth2)
Primary authentication is handled via **Google OAuth2** in `apps/api/src/modules/auth/oauth2/google-oauth2.auth.plugin.ts`.
- **Flow**: Authorize → Exchange Code → Fetch Profile → Sync `UserTable`.
- **Roles**: Users are assigned roles via `UserRolesTable`. Permissions are checked during tRPC procedure execution.

### Session Management
Sessions are stateful and managed through `DatabaseSessionStore` (PostgreSQL) in `apps/api/src/modules/auth/session.auth.store.ts`.
- **Security Hook**: The `sessionSecurityHook` performs real-time verification:
    - **IP Subnet Integrity**: Uses `areSameSubnet` to prevent session hijacking from "impossible" network jumps.
    - **Fingerprinting**: `generateDeviceFingerprint` compares `User-Agent` and client signatures across requests.
    - **Levels**: Supports `SessionSecurityLevel` (LOW for general browsing vs. STRICT for sensitive operations).

### Programmatic API Access (Gateway)
External access to the `ai-gateway` and specific API endpoints uses:
- **API Keys**: Generated as high-entropy strings and stored as **scrypt hashes**.
- **Internal Validation**: `validateApiSecret` in `apps/api/src/routes/hvac.routes.ts` acts as an internal guard for automated services (like Open WebUI) to interact with the API without a browser session.
- **IP White-listing**: Functions in `apps/api/src/utils/ip-checker.utils.ts` (e.g., `isIPWhitelisted`, `isDomainWhitelisted`) restrict access to known CIDR ranges.

---

## Authorization Model (RBAC)

Access is managed through tRPC procedure wrappers (found in `apps/api/src/routers/trpc.router.ts`) that enforce permissions at the controller level.

| Procedure Type | Access Requirement | Implementation |
| :--- | :--- | :--- |
| `publicProcedure` | None | Open endpoints (e.g., Health checks). |
| `protectedProcedure` | Valid Session | Standard user actions requiring a login. |
| `sensitiveProcedure` | `STRICT` Security Level | Operations like updating API Keys or secrets. |
| `adminProcedure` | `assertAdmin` Check | Uses `apps/api/src/modules/users/user-roles.trpc.ts`. |

---

## Data Protection & Secrets

### Secrets Management
Secrets are injected via environment variables and never committed to version control.
- **Log Sanitization**: The system redacts sensitive keys (e.g., `password`, `apiKey`, `token`) from logs.
- **Data Stripping**: Zod schemas utilize `.strip()` or `.omit()` to ensure sensitive database fields (like `passwordHash`) are never serialized in JSON responses.
- **Input Validation**: All data entering the system is validated against schemas in `packages/zod-schemas` to prevent XSS or SQL injection.

### Critical Secrets
| Environment Variable | Description |
| :--- | :--- |
| `INTERNAL_API_SECRET` | Authenticates AI-Gateway to API requests. |
| `SESSION_SECRET` | Used to sign session cookies. |
| `GOOGLE_CLIENT_SECRET` | OAuth2 credential for Google identity management. |

---

## AI & Prompt Security

The **AI Gateway** and **HVAC RAG** scripts implement guardrails for LLM interactions:

### Injection & Toxicity Prevention
- **Prompt Isolation**: Use of system messages and strict RAG context templates in `scripts/hvac-rag/hvac_rag_pipe.py` prevents user-provided content from overriding model instructions.
- **Language Filtering**: `applyPtbrFilter` in `apps/ai-gateway/src/middleware/ptbr-filter.ts` ensures language compliance and masks inappropriate content via a sophisticated STT (Speech-to-Text) preprocessing layer.
- **Safety Assertions**: Python-based assertions like `assert_energized_measurement_safe` in `scripts/hvac-rag/hvac_assertions.py` check AI outputs for safety procedures before presenting them to field technicians.

### Infrastructure Protection
- **Rate Limiting**: `SlidingWindowLimiter` in `apps/api/rate_limit.py` prevents cost exhaustion and DoS attacks on expensive AI endpoints.
- **Vision Guardrails**: `build_vision_prompt` monitors image analysis tasks to ensure they remain within technical HVAC diagnostic bounds.

---

## Webhook Security

The outbound webhook system ensures secure delivery to third-party endpoints:
1.  **HMAC Signatures**: Every request includes an `X-Hub-Signature` (HMAC-SHA256) for sender verification.
2.  **Retry Strategy**: Employs exponential backoff via `WebhookCallQueueTable` to prevent DoS-ing target servers during outages.
3.  **Isolation**: Payloads use specific "SelectAll" schemas from `packages/zod-schemas` to ensure internal metadata (like `deletedAt`) is never exposed.

---

## Incident Response & Monitoring

### Audit Trail
The system tracks high-value operations using `ApiProductRequestLogTable`:
- **Traceability**: Tracks `teamId`, `userId`, `method`, and `status`.
- **Latency**: Logs performance metrics to identify potential timing attacks or resource exhaustion.
- **Error Context**: `AppError` and `trpcErrorParser` provide standardized error codes (e.g., `UNAUTHORIZED`, `FORBIDDEN`) while hiding stack traces in production.

### Emergency Actions
- **Session Revocation**: Database-backed sessions allow immediate revocation of a specific `sessionId` or all sessions for a `userId`.
- **IP Blocking**: Administrators can update white-lists dynamically to block malicious traffic patterns.
- **Tracing**: Use the `traceId` found in `Fastify` logs to query unified logs across `apps/api` and `apps/ai-gateway`.

---

### Related Resources
- [Architecture Overview](./architecture.md)
- [API Development Guide](./api-development.md)
