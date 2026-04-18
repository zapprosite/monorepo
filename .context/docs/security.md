# Security & Compliance Documentation

This document outlines the security architecture, authentication protocols, and safety mechanisms implemented across the monorepo. It serves as a technical reference for developers maintaining the API, AI Gateway, and Hermes Agency services.

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
Sessions are stateful and managed through `DatabaseSessionStore` (PostgreSQL).
- **Security Hook**: The `sessionSecurityHook` in `apps/api/src/middlewares/sessionSecurity.middleware.ts` performs real-time verification:
    - **IP Subnet Integrity**: Uses `areSameSubnet` to prevent session hijacking from impossible locations.
    - **Fingerprinting**: Compares `User-Agent` and client signatures.
    - **Levels**: Supports `SessionSecurityLevel.LOW` for general browsing and `STRICT` for sensitive operations.

### Programmatic API Access (Gateway)
External access to the `ai-gateway` and specific API endpoints uses:
- **API Keys**: Generated as high-entropy strings and stored as **scrypt hashes**.
- **Middleware**: `apiKeyAuthHook` handles extraction and verification.
- **IP Filtering**: Requests are limited to `allowedIps` defined in the Team's subscription.

---

## Authorization Model (RBAC)

Access is managed through tRPC procedure wrappers that enforce permissions at the controller level.

| Procedure Type | Access Requirement | Implementation |
| :--- | :--- | :--- |
| `publicProcedure` | None | Open endpoints (e.g., Marketing). |
| `protectedProcedure` | Valid Session | Standard user actions. |
| `sensitiveProcedure` | `STRICT` Security Level | Password changes, API Key management. |
| `adminProcedure` | `assertAdmin` Check | System configuration and moderation. |

---

## Data Protection & Secrets

### Secrets Management
Secrets are injected via environment variables and never committed to version control.
- **Hashing**: `apiSecretHash` is stored using secure hashing algorithms (scrypt), never as plain text.
- **Log Sanitization**: `requestLogger.middleware.ts` redacts sensitive keys (e.g., `password`, `apiKey`, `token`) from logs.
- **Data Stripping**: Zod schemas utilize `.strip()` or `.omit()` to ensure sensitive database fields (like `passwordHash`) are never serialized in JSON responses.

### Critical Secrets
| Environment Variable | Description |
| :--- | :--- |
| `INTERNAL_API_SECRET` | Authenticates AI-Gateway to API requests. |
| `SESSION_SECRET` | Used to sign the session cookies. |
| `ENCRYPTION_KEY` | Encrypts external integration tokens (e.g., Telegram Bot). |

---

## AI & Prompt Security

The **AI Gateway** and **Hermes Agency** implement guardrails for LLM interactions:

### Injection & Toxicity Prevention
- **Prompt Sanitization**: `sanitizeForPrompt` in `apps/hermes-agency/src/router/agency_router.ts` scrubs user text to prevent jailbreak attempts.
- **Language Filtering**: `applyPtbrFilter` in `apps/ai-gateway/src/middleware/ptbr-filter.ts` ensures language compliance and masks inappropriate content.

### Infrastructure Protection
- **Rate Limiting**: A Redis-backed sliding window rate limiter (`apps/hermes-agency/src/telegram/rate_limiter.ts`) prevents cost exhaustion.
- **File Validation**: `validateFile` in `apps/hermes-agency/src/telegram/file_validator.ts` checks magic bytes (MIME types) for uploaded media to prevent malicious file execution.

---

## Webhook Security

The outbound webhook system ensures secure delivery to third-party endpoints:
1.  **HMAC Signatures**: Every request includes an `X-Hub-Signature` (HMAC-SHA256) for sender verification.
2.  **Retry Strategy**: Employs exponential backoff via `WebhookCallQueueTable` to prevent DoS-ing target servers.
3.  **Schema Isolation**: Payloads use specific "Public" schemas from `packages/zod-schemas` to prevent leaking internal database IDs or metadata.

---

## Incident Response & Monitoring

### Audit Trail
The `ApiProductRequestLogsTable` tracks high-value operations:
- **Who**: `teamId` and `userId`.
- **What**: Token usage, model parameters, and endpoint accessed.
- **Result**: Request status, latency, and success/failure markers.

### Emergency Actions
- **Session Revocation**: Call `invalidateAllUserSessions(userId)` to disconnect a compromised account immediately.
- **Circuit Breakers**: `circuit_breaker.ts` in Hermes Agency automatically disables failing integrations to isolate failures.
- **Tracing**: Use the `traceId` found in error logs to query unified logs across `apps/api` and `apps/ai-gateway`.

---

### Related Resources
- [Architecture Overview](./architecture.md)
- [API Development Guide](./api-development.md)
