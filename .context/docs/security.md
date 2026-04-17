# Security & Compliance

This document outlines the security architecture, authentication mechanisms, secrets management, and compliance guardrails implemented within the monorepo. It serves as the primary technical reference for maintaining a secure environment across the API, AI Gateway, and Web applications.

## Security Philosophy

The project follows a **Secure by Design** approach:
- **Strict Input Validation**: Every entry point (tRPC or REST) uses Zod schemas from `packages/zod-schemas` to parse, validate, and strip unknown fields.
- **Zero Trust Internal Communication**: Services communicating internally require shared secret authentication via `INTERNAL_API_SECRET`.
- **Defense in Depth**: Security is applied at the Network (CORS/IP Whitelisting), Middleware (Session/API Key), and Application (RBAC) layers.

---

## Authentication & Session Management

### Identity Providers
The primary identity provider is **Google OAuth2**. The flow is managed by the `googleOAuth2Plugin` in `apps/api`:
1. User authenticates via the Google consent screen.
2. The plugin handles the callback, exchanges the code for tokens, and fetches profile data.
3. If valid, a user record is retrieved or created in the `UserTable`.

### Session Architecture
Sessions are managed using a database-backed store to ensure consistency across horizontal scaling.

- **Storage**: Sessions are persisted in the `SessionTable` using `DatabaseSessionStore`.
- **Security Middleware**: The `sessionSecurityHook` (defined in `apps/api/src/middlewares/sessionSecurity.middleware.ts`) monitors for session hijacking by comparing:
    - **IP Address**: Checks if the request originated from a known subnet.
    - **Device Fingerprint**: Validates browser/client consistency.
- **Leveling**: The system supports escalating security levels (e.g., `SessionSecurityLevel.STRICT`) for sensitive operations.

### API Gateway Security
For external programmatic access (`/api/v1/*`), the gateway utilizes:
- **API Keys**: Keys are generated using `generateApiKey` and stored as scrypt hashes (`hashApiKey`). They are verified via `apiKeyAuthHook`.
- **IP & Domain Filtering**: The `ipWhitelistCheckHook` and `corsValidationHook` restrict traffic based on `team.allowedIps` and `team.allowedDomains`.
- **Rate Limiting**: Implemented via Redis to prevent DoS attacks on AI inference and data endpoints.

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
Secrets are never hardcoded and are managed through environment variables validated at boot by `packages/env`.

- **At Rest**: Sensitive database fields (like `apiSecretHash`) utilize hashing.
- **In Transit**: All external traffic is TLS-encrypted. Internal service metadata is stripped of secrets before being logged.
- **Exposure Prevention**: Zod schemas use `.omit()` or `.strip()` on sensitive fields (like passwords or secret hashes) before returning data to the frontend.

### Critical Secrets Reference
| Key | Usage |
| :--- | :--- |
| `SESSION_SECRET` | Used by Fastify-session to sign cookies. |
| `INTERNAL_API_SECRET` | Header-based auth for internal microservices. |
| `ENCRYPTION_KEY` | Used for encrypting sensitive integration credentials. |

---

## Compliance & Privacy

### GDPR / LGPD Readiness
- **Data Minimization**: We store only the minimum OAuth2 scope required (email, name, avatar).
- **Right to Erasure**: Implementation of `invalidateAllUserSessions(userId)` and cascaded deletes on user records.
- **Data Portability**: Standardized JSON exports are available for user-owned entities (Kanban, Journal, Service Orders).

### AI & Prompt Security
- **Prompt Injection**: The `sanitizeForPrompt` function in the Agency Router scrubs user input before passing it to LLMs.
- **Auditability**: All AI requests are logged in the `ApiProductRequestLogsTable`, recording the model, tokens used, and the calling team for billing and security auditing.

### Webhook Security
Outbound webhooks (managed via `WebhooksTable`) include:
- **Signatures**: Payloads are signed with a secret to allow the receiver to verify the source.
- **Retries**: Exponential backoff prevents accidental self-denial of service during target outages.

---

## Incident Response

If a security anomaly is detected (e.g., a `SECURITY_VIOLATION` AppError):

1. **Automatic Containment**: The system may automatically invalidate the session if a fingerprint mismatch is high-confidence.
2. **Manual Revocation**: Admins can use `invalidateAllUserSessions(userId)` to immediately clear all active sessions for a compromised account.
3. **Audit Trail**: Investigators should query `ApiProductRequestLogsTable` and system logs for the specific `traceId` associated with the violation.

---

**Related Documentation:**
- [Architecture Overview](./architecture.md)
- [Database Schema Reference](../apps/api/src/db/schema.ts)
