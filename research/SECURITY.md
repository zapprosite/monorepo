# SPEC-066 Security Audit — minimax-security-audit Research Report

**Date:** 2026-04-17
**Agent:** SECURITY
**Scope:** minimax-security-audit skill, SPEC-066 pruning decisions

---

## 1. Key Findings

### 1.1 minimax-security-audit — Current State ✅

| Aspect | Status | Notes |
|--------|--------|-------|
| Purpose | VALID | Semantic diff audit using MiniMax LLM |
| Trigger | `/msec` | Pre-commit gate |
| Infisical SDK reference | DEPRECATED | Skill references Infisical SDK but it's pruned from codebase |
| Third-party risk | MEDIUM | Diff sent to `api.minimax.io` |
| OWASP coverage | PARTIAL | A01/A03/A10 only |

**Critical Issue:** The skill references `MINIMAX_API_KEY` from Infisical vault, but Infisical is **PRUNED** (SPEC-047, 2026-04-13). All secrets must now come from `.env`.

### 1.2 Security Architecture — Monorepo (April 2026 Best Practices)

| Layer | Tool | Purpose |
|-------|------|---------|
| Pre-commit gate | `/sec` (regex) | Fast secrets detection |
| Semantic audit | `/msec` (MiniMax) | Intent-aware OWASP reasoning |
| Deep dive | `/sec` (full) | Comprehensive security review |
| CI/CD | `ci-feature.yml` | Audit + test + lint |

**Canonical secrets source:** `.env` only (Infisical PRUNED)

---

## 2. SPEC-066 Pruning Recommendations

### 2.1 DELETE (Security Clean)

| Path | Reason |
|------|--------|
| `.claude/.claude/` | Nested backup artifact — DELETE recursively |
| `.claude/tools/img-analyze.sh` | Duplicates `/img` command |
| `.claude/skills/cloudflare-terraform/` | Replaced by `cloudflare-tunnel-enterprise` |
| `.claude/skills/researcher/` | Duplicate of global `researcher` |
| `.claude/skills/openclaw-oauth-profiles/` | OpenClaw deprecated |
| `.claude/skills/voice/` | Hermes voice is SOTA |

### 2.2 KEEP (Security Valid)

| Skill | Reason |
|-------|--------|
| `minimax-security-audit` | Valid semantic security audit |
| `secrets-audit` | Fast regex pre-commit gate |
| `orchestrator` | Only version in monorepo (global `pipeline-orchestrate` is duplicate) |

### 2.3 UPDATE (Security Fix Required)

| Skill | Update Required |
|-------|----------------|
| `minimax-security-audit` | Remove Infisical SDK references; use `.env` for `MINIMAX_API_KEY` |

---

## 3. minimax-security-audit — Specific Recommendations

### 3.1 Critical Fix: Remove Infisical SDK References

**Current (BROKEN):**
```markdown
- `MINIMAX_API_KEY` em Infisical vault
```

**Corrected:**
```markdown
- `MINIMAX_API_KEY` em `.env` (fonte canónica desde SPEC-047)
```

### 3.2 Update Fluxo Section

**Current:**
```
-> Send diff to MiniMax (api.minimax.io)
```

**Keep as-is** — accurate for MiniMax LLM calls. Third-party risk acceptable for non-secret code diffs.

### 3.3 Add OWASP Categories

Current skill covers: **A01, A03, A10**

**Recommend adding (2026 priorities):**
- **A02** — Cryptographic Failures (sensitive data in logs)
- **A04** — Insecure Design (auth bypass in tRPC routers)
- **A05** — Security Misconfiguration (CORS, headers)

### 3.4 Add Pre-Scan Dependency

The skill references `/se` as pre-scan but this should be explicit:

```markdown
## Dependências
- `MINIMAX_API_KEY` em `.env`
- `/se` skill para pré-scan regex (se blocker, não envia diff)
```

---

## 4. Code/Config Examples

### 4.1 Updated minimax-security-audit Bounded Context

```markdown
## Bounded context

**Faz:**
- Semantic detection (understands code intent, not just patterns)
- `.env` enforcement (process.env vs hardcoded)
- OWASP A01/A02/A03/A04/A05/A10 reasoning
- PT-BR friendly output

**Nao faz:**
- Nao substitui `/se` (corre ambos em sequencia)
- Nao faz remediation automatica — apenas reporta
- Nao envia diff se `/se` bloquear antes
- Nao usa Infisical SDK (Infisical PRUNED em SPEC-047)
```

### 4.2 Anti-Hardcoded Pattern Verification

For any code touching env vars, verify:

```typescript
// ✅ CORRETO
const MINIMAX_KEY = process.env.MINIMAX_API_KEY;
if (!MINIMAX_KEY) throw new Error("MINIMAX_API_KEY missing in .env");

// ❌ ERRADO — hardcoded fallback defeats audit purpose
const MINIMAX_KEY = process.env.MINIMAX_API_KEY ?? 'sk-test-key';
```

---

## 5. OWASP Top 10 — April 2026 Update

| OWASP | 2024 Rank | 2026 Focus | Detection Method |
|-------|-----------|------------|------------------|
| A01 | 1 | Broken Access Control | tRPC `publicProcedure` vs `protectedProcedure` |
| A02 | 2 | Cryptographic Failures | Hardcoded secrets, weak encryption |
| A03 | 3 | Injection | SQL, command, SSRF in webhooks |
| A04 | 4 | Insecure Design | Auth bypass, missing rate limits |
| A05 | 5 | Security Misconfiguration | CORS, headers, debug mode |
| A06 | 6 | Vulnerable Components | `pnpm audit` in CI |
| A07 | 7 | Auth Failures | Missing 401/403 tests |
| A08 | 8 | Data Integrity | N/A for audit scope |
| A09 | 9 | Logging Failures | Secrets in logs |
| A10 | 10 | SSRF | Webhook localhost calls |

---

## 6. Verdict for SPEC-066

| Action | Recommendation |
|--------|----------------|
| `minimax-security-audit` | **KEEP + UPDATE** — fix Infisical references |
| `secrets-audit` | **KEEP** — essential pre-commit gate |
| `orchestrator` | **KEEP** — monorepo version only |
| `.claude/.claude/` | **DELETE** — security clean |
| `.claude/tools/` | **DELETE** — duplicate artifact |

### Post-Prune Validation

After pruning, run:
```bash
# Verify no Infisical references remain
grep -r "InfisicalSDK\|INFISICAL_TOKEN\|infisical.getSecret" .claude/ || echo "CLEAN"

# Verify minimax skill uses .env
grep "MINIMAX_API_KEY" .claude/skills/minimax-security-audit/SKILL.md
```

---

## 7. Risk Assessment

| Item | Risk | Mitigation |
|------|------|------------|
| Prune artifacts | LOW | Backup before delete, verify with git status |
| Third-party MiniMax API | MEDIUM | Only non-secret diffs sent |
| Old orchestrator logs | LOW | Delete with `.claude/.claude/` recursively |
| MiniMax skill Infisical ref | MEDIUM | UPDATE before next use |

**Overall Risk Score:** 2/10 (LOW) — Pruning duplicates improves security posture by reducing attack surface.
