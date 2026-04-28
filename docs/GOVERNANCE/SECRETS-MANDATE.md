# Secrets Enforcement Rules

**Applies to:** All code in `/srv/monorepo`
**Authority:** will-zappro
**Updated:** 2026-04-12
**Spec:** SPEC-029-INFISICAL-SDK-MANDATORY.md

---

## Core Rule — Infisical SDK Mandatory

Todo secret deve ser obtido via **Infisical SDK**. NUNCA hardcoded.

```python
# ✅ CORRETO
from infisical import InfisicalClient
client = InfisicalClient()
secret = client.get_secret("MY_SECRET")

# ❌ PROIBIDO
import os
MY_SECRET = os.getenv("MY_SECRET")  # pode não existir no vault

# ❌ PROIBIDO
MY_SECRET = "hardcoded_value_123"

# ❌ PROIBIDO — even if it looks like a reference
MY_SECRET = os.environ.get("GITHUB_TOKEN")  # sem guarantee vault-backed
```

---

## Detection Patterns

### Hardcoded Secret (BLOCK)

```regex
# Tokens and API keys
(?:api[_-]?key|token|secret|password|credential)\s*[=:]\s*["'][a-zA-Z0-9_\-]{20,}["']

# Bearer tokens
Bearer\s+[a-zA-Z0-9_\-]{30,}

# AWS-style keys
(?:AKIA|A3T|ABIA|ACDU|ASIA)[A-Z0-9]{16}

# GitHub tokens
ghp_[a-zA-Z0-9]{36}
sk-[a-zA-Z0-9]{48}
ghu_[a-zA-Z0-9]{36}
```

### Allowed env var patterns

```regex
# Env var que referencia vault (formato Infisical)
INFISICAL_[A-Z_]+=[^\s"']+
INFINISICAL_CLIENT_ID=.+
INFINISICAL_CLIENT_SECRET=.+

# Config local (nao secrets)
OLLAMA_BASE_URL=http
NODE_ENV=production
PORT=[0-9]+

# Non-sensitive flags
DEBUG=(true|false)
LOG_LEVEL=debug|info|warn|error
```

---

## Code Review Checklist

Quando fizeres code review, verifica:

- [ ] Changed files usam `InfisicalClient` para secrets?
- [ ] Não há `os.getenv("TOKEN_SECRET_APIKEY")` patterns?
- [ ] Não há strings com formato de token (`ghp_`, `sk-`, `ghu_`) hardcoded?
- [ ] Exceptions têm `APPROVED_BY: will-zappro` comment?
- [ ] Secrets são lidos em runtime, não em module load?

### Patterns que Rejeitam PR

| Pattern | Severity | Action |
|---------|----------|--------|
| `ghp_[a-zA-Z0-9]{36}` | CRITICAL | Reject + block |
| `sk-[a-zA-Z0-9]{48}` | CRITICAL | Reject + block |
| `os.getenv("...")` para secrets | HIGH | Request changes |
| `secrets.env` path em código | HIGH | Request changes |
| Sem `InfisicalClient` em files que precisam de secrets | MEDIUM | Suggest fix |

---

## Exceptions Process

Exceções requerem:

1. **Written justification** — por que não pode usar Infisical SDK
2. **will-zappro approval** — comment com `@will-zappro approved 2026-04-12`
3. **Expiry date** — nenhuma exceção permanente
4. **Tracking** — listadas em `docs/GOVERNANCE/EXCEPTIONS.md`

Exemplo de exceção válida:

```python
# : Temporary bridge para legacy system sem Infisical support
# APPROVED_BY: will-zappro 2026-04-12
# EXPIRES: 2026-05-01
# ISSUE: migration-to-infisical-required
LEGACY_TOKEN = os.getenv("LEGACY_BRIDGE_TOKEN")  # only for migration period
```

---

## Secrets to Migrate

| Secret | Current Location | Target | Status |
|--------|-----------------|--------|--------|
| `GITHUB_TOKEN` | `~/.git-credentials` | Infisical workspace | PENDING |
| `TELEGRAM_BOT_TOKEN` | `~/.zappro/config/secrets.env` | Infisical workspace | PENDING |
| `OPENROUTER_API_KEY` | `~/.zappro/config/secrets.env` | Infisical workspace | PENDING |
| `QDRANT_API_KEY` | `~/.zappro/config/secrets.env` | Infisical workspace | PENDING |
| `COOLIFY_API_KEY` | bootstrap-emitter.sh | Infisical workspace | PENDING |

---

## Violations

### O que fazer se encontrar Hardcoded Secret

1. **NÃO COMMIT** — rejeitar imediatamente
2. **NÃO USAR** — não testar com secret real em logs
3. **REPORT** — documentar em `docs/GOVERNANCE/EXCEPTIONS.md` se for caso legítimo
4. **ROTATE** — após deteção, secret deve ser revogado e novo criado no vault

### Depois de um leak

```bash
# 1. Identificar token comprometido
# 2. Revogar no provider (GitHub, Telegram, etc.)
# 3. Criar novo secret no Infisical vault
# 4. Update all references
# 5. Confirmar não há duplicates no codebase
```

---

## Testing the Enforcement

Para verificar que o enforcement funciona:

```bash
# Scan for hardcoded secrets
grep -rE "ghp_[a-zA-Z0-9]{36}|sk-[a-zA-Z0-9]{48}" --include="*.py" --include="*.ts" --include="*.js" .

# Verificar que InfisicalClient está a ser usado
grep -r "InfisicalClient" --include="*.py" .

# Verificar exceptions
cat docs/GOVERNANCE/EXCEPTIONS.md
```

---

**Authority:** will-zappro
**Spec:** SPEC-029-INFISICAL-SDK-MANDATORY.md
**Last updated:** 2026-04-12
