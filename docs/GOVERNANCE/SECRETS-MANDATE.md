# Secrets Enforcement Rules

**Applies to:** All code in `/srv/monorepo`
**Authority:** Platform Governance
**Updated:** 2026-04-13
**Spec:** SPEC-029-INFISICAL-SDK-MANDATORY.md, ADR-001

---

## Core Rule — .env as Canonical Source

All secrets are stored in `.env` files (canonical source). Application code reads secrets via `os.getenv()` / `process.env`.

```
.env file (canonical on-disk source)
    │
    │  dotenv load at process startup
    ▼
os.getenv("SECRET_NAME")  ← application code uses this
```

### Canonical Pattern — Python

```python
import os
from dotenv import load_dotenv

# Load .env at process startup — BEFORE any other imports
load_dotenv()

# Read secrets via os.getenv
api_key = os.getenv("OPENROUTER_API_KEY")

# Use api_key in your application
...
```

### Canonical Pattern — Node.js

```javascript
import 'dotenv/config';

const apiKey = process.env.OPENROUTER_API_KEY;
```

### Canonical Pattern — Shell

```bash
#!/bin/bash
set -a
source .env
set +a
# secrets now available as environment variables
```

---

## Secret Access Pattern

Application code reads secrets from environment variables:

```python
# ✅ CORRETO — application code reads from environment
import os
from dotenv import load_dotenv
load_dotenv()
secret = os.getenv("MY_SECRET")

# ❌ PROIBIDO — hardcoded secret
MY_SECRET = "hardcoded_value_123"

# ❌ PROIBIDO — direct env access without dotenv load
MY_SECRET = os.getenv("MY_SECRET")  # without load_dotenv() first
```

---

## .env Loading — Process/Script Startup

The `.env` file must be loaded at the **start of every process or script**:

1. **Python**: `load_dotenv()` before any imports that need secrets
2. **Node.js**: `import 'dotenv/config'` at the top of entry point
3. **Shell**: `set -a && source .env && set +a` at script start
4. **Docker**: Use `env_file:` in docker-compose or Coolify environment injection

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

### Allowed .env patterns

```regex
# .env file entries
^[A-Z_]+=.+

# dotenv load indicators (canonical pattern)
^load_dotenv\(\)
^import ['"]dotenv/config['"]

# Environment variable access (after dotenv load)
os\.getenv\(|process\.env\.
```

---

## Code Review Checklist

Quando fizeres code review, verifica:

- [ ] `.env` is loaded at process startup (dotenv/config)?
- [ ] Secrets accessed via `os.getenv()` / `process.env`?
- [ ] No hardcoded secrets (`ghp_`, `sk-`, strings resembling tokens)?
- [ ] Exceptions have `APPROVED_BY: Principal Engineer` comment with expiry?
- [ ] Shell scripts use `set -a` before `source .env`?

### Patterns que Rejeitam PR

| Pattern                                            | Severity | Action          |
| -------------------------------------------------- | -------- | --------------- |
| `ghp_[a-zA-Z0-9]{36}`                              | CRITICAL | Reject + block  |
| `sk-[a-zA-Z0-9]{48}`                               | CRITICAL | Reject + block  |
| Hardcoded secret string                            | CRITICAL | Reject + block  |
| `os.getenv("...")` without `load_dotenv()`         | HIGH     | Request changes |
| Shell script missing `set -a` before `source .env` | HIGH     | Request changes |

---

## Exceptions Process

Exceções requerem:

1. **Written justification** — por que não pode usar .env pattern
2. **owner approval** — comment com `@owner approved 2026-04-13`
3. **Expiry date** — nenhuma exceção permanente
4. **Tracking** — listadas em `docs/GOVERNANCE/EXCEPTIONS.md`

Exemplo de exceção válida:

```python
# 例外: Temporary bridge para legacy system sem .env support
# APPROVED_BY: Principal Engineer 2026-04-13
# EXPIRES: 2026-05-13
# ISSUE: migration-to-denv-required
LEGACY_TOKEN = os.getenv("LEGACY_BRIDGE_TOKEN")  # only for migration period
```

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
# 3. Criar novo secret em .env
# 4. Confirmar não há duplicates no codebase
```

---

## Testing the Enforcement

Para verificar que o enforcement funciona:

```bash
# Scan for hardcoded secrets
grep -rE "ghp_[a-zA-Z0-9]{36}|sk-[a-zA-Z0-9]{48}" --include="*.py" --include="*.ts" --include="*.js" .

# Verify dotenv usage
grep -r "load_dotenv\|dotenv/config" --include="*.py" apps/ packages/
```

---

## Related Documents

- [ADR-001](../ADRs/ADR-001-denv-as-canonical-secrets-source.md) — Full ADR explaining the .env canonical pattern
- [EXCEPTIONS.md](./EXCEPTIONS.md) — Active and expired exceptions

---

**Authority:** Platform Governance
**Spec:** SPEC-029-INFISICAL-SDK-MANDATORY.md, ADR-001
**Last updated:** 2026-04-13
