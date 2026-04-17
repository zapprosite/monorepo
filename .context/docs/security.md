# Security & Compliance

This document outlines the security architecture, authentication mechanisms, secrets management, and compliance guardrails implemented within the monorepo. It serves as the primary technical reference for maintainers and developers working on the API, AI Gateway, and Web applications.

## Security Philosophy

The codebase follows a **Secure by Design** approach:

*   **Strict Input Validation**: Every entry point (tRPC or REST) uses Zod schemas from `packages/zod-schemas` to parse, validate, and strip unknown fields.
*   **Zero Trust Internal Communication**: Services communicating internally require shared secret authentication via `INTERNAL_API_SECRET`.
*   **Defense in Depth**: Security is applied at the Network (CORS/IP Whitelisting), Middleware (Session/API Key), and Application (RBAC) layers.

---

## Authentication & Session Management

### Identity Providers
The primary identity provider is **Google OAuth2**. The flow is managed by the `googleOAuth2Plugin` in `apps/api`:
1.  User authenticates via the Google consent screen.
2.  The plugin handles the callback, exchanges the code for tokens, and fetches profile data (`GoogleUserInfo`).
3.  A user record is retrieved or created in the `UserTable`.

### Session Architecture
Sessions are managed using a database-backed store to ensure consistency across horizontally scaled instances.

*   **Storage**: Sessions are persisted in the `SessionTable` using the `DatabaseSessionStore`.
*   **Security Middleware**: The `sessionSecurityHook` (defined in `apps/api/src/middlewares/sessionSecurity.middleware.ts`) monitors for session hijacking by comparing:
    *   **IP Address**: Checks if the request originated from a known subnet via `areSameSubnet`.
    *   **Device Fingerprint**: Validates browser/client consistency.
*   **Security Levels**: The system supports escalating levels via `SessionSecurityLevel` (e.g., `STRICT`) for sensitive operations.

### API Gateway Security
For external programmatic access (`/api/v1/*`), the gateway utilizes:
*   **API Keys**: Keys are generated via `generateApiKey` and stored as scrypt hashes. They are verified via the `apiKeyAuthHook`.
*   **IP & Domain Filtering**: The `ipWhitelistCheckHook` and `corsValidationHook` restrict traffic based on `team.allowedIps` and `team.allowedDomains`.
*   **Rate Limiting**: Redis-backed rate limiting (implemented in `apps/hermes-agency/src/telegram/rate_limiter.ts`) prevents DoS attacks on inference and data endpoints.

---

## Authorization Model (RBAC)

Access control is enforced through specific tRPC procedure wrappers and Fastify hooks.

| Level | Helper / Wrapper | Context |
| :--- | :--- | :--- |
| **Public** | `publicProcedure` | No auth required; used for health checks and landing pages. |
| **User** | `protectedProcedure` | Requires a valid `userId` in the session. |
| **Strict** | `sensitiveProcedure` | Requires `STRICT` security level (e.g., re-auth or high-confidence fingerprint). |
| **Admin** | `adminProcedure` | Requires the `assertAdmin` check against the `UserRolesTable`. |

---

## Secrets & Data Protection

### Secrets Management
Secrets are managed through environment variables validated at boot. No secrets are hardcoded in the repository.

*   **At Rest**: Sensitive database fields (like `apiSecretHash`) utilize cryptographic hashing.
*   **In Transit**: All external traffic is TLS-encrypted. Internal service metadata is stripped of secrets before being logged via `requestLogger.middleware.ts`.
*   **Exposure Prevention**: Zod schemas use `.omit()` or `.strip()` on sensitive fields (like passwords or secret hashes) before returning data to the frontend.

### Critical Secrets Reference
| Key | Usage |
| :--- | :--- |
| `SESSION_SECRET` | Used by Fastify-session to sign cookies. |
| `INTERNAL_API_SECRET` | Header-based auth for internal microservices. |
| `ENCRYPTION_KEY` | Used for encrypting sensitive integration credentials. |

---

## AI & Prompt Security

The AI Gateway and Hermes Agency implement specific guardrails for Large Language Model interactions:

*   **Prompt Injection**: The `sanitizeForPrompt` function in the Agency Router (`apps/hermes-agency/src/router/agency_router.ts`) scrubs user input to prevent adversarial prompt manipulation.
*   **PT-BR Filtering**: The `applyPtbrFilter` middleware ensures language consistency and filters inappropriate content for specific markets.
*   **Auditability**: All AI requests are logged in the `ApiProductRequestLogsTable`, recording:
    *   Target Model
    *   Token usage (Input/Output)
    *   Request Status (`ApiProductRequestStaus`)
    *   Calling Team ID for billing and security auditing.

---

## Webhook Security

Outbound webhooks (managed via `WebhooksTable`) implement several safety features:

1.  **Signatures**: Payloads are signed with a secret hash to allow receivers to verify the source.
2.  **Delivery Tracking**: The `WebhookDeliveriesTable` tracks every attempt, including response codes and latencies.
3.  **Queue Management**: The `WebhookCallQueueTable` manages asynchronous delivery with exponential backoff to prevent self-denial of service.

---

## Incident Response

If a security anomaly is detected (e.g., a `SECURITY_VIOLATION` or `AppError` is thrown):

1.  **Automatic Containment**: The `sessionSecurity.middleware.ts` may automatically invalidate a session if a fingerprint mismatch is detected with high confidence.
2.  **Manual Revocation**: Admins can utilize `invalidateAllUserSessions(userId)` (found in session utilities) to immediately clear all active sessions for a compromised account.
3.  **Audit Trail**: Investigators should use the `traceId` from the error logs to query `ApiProductRequestLogsTable` and system-level logs for a full execution timeline.

---

### Related Documentation
*   [Architecture Overview](./architecture.md)
*   [API Development Guide](./api-development.md)
