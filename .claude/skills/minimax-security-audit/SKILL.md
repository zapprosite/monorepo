---
name: minimax-security-audit
description: Semantic security audit of git diff — OWASP Top 10 + secrets audit using MiniMax LLM
trigger: /msec
---

# MiniMax Security Audit

## Objetivo

Pre-commit security gate that uses MiniMax LLM for semantic secret detection and OWASP reasoning — beyond regex-only tools.

## Quando usar

- Before committing code with auth/session changes
- When adding new API endpoints or webhooks
- Auditing Zod schemas for access control gaps

**Complementa:** `/se` (regex secrets scan) + `/sec` (deep OWASP dive).

## Como usar

```
/msec
```

Runs against current `git diff --staged`.

## Fluxo

```
git commit
  -> /msec
  -> PRE-SCAN: /se (regex) — block if secrets found
  -> Send diff to MiniMax (api.minimax.io)
  -> MiniMax analisa:
      ├── Secret found -> BLOCK + "Remove before push"
      ├── process.env violation -> BLOCK + "Use process.env from .env"
      ├── OWASP A01 Broken Access Control -> WARN + router line
      ├── SQLi (parameterized) -> PASS
      └── SSRF in webhook -> CRITICAL + fix suggestion
```

## Output esperado

Structured report:
```
[BLOCK] apps/api/src/modules/auth/auth.service.ts:12
  process.env.JWT_SECRET — hardcoded secret detected

[WARN]  apps/api/src/routers/contracts.trpc.ts:45
  OWASP A01: publicProcedure exposes mutation — consider protectedProcedure
```

## Bounded context

**Faz:**
- Semantic detection (understands code intent, not just patterns)
- process.env vs hardcoded secret enforcement
- OWASP A01/A03/A10 reasoning
- PT-BR friendly output

**Nao faz:**
- Nao substitui `/se` (corre ambos em sequencia)
- Nao faz remediation automatica — apenas reporta
- Nao envia diff se `/se` bloquear antes

## Aviso de seguranca

Git diff e enviado para `api.minimax.io` (third-party). Nao usar com repositorios que contem segredos proprietarios sem consentimento.

## Dependencias

- `MINIMAX_API_KEY` em `.env`
- `/se` skill disponivel para pre-scan
- Endpoint: `https://api.minimax.io/anthropic/v1`

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` (Security section)
- SPEC-034 Review: `docs/SPECS/SPEC-034-minimax-review-findings.md` (C-1: pre-scan requirement)
