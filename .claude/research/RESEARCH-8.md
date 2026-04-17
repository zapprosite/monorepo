# RESEARCH-8: Security/Secrets Audit Automation Patterns

**Agent:** RESEARCH-8
**Focus:** Pre-commit hooks, secrets scanning, OWASP patterns, homelab security
**Date:** 2026-04-17
**Status:** COMPLETE

---

## 1. Key Findings (April 2026 Best Practices)

### 1.1 Current State Analysis

| Componente                 | Status           | Observação                            |
| -------------------------- | ---------------- | ------------------------------------- |
| pre-push hook              | ✅ Implementado  | Branch name + secrets scan (regex)    |
| `/se` skill                | ✅ Funcional     | Regex-based secrets detection         |
| `/msec` skill              | ✅ Existe        | MiniMax LLM semantic audit (OWASP)    |
| Cron `secrets-audit-daily` | ✅ Agendado (6h) | Scan diário automático                |
| Trivy (Gitea Actions)      | ✅ Integrado     | Vulnerability scanner no CI           |
| .env canonical             | ✅ Aplicado      | `process.env` only, sem Infisical SDK |
| Pre-commit hook            | ❌ Não instalado | Apenas pre-push ativo                 |

### 1.2 Gaps Identificados

1. **Pre-commit hook não instalado** — O `.git/hooks/pre-push` existe mas não há mecanismo para instalar o pre-commit hook. Apenas pre-push está ativo.
2. **Pre-push hook com falsos positivos** — Usa regex grep no `git diff` inteiro, pode bloquear código legítimo.
3. **Sem Gitea Actions secrets scan dedicado** — Trivy faz vulnerability scan, mas não secrets no código.
4. **Cron secrets-audit-daily** — Sem ação clara quando encontra secrets.
5. **OWASP Top 10** — `/msec` menciona A01/A03/A10, mas sem checklist estruturado.

---

## 2. Specific Recommendations

### 2.1 ADD: Pre-Commit Hook

Criar `.git/hooks/pre-commit` com context-aware exclusions:

```bash
#!/usr/bin/env bash
# pre-commit hook — scan staged files BEFORE commit

set -euo pipefail

STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)
[ -z "$STAGED_FILES" ] && exit 0

EXCLUDE_PATTERN="\.env$|\.env\.example$|fixtures|test|docs/|\.md$"

PATTERNS=(
  "sk-[a-zA-Z0-9_-]{20,}"
  "ghp_[a-zA-Z0-9]{36}"
  "glpat-[a-zA-Z0-9_-]{20,}"
  "AKIA[A-Z0-9]{16}"
)

for pattern in "${PATTERNS[@]}"; do
  MATCHES=$(git diff --cached --name-only | grep -vE "$EXCLUDE_PATTERN" | \
    xargs git diff --cached -- | grep -E "$pattern" || true)
  [ -n "$MATCHES" ] && echo "❌ BLOCKED: $pattern" && exit 1
done

echo "✅ No secrets detected"
exit 0
```

### 2.2 ADD: Gitea Actions Secrets Scan Step

Adicionar ao `.gitea/workflows/ci.yml`:

```yaml
secrets-scan:
  name: Secrets Scan
  runs-on: ubuntu-latest
  if: gitea.event == 'pull_request'
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 1
    - name: Run regex scan
      run: |
        grep -rEn "sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]{20,}" \
          --include="*.ts" --include="*.js" --include="*.py" \
          --exclude-dir=node_modules --exclude-dir=.git . || true
```

### 2.3 UPDATE: Expandir OWASP Checklist no /msec Skill

No ficheiro `.claude/skills/minimax-security-audit/SKILL.md`, expandir a secção OWASP:

```markdown
## OWASP Top 10 Checklist

| #   | Category                  | Check                                      |
| --- | ------------------------- | ------------------------------------------ |
| A01 | Broken Access Control     | `publicProcedure` sem `protectedProcedure` |
| A02 | Cryptographic Failures    | `process.env` sem fallback                 |
| A03 | Injection                 | Zod validation, parameterized queries      |
| A04 | Insecure Design           | Error handling gaps                        |
| A05 | Security Misconfiguration | UFW, Traefik rules                         |
| A06 | Vulnerable Components     | Trivy scan (CI)                            |
| A07 | Auth Failures             | JWT validation, rate limiting              |
| A08 | Data Integrity            | File validation, MIME type                 |
| A09 | Logging Failures          | AlertManager integration                   |
| A10 | SSRF                      | URL validation in webhooks                 |
```

### 2.4 UPDATE: Cron secrets-audit-daily Action

Atualizar o cron job para documentar ação quando encontra secrets:

```bash
# Cron: secrets-audit-daily (6h)
# Se encontrar secrets:
# 1. Log para /srv/monorepo/.claude/logs/secrets-audit-$(date +%Y%m%d).log
# 2. Criar issue no Gitea (se CRITICAL)
# 3. Alert via AlertManager (se CRITICAL)
```

---

## 3. Integration Points

### 3.1 Com Orchestrator (/execute)

```
CODER-1/CODER-2 → TESTER → SECURITY + SECRETS (parallel)
                                     ↓
                              SHIPPER (decide PR)
```

Agent 7 (SECURITY) e Agent 11 (SECRETS) executam em paralelo. Findings são agregados antes do SHIPPER (Agent 14).

### 3.2 Com Gitea API

```bash
# Post findings to Gitea
curl -X POST "$GITEA_INSTANCE_URL/api/v1/repos/$REPO/issues" \
  -H "Authorization: token $GITEA_TOKEN" \
  -d '{"title": "⚠️ Secrets Audit — Found", "body": "..."}'
```

---

## 4. What to Add/Update/Delete

| Action | Item                  | File                                             |
| ------ | --------------------- | ------------------------------------------------ |
| ADD    | Pre-commit hook       | `.git/hooks/pre-commit`                          |
| ADD    | Secrets scan CI step  | `.gitea/workflows/ci.yml`                        |
| ADD    | detect-secrets config | `.detect-secrets.toml`                           |
| UPDATE | pre-push hook         | `.git/hooks/pre-push` (reduzir falsos positivos) |
| UPDATE | OWASP checklist       | `.claude/skills/minimax-security-audit/SKILL.md` |
| UPDATE | Cron documentation    | Cron job description                             |

---

## 5. References

- [SECRETS-MANDATE.md](../../docs/GOVERNANCE/SECRETS-MANDATE.md)
- [minimax-security-audit SKILL.md](../../.claude/skills/minimax-security-audit/SKILL.md)
- [secrets-audit SKILL.md](../../.claude/skills/secrets-audit/SKILL.md)
- [pre-push hook](../../.git/hooks/pre-push)
- [code-review.yml Gitea Actions](../../.gitea/workflows/code-review.yml)
- [OWASP Top 10 2021](https://owasp.org/Top10/)

---

**Status:** ✅ RESEARCH-8 COMPLETE
**Date:** 2026-04-17
