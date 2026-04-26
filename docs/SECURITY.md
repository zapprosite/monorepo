# Security Notes — 2026-04-26

## CRITICAL Issues (Block Production)

### 1. IDOR — Missing Team Isolation (40+ endpoints)

**Severity:** CRITICAL
**Status:** Open
**Files Affected:**
- `clients.trpc.ts` - listClients, getClientDetail, updateClient
- `leads.trpc.ts` - listLeads, getLeadDetail
- `contracts.trpc.ts` - listContracts, getContractDetail
- `equipment.trpc.ts` - listEquipment
- `service-orders.trpc.ts` - listServiceOrders, getServiceOrderDetail
- `dashboard.trpc.ts` - getStats
- And ~35 more procedures

**Issue:** Procedures return ALL records in the system with no user/team filtering. Any authenticated user can access every record.

**Fix Required:**
1. Pass `teamId` from Fastify request to tRPC context
2. Add `.where({ teamId: ctx.teamId })` to all list/detail queries

**Example Fix (clients.trpc.ts):**
```typescript
// Before (VULNERABLE)
listClients: protectedProcedure.input(listClientsFilterZod).query(async ({ input }) => {
  return db.clients.select("*").where({ tipo: input.tipo });
}),

// After (FIXED)
listClients: protectedProcedure.input(listClientsFilterZod).query(async ({ ctx, input }) => {
  return db.clients.select("*").where({ teamId: ctx.user.teamId, tipo: input.tipo });
}),
```

### 2. TypeScript Build Failure (340+ errors)

**Severity:** CRITICAL
**Status:** Open
**Affected:** `apps/api` (329 errors), `apps/ai-gateway` (11 errors)

**Root Causes:**
- Missing modules: `@connected-repo/zod-schemas/*`
- Index signature access: `process.env['NODE_ENV']` instead of `process.env.NODE_ENV`
- Implicit `any` types in migration files
- RakeDb type mismatches

**Fix Required:** Run `bun install` and fix type declarations

### 3. Rate Limiting — Per-Team Enforcement

**Severity:** HIGH
**Status:** PARTIAL (teamRateLimitHook exists but may not cover all AI gateway routes)

**Current State:**
- `teamRateLimitHook` applied to `/v1/chat/completions`, `/v1/audio/*`
- Uses `rate-limiter-flexible` with in-memory storage
- For production: consider Redis-backed rate limiter for multi-server

### 4. SSRF Risk — STT_URL

**Severity:** HIGH
**Status:** Open
**File:** `audio-transcriptions.ts:103`

**Issue:** `STT_URL` environment variable is user-controlled at runtime. Attacker can redirect to internal network.

**Fix:**
```typescript
// Validate STT_URL is an allowed domain
const ALLOWED_STT_URLS = ['api.openai.com', 'api.anthropic.com'];
if (!ALLOWED_STT_URLS.includes(new URL(STT_URL).hostname)) {
  throw new Error('Invalid STT_URL domain');
}
```

---

## Medium Priority

| Issue | Severity | Status |
|-------|----------|--------|
| Mixed PT/ES in mcp-conectores | MEDIUM | Open |
| SQL injection risk (webhookQueue) | HIGH | Open |
| ESM/CJS mismatch (webhookProcessor) | HIGH | Open |
| Upsert broken (session.auth.store) | HIGH | Open |
| Rate limiter memory leak (Map grows forever) | MEDIUM | Open |

---

## Security Architecture

```
Request Flow:
  Client → Fastify → tRPC Context → Procedures → Database
                ↓
           teamRateLimitHook (checks team.rateLimitPerMinute)
                ↓
           apiKeyAuthHook (extracts team from API key)
                ↓
           team subscriptionCheck (verifies active subscription)
```

**Missing:** Team isolation at tRPC procedure level

---

## Compliance

- [ ] IDOR fixes deployed
- [ ] TypeScript build passes
- [ ] Security review completed
- [ ] Penetration testing done

---

*Last Review: 2026-04-26 by Nexus 7 Security Agents*
