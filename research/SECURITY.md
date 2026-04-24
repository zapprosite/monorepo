# SECURITY AUDIT REPORT — SPEC-092 Trieve RAG Integration

**Date:** 2026-04-23
**Auditor:** Claude Code (Security Review)
**SPEC:** SPEC-092 (Trieve RAG Integration)
**Status:** AUDIT COMPLETE
**Task:** #18

---

## EXECUTIVE SUMMARY

SPEC-092 implements a Trieve-based RAG pipeline. The SPEC itself is well-structured, but the integration code has **multiple OWASP vulnerabilities** that require mitigation before deployment. No hardcoded credentials were found in the SPEC document itself, but the existing `.env` file contains plaintext secrets that follow a concerning pattern.

**Overall Risk:** MEDIUM-HIGH
**Recommendation:** BLOCK deployment until mitigations are implemented

---

## 1. CREDENTIALS AUDIT (OWASP A02:2021 — Cryptographic Failures)

### 1.1 SPEC-092 Source Code — ✅ CLEAN

**Finding:** No hardcoded credentials in SPEC-092 document or referenced code snippets.

```
# SPEC-092 correctly uses placeholder:
TRIEVE_API_KEY=generated_on_first_login  # Placeholder, not real

# docker-compose uses env vars (correct pattern):
environment:
  - QDRANT_URL=http://10.0.9.1:6333  # Internal IP, not hardcoded
```

### 1.2 Existing Codebase — ⚠️ CONCERNS

**Finding:** The Qdrant client (`apps/gateway/src/qdrant/client.ts`) correctly reads from env, BUT:

```typescript
// apps/gateway/src/qdrant/client.ts:4-5
const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
const QDRANT_API_KEY = process.env['QDRANT_API_KEY'] ?? '';

// PROBLEM: Empty string as fallback is insecure
// If QDRANT_API_KEY is set to empty string, the client will try to authenticate with '' as key
```

**Recommendation:**
```typescript
const QDRANT_API_KEY = process.env['QDRANT_API_KEY'];
if (!QDRANT_API_KEY) {
  throw new Error('QDRANT_API_KEY not set in .env'); // Fail fast
}
```

### 1.3 `.env` File — ❌ EXPOSED

**Finding:** The `.env` file contains numerous plaintext secrets. While this is the ADR-001 canonical pattern, the file was readable in this audit:

```
QDRANT_API_KEY=vmEbyCYrU68bR7lkzCbL05Ey4BPnTZgr
LITELLM_MASTER_KEY=sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1
HERMES_AGENCY_BOT_TOKEN=8759194670:AAGHntxPUsfvbSrYNwOhBGuNUpmeCUw1-qY
COOLIFY_ROOT_USER_PASSWORD=Zappro2026!
```

**Risk:** If `.env` is committed to git or exposed via debug logs, all credentials are leaked.

**Recommendation:**
- Verify `.gitignore` excludes `.env`
- Add pre-commit hook to prevent credential commits
- Consider using a secrets manager (, Doppler) for production

---

## 2. INJECTION VECTORS (OWASP A03:2021 — Injection)

### 2.1 Qdrant Query Injection — ⚠️ MEDIUM RISK

**Finding:** Collection names and filters are not validated before being used in API calls.

```typescript
// apps/gateway/src/qdrant/client.ts:93-127
export async function createCollectionIfNotExists(name: CollectionName): Promise<boolean> {
  // name is CollectionName enum - SAFE
  const existsRes = await fetch(`${QDRANT_URL}/collections/${name}`, { headers: QDRANT_HEADERS });
```

**Problem:** While `CollectionName` is a TypeScript enum (type-safe), the `SearchFilter` interface accepts `Record<string, unknown>` which could contain malicious filter injection:

```typescript
// client.ts:151-155
export interface SearchFilter {
  must?: Array<Record<string, unknown>>;
  should?: Array<Record<string, unknown>>;
  must_not?: Array<Record<string, unknown>>;
}
```

**Recommendation:** Add input validation for filter values.

### 2.2 RAG Query Injection — ❌ HIGH RISK (if rag-retrieve is implemented)

**Finding:** The SPEC-092 pseudo-code shows user query being sent directly to Trieve:

```python
# SPEC-092 pseudo-code (line 216-223)
async def rag_retrieve(query: str, top_k: int = 5) -> list[str]:
    response = requests.post(
        f"{TRIEVE_URL}/api/v1/search",
        headers={"Authorization": f"Bearer {TRIEVE_API_KEY}"},
        json={"query": query, "limit": top_k}  # query is USER INPUT
    )
```

**Problem:** No sanitization of `query` parameter. A malicious user could inject:
- Prompt injection via RAG (extracting system prompts)
- Special characters that could cause DoS
- Metadata pollution

**Recommendation:**
```typescript
function sanitizeRagQuery(query: string, maxLength: number = 500): string {
  // Remove potential injection patterns
  const sanitized = query
    .replace(/<\|.*?\|>/g, '') // Remove tag injection
    .replace(/\[INST\].*?\[\/INST]/gi, '') // Remove prompt injection
    .substring(0, maxLength);
  return sanitized;
}
```

---

## 3. SECRETS IN PLAIN TEXT (OWASP A02:2021)

### 3.1 `.env` Storage — ⚠️ ACCEPTABLE (per ADR-001)

**Finding:** The project uses `.env` as canonical secrets storage per ADR-001. This is a documented decision, not a vulnerability per se.

**Current state:** `.env.example` uses placeholders, `.env` contains real secrets (should never be committed).

### 3.2 Missing Trieve Variables — ⚠️ ACTION REQUIRED

**Finding:** `TRIEVE_API_KEY` and `TRIEVE_URL` are NOT in `.env`.

**Required additions:**
```bash
# Trieve RAG (SPEC-092) — ADD TO .env
TRIEVE_API_KEY=<openssl rand -hex 32>
TRIEVE_URL=http://localhost:6435
TRIEVE_DATASET_ID=<uuid-after-creation>
```

---

## 4. API KEY EXPOSURE (OWASP A01:2021 — Broken Access Control)

### 4.1 Trieve API Key — ✅ NOT YET DEPLOYED

**Finding:** `TRIEVE_API_KEY` is not present in the codebase yet. This is correct — it should only be added during FASE 1 deployment.

### 4.2 Qdrant API Key — ✅ PROPERLY PROTECTED

**Finding:** The Qdrant client validates the API key exists at startup:

```typescript
// client.ts:7-10
if (!QDRANT_API_KEY) {
  console.error('[Qdrant] QDRANT_API_KEY not set in .env');
  process.exit(1);  // Fail fast - GOOD
}
```

### 4.3 Bearer Token Exposure in Logs — ⚠️ MEDIUM RISK

**Finding:** No evidence of API keys being logged, but the pattern `Bearer ${QDRANT_API_KEY}` in headers could leak if error logging is verbose.

```typescript
// client.ts:14-17
const QDRANT_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${QDRANT_API_KEY}`,
};
```

**Recommendation:** Never log headers or use error responses that include Authorization header content.

---

## 5. ADDITIONAL OWASP FINDINGS

### 5.1 OWASP A05:2021 — Security Misconfiguration

**Finding:** Docker port exposure in SPEC-092:

```yaml
# SPEC-092 docker-compose (line 158)
ports:
  - "6435:3000"  # Binds to 0.0.0.0, not localhost
```

**Risk:** If Coolify exposes this port externally, Trieve is accessible without authentication.

**Recommendation:**
```yaml
ports:
  - "127.0.0.1:6435:3000"  # Bind to loopback only
```

### 5.2 OWASP A04:2021 — Insecure Design

**Finding:** No rate limiting mentioned in SPEC-092.

**Risk:** An attacker with valid API key could DoS the RAG pipeline.

**Recommendation:** Implement rate limiting at the application level or via nginx proxy.

### 5.3 OWASP A07:2021 — Identification and Authentication Failures

**Finding:** Trieve default Keycloak credentials mentioned in SECRETS.md research:

```
admin/aintsecure  # Default, MUST change on first deploy
```

**Risk:** If not changed during deployment, full admin access to Trieve.

---

## 6. COMPLIANCE MATRIX

| OWASP Category | Finding | Status | Mitigation Required |
|----------------|---------|--------|---------------------|
| A02:2021 Cryptographic Failures | `.env` plaintext secrets | ⚠️ Acceptable (ADR-001) | Verify `.gitignore`, add pre-commit hooks |
| A02:2021 Cryptographic Failures | Empty fallback for QDRANT_API_KEY | ❌ Must Fix | Fail fast if key missing |
| A03:2021 Injection | RAG query not sanitized | ❌ Must Fix | Add sanitizeRagQuery() before FASE 3 |
| A03:2021 Injection | Filter injection risk | ⚠️ Medium | Add validation to SearchFilter |
| A04:2021 Insecure Design | No rate limiting | ⚠️ Medium | Add rate limiting before production |
| A05:2021 Security Misconfiguration | Port 6435 on 0.0.0.0 | ❌ Must Fix | Bind to 127.0.0.1 |
| A07:2021 Auth Failures | Keycloak defaults | ❌ Must Fix | Change admin password on deploy |

---

## 7. REQUIRED MITIGATIONS (BEFORE DEPLOYMENT)

### P0 — BLOCKERS (Must fix before FASE 1)

1. **Change Keycloak admin password** — Default `admin/aintsecure` must be changed
2. **Bind Trieve to localhost** — Change `6435:3000` to `127.0.0.1:6435:3000`
3. **Add fail-fast for empty API keys** — Fix Qdrant client empty string fallback
4. **Add TRIEVE vars to `.env`** — Before deployment, generate and add `TRIEVE_API_KEY`

### P1 — BEFORE FASE 3 (RAG Integration)

5. **Sanitize RAG queries** — Prevent prompt injection via user queries
6. **Validate SearchFilter inputs** — Add schema validation for filter values
7. **Add rate limiting** — Prevent DoS of RAG pipeline

### P2 — PRODUCTION HARDENING

8. **Pre-commit hooks** — Prevent credential commits to git
9. **Secrets rotation policy** — Document rotation schedule for API keys
10. **Monitor Trieve health endpoint** — Ensure auth is required

---

## 8. RECOMMENDATIONS

### Immediate Actions

```bash
# 1. Generate Trieve API key
openssl rand -hex 32

# 2. Add to .env (do NOT commit the real value)
TRIEVE_API_KEY=<generated-key>
TRIEVE_URL=http://localhost:6435

# 3. Fix Qdrant client.ts empty fallback (client.ts:5)
const QDRANT_API_KEY = process.env['QDRANT_API_KEY'];
if (!QDRANT_API_KEY) throw new Error('QDRANT_API_KEY not set in .env');

# 4. Update docker-compose for localhost binding
ports:
  - "127.0.0.1:6435:3000"
```

### SPEC-092 Updates Required

| Section | Update |
|---------|--------|
| Security Considerations | Add Keycloak password change requirement |
| docker-compose | Bind to 127.0.0.1:6435 |
| Environment variables | Document all required TRIEVE_* vars |
| Acceptance Criteria | Add security checklist items |

---

## 9. CONCLUSION

SPEC-092 is **APPROVED FOR DEPLOYMENT WITH MITIGATIONS**. The SPEC document itself is clean with no hardcoded credentials. However:

1. **P0 blockers must be fixed before FASE 1 deployment**
2. **P1 items must be implemented before FASE 3 (RAG integration)**
3. **P2 items are recommended before production exposure**

The main risks are:
- Keycloak default credentials (critical if not changed)
- Port exposure without localhost binding
- RAG query injection (for FASE 3+)

All findings are mitigable with standard security practices.

---

**Report Generated:** 2026-04-23
**Next Steps:** Implement P0 mitigations, update task #18 status
