# Environment Secrets Pattern Guide

**Applies to:** All code in `/srv/monorepo`
**Pattern:** .env as canonical source, Infisical as backup/UI
**Spec:** SPEC-029, ADR-001

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SECRET MANAGEMENT FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
    │   Infisical   │          │     .env     │          │     Code     │
    │   (Vault)    │          │   (Canonical │          │   (Consumer) │
    │   Backup/UI  │─────────▶│    on-disk)  │─────────▶│              │
    └──────────────┘   sync   └──────────────┘   dotenv  └──────────────┘
         ▲                                           │
         │                                           │
         │         ┌──────────────┐                  │
         └─────────│  CI/CD and   │◀── Infisical SDK
                   │  Sync Scripts│     (infra only)
                   └──────────────┘

LEGEND:
  ────▶  Read/access
  ═════▶  Sync (Infisical SDK)

RULES:
  1. Infisical SDK = infrastructure scripts ONLY
  2. .env = canonical source for application code
  3. Application code uses os.getenv() / process.env
  4. NEVER call Infisical SDK from application code
```

---

## Core Principle

| Component | Role | SDK/Method |
|-----------|------|------------|
| **Infisical** | Vault, backup, UI for secrets | Infisical SDK (infra scripts only) |
| **.env file** | Canonical on-disk source | Read by application |
| **Application code** | Consumer | `os.getenv()` / `process.env` |

**The sync is one-way:** Infisical → .env → Application

---

## Quick Reference

### Python (Canonical)

```python
from dotenv import load_dotenv

# Load .env FIRST, before any imports that need secrets
load_dotenv()

import os

# Read secret
api_key = os.getenv("OPENROUTER_API_KEY")
```

### Node.js (Canonical)

```typescript
import 'dotenv/config';

const apiKey = process.env.OPENROUTER_API_KEY;
```

### Shell Script

```bash
#!/bin/bash
set -a
source .env
set +a

# Secrets now available
curl -H "Authorization: Bearer $GITHUB_TOKEN"
```

---

## Step-by-Step: Adding a New Secret

### 1. Add to Infisical Vault

```
a) Open Infisical dashboard (infisical.com or self-hosted)
b) Navigate to project → environment (development/production)
c) Click "Add Secret"
d) Enter name and value
e) Click Save
```

**Naming:** Use `SCREAMING_SNAKE_CASE` (e.g., `TELEGRAM_BOT_TOKEN`)

### 2. Sync to .env

**Option A: Manual sync script**

```bash
# Run the sync script (if exists for your service)
cd /srv/monorepo
bash scripts/sync-secrets.sh
```

**Option B: Using Infisical CLI directly**

```bash
# Export all secrets for a project to .env
infisical secrets --format=env --env=development > .env

# Or for a specific secret
infisical secrets get SECRET_NAME --env=development
```

**Option C: Service token script (recommended for automation)**

```bash
# Create a script that uses service token to sync
#!/bin/bash
export INFISICAL_TOKEN="your-service-token"

# Sync development secrets
infisical secrets --format=env --env=development --output=.env

# Sync production secrets (different token, different output)
infisical secrets --format=env --env=production --output=.env.production
```

### 3. Verify .env Updated

```bash
# Check the secret exists in .env
grep "SECRET_NAME" .env
```

### 4. Use in Code

**Python:**

```python
from dotenv import load_dotenv
load_dotenv()

import os

# Use the secret
token = os.getenv("SECRET_NAME")
```

**Node.js:**

```typescript
import 'dotenv/config';

const token = process.env.SECRET_NAME;
```

### 5. Set Proper Permissions

```bash
chmod 600 .env
```

---

## Common Patterns

### Python — Full Example

```python
# ============================================================
# app.py — Example Fastify/React application entry point
# ============================================================

from dotenv import load_dotenv

# CRITICAL: Load .env FIRST, before any other imports
load_dotenv()

import os
import logging
from fastify import Fastify

logger = logging.getLogger(__name__)

# Now read secrets via os.getenv
DATABASE_URL = os.getenv("DATABASE_URL")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Validate required secrets at startup
missing_secrets = []
for secret_name in ["DATABASE_URL", "TELEGRAM_BOT_TOKEN"]:
    if not os.getenv(secret_name):
        missing_secrets.append(secret_name)

if missing_secrets:
    raise RuntimeError(f"Missing required secrets: {', '.join(missing_secrets)}")

# Use secrets in your application
app = Fastify()
logger.info(f"Starting with DB host: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'local'}")
```

### Node.js — Full Example

```typescript
// ============================================================
// src/index.ts — Example Fastify API entry point
// ============================================================

import 'dotenv/config';  // CRITICAL: Load .env FIRST
import Fastify from 'fastify';
import { createClient } from '@libsql/client';

const app = Fastify();

// Read secrets
const DATABASE_URL = process.env.DATABASE_URL;
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

// Validate at startup
if (!DATABASE_URL || !INTERNAL_API_SECRET) {
  throw new Error('Missing required secrets: DATABASE_URL, INTERNAL_API_SECRET');
}

// Use secrets
const db = createClient({ url: DATABASE_URL });
```

### Zod Schema Validation (Type-Safe Access)

```typescript
// packages/env/src/index.ts
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  API_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);

// Type-safe access everywhere else
console.log(env.DATABASE_URL);
```

### Optional Secrets with Defaults

```python
import os
from dotenv import load_dotenv
load_dotenv()

# With default value
log_level = os.getenv("LOG_LEVEL", "INFO")

# Optional (None if not set)
optional_key = os.getenv("OPTIONAL_KEY")  # returns None if not found
```

```typescript
// TypeScript with optional
const logLevel = process.env.LOG_LEVEL ?? "INFO";
const optionalKey = process.env.OPTIONAL_KEY;  // undefined if not set
```

---

## Docker Integration

### Option 1: env_file (Recommended)

```yaml
# docker-compose.yml
services:
  api:
    image: my-api:latest
    env_file:
      - .env
    # OR for production:
    # env_file:
    #   - .env.production
```

### Option 2: Coolify Environment Injection

When deploying via Coolify, set environment variables in the Coolify dashboard.
Coolify will inject them into the container at runtime.

```yaml
# In Coolify, add these under "Environment Variables":
# DATABASE_URL=${DATABASE_URL}
# TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
```

### Option 3: Docker Secret (Swarm)

```yaml
# docker-compose.yml
services:
  api:
    image: my-api:latest
    secrets:
      - database_url
    environment:
      DATABASE_URL: "${DATABASE_URL}"

secrets:
  database_url:
    file: ./secrets/database_url.txt
```

---

## Environment Variable Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| **API Keys** | `*_API_KEY` | `OPENAI_API_KEY`, `TELEGRAM_API_KEY` |
| **Tokens** | `*_TOKEN` | `GITHUB_TOKEN`, `SESSION_TOKEN` |
| **Passwords** | `*_PASSWORD` | `DB_PASSWORD`, `REDIS_PASSWORD` |
| **URLs** | `*_URL` | `DATABASE_URL`, `WEBAPP_URL` |
| **Hosts** | `*_HOST` | `DB_HOST`, `REDIS_HOST` |
| **Ports** | `*_PORT` | `DB_PORT`, `API_PORT` |
| **Secrets** | `*_SECRET` | `SESSION_SECRET`, `INTERNAL_API_SECRET` |
| **IDs** | `*_ID` | `CLIENT_ID`, `PROJECT_ID` |
| **Credentials** | `*_CREDENTIALS` | `AWS_CREDENTIALS` |
| **Keys** | `*_KEY` | `ENCRYPTION_KEY` |

### Prohibited Patterns

| Prohibited | Reason |
|------------|--------|
| `secret`, `password`, `token` (standalone) | Too generic, ambiguous |
| Lowercase `database_url` | Inconsistent with screaming snake case |
| Prefixed with service name only (`telegram` vs `TELEGRAM_BOT_TOKEN`) | Missing context |
| Special characters in name | May cause parsing issues |

### Environment-Specific Variables

```
# Development
DATABASE_URL=postgresql://localhost:5432/dev_db

# Staging
DATABASE_URL=postgresql://staging-db:5432/staging_db

# Production
DATABASE_URL=postgresql://prod-db-cluster:5432/prod_db
```

---

## Troubleshooting

### Symptom: `KeyError: 'SECRET_NAME'` or `undefined is not a function`

**Cause:** `.env` not loaded before accessing secret.

**Fix:**

```python
# BEFORE any imports
from dotenv import load_dotenv
load_dotenv()
```

```typescript
// AT TOP of entry point file
import 'dotenv/config';
```

---

### Symptom: `None` or `undefined` for secret value

**Cause:** Secret not synced from Infisical to `.env`.

**Fix:**

```bash
# 1. Verify secret exists in Infisical vault
infisical secrets get SECRET_NAME --env=development

# 2. Run sync to update .env
infisical secrets --format=env --env=development > .env

# 3. Reload shell or restart application
```

---

### Symptom: `InfisicalClient is not defined` in application code

**Cause:** Using Infisical SDK in application code (violates mandate).

**Fix:** Remove Infisical SDK from application code. Use `os.getenv()` instead.

```python
# WRONG - application code using Infisical SDK
from infisical import InfisicalClient
client = InfisicalClient()
secret = client.get_secret("MY_SECRET")

# CORRECT - application code reads from environment
import os
from dotenv import load_dotenv
load_dotenv()
secret = os.getenv("MY_SECRET")
```

---

### Symptom: Docker container missing secrets

**Cause:** `.env` not included in container build or Coolify not configured.

**Fix:**

```yaml
# Option 1: Include .env in build
# docker-compose.yml
services:
  api:
    build: .
    env_file:
      - .env

# Option 2: Use multi-stage build with .env
# Dockerfile
COPY .env.production .env
```

**For Coolify:** Set environment variables in Coolify dashboard under "Environment" tab.

---

### Symptom: Secret shows as `None` in production but works locally

**Cause:** Production `.env` not updated after adding secret to Infisical.

**Fix:**

```bash
# Sync production secrets
infisical secrets --format=env --env=production --output=.env.production

# Redeploy container or restart service
```

---

## Secret Validation Checklist

Before committing or deploying:

- [ ] `.env` is loaded at process startup (`load_dotenv()` or `dotenv/config`)
- [ ] Secret accessed via `os.getenv()` / `process.env`, not Infisical SDK
- [ ] No `InfisicalClient` in application code
- [ ] No hardcoded secrets (no `ghp_`, `sk-`, literal tokens)
- [ ] `.env` has correct permissions (`chmod 600`)
- [ ] `.env` is gitignored (check `.gitignore`)
- [ ] Secret synced from Infisical to `.env`
- [ ] Secret name follows `SCREAMING_SNAKE_CASE`

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [ADR-001](../ADRs/ADR-001-denv-as-canonical-secrets-source.md) | Architecture decision record for .env pattern |
| [SECRETS-MANDATE.md](../GOVERNANCE/SECRETS-MANDATE.md) | Enforcement rules and detection patterns |
| [EXCEPTIONS.md](../GOVERNANCE/EXCEPTIONS.md) | Active exceptions to the mandate |
| [SECRETS-MANDATE.md#sync-scripts](../GOVERNANCE/SECRETS-MANDATE.md#secrets-sync--infrastructure-scripts-only) | Approved sync script locations |

---

**Authority:** will-zappro
**Pattern:** SPEC-029-INFISICAL-SDK-MANDATORY
**Last updated:** 2026-04-14
