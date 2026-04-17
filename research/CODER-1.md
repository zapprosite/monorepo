# CODER-1 Research Report: backend-scaffold (SPEC-066)

**Date:** 2026-04-17
**Focus:** `/srv/monorepo/.claude/skills/backend-scaffold/SKILL.md`
**SPEC:** SPEC-066 Claude Commands Audit

---

## 1. Key Findings (April 2026 Best Practices)

### Skill Status: ❌ PROIBIDO — Contains MINIMAX References

The `backend-scaffold` skill **MUST NOT be used as-is** due to SPEC-066 prohibition on MiniMax dependencies.

### PROIBIDO Elements Found

| Line | Issue | PROIBIDO Reference |
|------|-------|-------------------|
| 71 | `MINIMAX_API_KEY` in Infisical vault | ❌ MINIMAX |
| 73 | `https://api.minimax.io/anthropic/v1` endpoint | ❌ ANTHROPIC_BASE_URL analog |
| 35 | Flow references "MiniMax le schema Zod" | ❌ MINIMAX |

### Valid Stack Elements (Keep)

The skill correctly identifies the monorepo backend stack:

| Component | Status | Evidence |
|-----------|--------|----------|
| Fastify plugin | ✅ VALID | `apps/api/` uses Fastify 5.6.1 |
| tRPC router | ✅ VALID | `apps/api/src/routers/trpc.router.ts` |
| OrchidORM | ✅ VALID | `apps/api/package.json` has `orchid-orm: ^1.57.6` |
| PostgreSQL | ✅ VALID | `pg: ^8.16.3` in package.json |
| Zod schemas | ✅ VALID | `packages/zod-schemas/` exists |

### 6-Chain Middleware Pattern (Correct)

The skill references the correct middleware chain from `AGENTS.md`:
```
apiKeyAuth → corsValidation → whitelistCheck → rateLimit → subscriptionCheck → requestLogger
```

---

## 2. Specific Recommendations

### Option A: DELETE (Recommended by SPEC-066)

**Rationale:** Skill is entirely dependent on PROIBIDO MiniMax infrastructure. The scaffold concept requires LLM code generation which cannot work without MiniMax.

**Action:** Delete `.claude/skills/backend-scaffold/` entirely.

### Option B: Rewrite Without MiniMax

If scaffold functionality is needed, rewrite without external LLM:

**Changes Required:**
1. Remove lines 34-35 ("MiniMax le schema Zod")
2. Remove lines 71-74 (Dependencies section)
3. Replace LLM call with **template-based generation** using existing code patterns

**Template Source:** Use existing `apps/api/src/modules/` as reference templates:
```typescript
// Reference: apps/api/src/modules/api-gateway/handlers/*.handler.ts
// Reference: apps/api/src/modules/*/*.trpc.ts
```

**Revised Flow:**
```
/bscaffold <entity> <schema-path>
  -> Read existing modules as templates
  -> Generate from pattern, not LLM
  -> Output: copy-paste-ready files
```

---

## 3. Related Skills with Same PROIBIDO Issue

| Skill | MiniMax Ref | Action |
|-------|-------------|--------|
| `backend-scaffold` | Yes (lines 71-74) | DELETE or REWRITE |
| `db-migration` | Yes (lines 76-79) | DELETE or REWRITE |
| `trpc-compose` | Yes (lines 82-84) | DELETE or REWRITE |
| `infra-from-spec` | Yes (lines 76-79) | DELETE |
| `minimax-security-audit` | Yes (entire skill) | ❌ DELETE (named PROIBIDO) |
| `researcher` | Yes (lines 41-44) | ❌ DELETE |

---

## 4. Code/Examples

### Current PROIBIDO Code (lines 71-79):
```yaml
## Dependencias
- `MINIMAX_API_KEY` em Infisical vault
- Endpoint: `https://api.minimax.io/anthropic/v1`
- Schema Zod deve existir em `packages/zod-schemas/src/`
```

### What Should Replace It (if rewriting):

```yaml
## Dependencias
- Schema Zod deve existir em `packages/zod-schemas/src/`
- Usar módulos existentes como template:
  - `apps/api/src/modules/api-gateway/handlers/` (Fastify handlers)
  - `apps/api/src/modules/*/*.trpc.ts` (tRPC routers)
  - `apps/api/src/db/base_table.ts` (OrchidORM tables)
```

---

## 5. What to Add/Update/Delete

### DELETE (PROIBIDO)

| Path | Reason |
|------|--------|
| `.claude/skills/backend-scaffold/SKILL.md` | References MINIMAX_API_KEY + api.minimax.io |

### Alternative: REWRITE Without MiniMax

If keeping scaffold functionality:

1. **Remove:** Dependencies section referencing MiniMax
2. **Update:** Flow to use template-based generation (not LLM call)
3. **Add:** Reference to existing module patterns as templates
4. **Trigger:** Keep `/bcaffold` or rename to `/bscaffold`

---

## 6. Conclusion

**backend-scaffold** has a **valid concept** (Fastify + tRPC + OrchidORM scaffold) but **invalid implementation** (depends on PROIBIDO MiniMax infrastructure).

**Recommendation:** DELETE the skill. The monorepo should use `/spec` workflow for new modules, with manual scaffold following existing patterns in `apps/api/src/modules/`.

---

## 7. Files to Reference for Manual Scaffold

For CODER-1 implementing backend without MiniMax:

```
apps/api/src/modules/api-gateway/handlers/     # Fastify REST handlers
apps/api/src/modules/*/*.trpc.ts               # tRPC router examples
apps/api/src/modules/*/tables/*.table.ts       # OrchidORM table examples
apps/api/src/routers/trpc.router.ts            # Router composition
packages/zod-schemas/src/*.schema.ts          # Zod schema examples
```
