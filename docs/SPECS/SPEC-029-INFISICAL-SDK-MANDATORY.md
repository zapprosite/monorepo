---
name: SPEC-029-INFISICAL-SDK-MANDATORY
description: Infisical SDK mandatory pattern — all secrets via vault, env vars pattern, zero-tolerance hardcode policy
status: ACTIVE
priority: critical
author: will-zappro
date: 2026-04-12
specRef: SPEC-001.md, SPEC-025-REPORT.md
---

# SPEC-029 — Infisical SDK Mandatory Pattern

## Objective

Impor o **Infisical SDK como único meio legítimo** para secrets em código. Qualquer `os.getenv`, `process.env` com valor hardcoded, ou acesso direto a `secrets.env` é proibido. O objetivo é eliminar duplicates de secrets e garantir audit trail centralizada.

---

## Context

### Problema Atual

O codebase contém múltiplos pontos de acesso a secrets:

1. **`~/.zappro/config/secrets.env`** — hardcoded tokens em arquivo plaintext
2. **`os.getenv("TOKEN")`** — padrão usado em vários pontos sem validação
3. **Credenciais em `~/.git-credentials`** — expostas em arquivo plain text
4. **Sem differentiate** entre secrets de runtime vs build-time

### Policy Existente (SPEC-001)

> "**Zero tolerance for secrets in code** — Use Infisical only"
> "**Infisical SDK mandatory** — No os.getenv, use Infisical SDK for secret retrieval"
> "Duplicates detected = automatic rejection"

### Gap

A policy existe mas **não há mecanismo de enforcement**. O código continua com `os.getenv` dispersos, e não há documento que:
1. Defina o pattern exato de implementação
2.Liste os serviços suportados
3.Estabeleça o workflow de rotação de secrets
4.Crie exceptions controlada

---

## Technical Approach

### Padrão Canonical: Infisical SDK Pattern

Todo código que necessita de secrets deve usar:

```python
# ✅ CORRETO — Infisical SDK
from infisical import InfisicalClient

client = InfisicalClient()  # auto-discovers from env/config
secret = client.get_secret("SERVICE_API_KEY")
value = secret.secret_value

# ✅ CORRETO — env var que aponta para Infisical (não secret hardcoded)
API_KEY = os.getenv("INFISICAL_SERVICE_API_KEY")  # value = ref to vault

# ❌ PROIBIDO — hardcoded secret
API_KEY = "ghp_EXAMPLE_TOKEN_REPLACE_WITH_REAL_VALUE"

# ❌ PROIBIDO — os.getenv sem vault reference
API_KEY = os.getenv("GITHUB_TOKEN")  # sem guarantee que vem do vault
```

### Arquitetura de Acesso

```
┌─────────────────────────────────────────────┐
│  INFISICAL CLOUD VAULT                      │
│  ( secrets centralizados por workspace )     │
├─────────────────────────────────────────────┤
│  INFISICAL_CLIENT_ID + INFISICAL_CLIENT_    │
│  SECRET → authenticate → token de acesso    │
├─────────────────────────────────────────────┤
│  InfisicalClient.get_secret("NAME")        │
│  InfisicalClient.get_all_secrets()          │
├─────────────────────────────────────────────┤
│  Application Code                           │
│  (NUNCA acessa secrets diretamente)         │
└─────────────────────────────────────────────┘
```

### Variaveis de Ambiente: O Que É Permitido

| Tipo | Exemplo | Status |
|------|---------|--------|
| **Vault reference** | `INFISICAL_TOKEN=auto` | ✅ Permitido |
| **Config local** | `OLLAMA_BASE_URL=http://localhost:11434` | ✅ Permitido |
| **Non-secret flags** | `NODE_ENV=production` | ✅ Permitido |
| **Infisical client creds** | `INFISICAL_CLIENT_ID=...` | ✅ Permitido |
| **Hardcoded secret** | `API_KEY=sk-123...` | ❌ Proibido |
| **os.getenv sem vault** | `GITHUB_TOKEN=x` | ❌ Proibido |
| **Plain text credentials** | `secrets.env` com tokens | ❌ Proibido |

### Exceções Controladas

Exceções requerem APPROVAL explícita e documented justification:

```
# 例外: Legacy system sem suporte Infisical
# Autorização: will-zappro 2026-04-12
# Tipo: temporary bridge (deve ser migrated)
# Expira: 2026-05-01
LEGACY_SYSTEM_TOKEN=bridge_to_infisical
```

---

## Implementation

### Fase 1: Criar Documentos de Policy

**`docs/GOVERNANCE/SECRETS-MANDATE.md`** (novo)
```
Top-level policy document:
- Zero tolerance stance
- Infisical SDK mandatory
- Exceptions process
- Rotation requirements
- Audit trail
```

**`docs/GUIDES/INFISICAL-SDK-PATTERN.md`** (novo)
```
Guia de implementação prática:
- Setup do InfisicalClient
- get_secret vs get_all_secrets
- Error handling
- Caching strategy
- Testing with mock
- Rotina de rotação
```

### Fase 2: Regras de Code Review

**`.claude/rules/secrets-enforcement.md`** (novo)
```
Regras para universal-code-review skill:
- Detetar hardcoded secrets (regex patterns)
- Verificar uso de InfisicalClient
- Bloquear os.getenv para secretos
- Exceptions documentation check
```

**`docs/ADRs/ADR-029-INFISICAL-MANDATORY.md`** (novo)
```
ADR documentando a decisão архитектурная:
- Contexto: why Infisical
- Decisão: SDK mandatory
- Alternativas considered
- Consequences
```

### Fase 3: Auto-Enforcement (Future)

```
hooks/pre-commit:
- scan for hardcoded secrets patterns
- verify InfisicalClient usage in changed files
- block commit if violations found
```

---

## Success Criteria

1. **0 hardcoded secrets** em código/commit (exceto exceptions documentadas)
2. **100% Infisical SDK** usage para secrets de produção
3. **`secrets.env`plain text** removido de `~/.zappro/` após migração
4. **`~/.git-credentials`** não contém tokens de produção (apenas CI tokens)
5. **Docs atualizados**: GOVERNANCE/SECRETS-MANDATE + GUIDES/INFISICAL-SDK-PATTERN
6. **Code review rule** ativa e a bloquear violações
7. **Exceptions controladas** documented em `docs/GOVERNANCE/EXCEPTIONS.md`

---

## Open Questions

| # | Question | Resolution |
|---|----------|------------|
| OQ-1 | Como migrar `secrets.env` existente para Infisical sem downtime? | Create parallel credentials, test, switch, revoke old |
| OQ-2 | Tokens de CI/CD (GitHub Actions) podem ficar em git-credentials? | Sim, mas apenas scopes mínimos necessários |
| OQ-3 | Como validar que o Infisical SDK está a ser usado em PR? | Pre-commit hook + code review skill |
| OQ-4 | Exceptions para legacy systems — limite de tempo? | Max 30 dias, depois migrate ou deprecate |
| OQ-5 | Como lidar com secrets que não existem no vault? | ERROR, não fallback — Missing secret é bug |
