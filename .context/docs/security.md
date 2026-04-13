# Security & Compliance Notes

This document outlines the security policies, authentication mechanisms, secrets management, and compliance guardrails implemented within the monorepo. It serves as a guide for developers to maintain a secure posture when contributing to the API, Orchestrator, or Web applications.

## Security & Compliance Notes

The project operates under a "Secure by Design" philosophy, leveraging Zod for strict input validation, a centralized API Gateway for external traffic, and multi-layered middleware for session integrity. All data access must pass through validated procedures (tRPC) or authenticated REST endpoints.

**Core Guardrails:**
- **Zero Trust Internal Communication:** Internal routes (e.g., `/internal/*`) require shared secret authentication even within the private network.
- **Strict Schema Validation:** Every input into the system is parsed and stripped of unknown fields using Zod schemas found in `packages/zod-schemas`.
- **Least Privilege:** Database roles and API keys are scoped to specific teams and functional requirements.

## Authentication & Authorization

### Identity Providers
The primary identity provider is **Google OAuth2**. The authentication flow follows the standard Authorization Code Flow:
1. User authenticates via Google.
2. The `googleOAuth2Plugin` (in `apps/api`) handles the callback and fetches user info.
3. A session is established and linked to a user record in the `UserTable`.

### Session Management
Identity is maintained using database-backed sessions via the `DatabaseSessionStore`.
- **Persistence:** Sessions are stored in the PostgreSQL `sessions` table, not in-memory, ensuring persistence across server restarts.
- **Expiration:** Sessions are valid for **7 days**. Systematic rotation occurs via `session.regenerate()` upon login/logout.
- **Security Hooks:** The `sessionSecurityHook` monitors for anomalies by comparing the current request's IP address and device fingerprint against the session metadata.

### Authorization Model (RBAC)
Authorizations are managed through specific tRPC procedure wrappers:

| Procedure Level | Requirement | Usage |
| :--- | :--- | :--- |
| `publicProcedure` | None | Landing pages, public assets. |
| `protectedProcedure` | Valid `userId` in session | Standard authenticated user actions. |
| `sensitiveProcedure` | Valid `userId` + `STRICT` security level | Account settings, billing, security-critical configs. |
| `adminProcedure` | `assertAdmin` Check | System-wide configuration and user management. |

### API Gateway Authorization
For external integrations (`/api/v1/*`), the system utilizes:
- **API Keys:** Generated via `generateApiKey` and stored as scrypt hashes (`hashApiKey`).
- **Domain/IP Whitelisting:** The `ipWhitelistCheckHook` and `corsValidationHook` verify that requests originate from `team.allowedIps` or `team.allowedDomains`.

## Secrets & Sensitive Data

### Storage & Management
Secrets are managed through environment variables validated at runtime by `packages/env`.
- **Vaulting:** In production, secrets should be injected via a secret manager (e.g., AWS Parameter Store, HashiCorp Vault).
- **Encryption:** Sensitive fields such as `apiSecretHash` or `subscriptionAlertWebhookBearerToken` are never returned to the frontend; they are explicitly removed using Zod's `.omit()` or `.strip()` methods in the schema layer.

### Critical Secrets
| Secret Key | Purpose | Rotation Cadence |
| :--- | :--- | :--- |
| `SESSION_SECRET` | Signing session cookies | 90 Days |
| `INTERNAL_API_SECRET` | Authenticating internal service mesh calls | 180 Days |
| `GOOGLE_CLIENT_SECRET` | OAuth2 integration with Google | Yearly |

### Data Classification
- **Public:** UI components, public documentation, non-sensitive metadata.
- **Internal:** System logs (filtered), internal service configurations.
- **Confidential:** User PII (email, names), Team API keys (hashed), Database credentials.

## Compliance & Policies

The project adheres to several internal and industry-standard policies:
- **AGPL-3.0 Compliance:** As per the license, any modifications to the core logic must be made available to the community if the software is run as a service.
- **GDPR/LGPD Readiness:**
  - **Data Minimization:** We only collect necessary OAuth2 data (email/name).
  - **Right to be Forgotten:** `invalidateAllUserSessions` and soft-delete patterns are implemented.
  - **Audit Logs:** The `logKanbanEvent` and `ApiProductRequestLogsTable` provide a clear audit trail of data modifications and API usage.
- **Secure Handling of Webhooks:** All outbound webhooks include a retry policy with exponential backoff and support signed payloads to prevent spoofing at the destination.

## Incident Response

In the event of a security breach or anomaly detection (e.g., triggered by `sessionSecurity.middleware.ts` failing with a high severity):

1. **Detection:** Anomaly patterns in fingerprints or IP subnets trigger an automatic session invalidation.
2. **Triaging:** On-call developers should review `ApiProductRequestLogsTable` for anomalous patterns.
3. **Containment:** 
   - Use `invalidateAllUserSessions(userId)` to force-logout specific users.
   - Revoke `x-api-key` in the API Gateway by removing the record from the database.
4. **Post-Incident:** All security incidents require a post-mortem stored in the `docs/OPERATIONS` directory.

---
**Related Documents:**
- [Architecture & System Design](./architecture.md)
