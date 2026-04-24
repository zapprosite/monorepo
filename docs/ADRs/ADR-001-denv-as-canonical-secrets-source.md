# ADR-001 — .env as Canonical Secrets Source

**Status:** aceito (ATUALIZADO 2026-04-13 —  PRUNED, `.env` é fonte única)
**Date:** 2026-04-13
**Author:** Principal Engineer
**Spec:** SPEC-029 (supersedes  mandate), SPEC-047

> ⚠️ **2026-04-13 UPDATE:**  foi oficialmente descomissionado (pruned). `.env` é agora a ÚNICA fonte canónica de secrets. Não há mais "sync de  → .env" — secrets são geridos diretamente em `.env` (com placeholders em `.env.example`). Qualquer referência neste ADR a "sync de " é histórica; ler como "manter `.env` atualizado".

---

## Context

Application code in `/srv/monorepo` requires secrets (API keys, tokens, credentials) to function. These secrets are stored in  as the source of truth. The question is: how should application code access these secrets?

Previously, the mandate required application code to use the  SDK directly to fetch secrets at runtime. This caused issues:

- SDK initialization overhead in every process
- Complex async client setup
- Secrets unavailable during early bootstrap
- Difficult to test locally

---

## Decision

All secrets are stored in `.env` files, synced from . Application code reads secrets via `os.getenv()` (or `process.env` in Node.js), **never directly from the  SDK**.

The  SDK is used only by:

1. **Infrastructure scripts** — sync mechanisms that pull secrets from  and write to `.env`
2. **CI/CD pipelines** — that inject secrets into the environment at deploy time

---

## Canonical Pattern

```
 (vault)
    │
    │  sync script (runs at startup or via cron)
    ▼
.env file (canonical on-disk source)
    │
    │  process startup (dotenv load)
    ▼
os.getenv("SECRET_NAME")  ← application code uses this
```

### Python Application

```python
import os
from dotenv import load_dotenv

# Load .env at process startup — BEFORE any other imports that need secrets
load_dotenv()

# Now read secrets via os.getenv
api_key = os.getenv("OPENROUTER_API_KEY")

# Use api_key in your application
...
```

### Node.js Application

```javascript
import 'dotenv/config';
import { Client } from 'your-library';

// Now read secrets via process.env
const apiKey = process.env.OPENROUTER_API_KEY;

// Use apiKey in your application
...
```

### Shell Script

```bash
#!/bin/bash
# Load .env at script startup
set -a
source .env
set +a

# Now secrets are available as environment variables
curl -H "Authorization: Bearer $GITHUB_TOKEN" ...
```

---

## Consequences

### Positive

- **Simple** — standard pattern, well-understood by all developers
- **Testable** — .env can be swapped for local development
- **Fast** — no SDK overhead at runtime
- **Portable** — works identically across Python, Node.js, shell, etc.
- **Debuggable** — secrets visible in process environment for debugging

### Negative

- **Sync required** — .env must be kept in sync with 
- **Disk presence** — .env must exist on disk (mitigated by gitignore + permissions)
- **Process-level isolation** — secrets only available to processes that load .env

### Mitigation for Negative

- Sync scripts run at host startup (cron or systemd)
- Application Docker containers receive secrets via environment injection from Coolify
- .env file permissions: `600` (owner read/write only)
- .env is gitignored — never committed

---

## Alternative: Direct  SDK in Application Code

Rejected for the reasons stated in Context above:

- SDK initialization complexity
- Bootstrap timing issues
- Testing difficulties

---

## Implementation

1. **Sync mechanism** —  SDK is used ONLY in infrastructure scripts that sync to `.env`
2. **Application code** — uses `os.getenv()` / `process.env` only
3. **Docker** — containers receive secrets via `env_file` or Coolify environment injection
4. **Permissions** — `.env` files set to `600`

---

## Related ADRs

- ADR-002 (future): Secrets rotation policy
- ADR-003 (future): Local development secrets workflow

---

**Authority:** Platform Governance
**Last updated:** 2026-04-13
