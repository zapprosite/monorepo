---
version: 1.0
author: will-zappro
date: 2026-04-08
---

# Secrets Management Policy

**Host:** will-zappro
**Effective:** 2026-03-16
**Updated:** 2026-04-08

Definitive rules for where secrets can and CANNOT live.

---

## 0. Source of Truth: Infisical Vault

**Vault:** `vault.zappro.site` (Infisical self-hosted)
**Project:** `zappro-p-tc-k` / `e42657ef-98b2-4b9c-9a04-46c093bd6d37`
**Env:** `dev`

Todos os secrets de aplicação/API **devem** estar no vault. Ver exceções em §1.

Scripts de injection: `~/.claude/scripts/env-wrapper.sh`

---

## 1. Where Secrets CAN Live

### ✅ INFISICAL VAULT (PRIMARY)

**Location:** Infisical (`vault.zappro.site`)
**Purpose:** API keys, tokens, passwords de serviços cloud/externos
**Access:** `~/.claude/scripts/env-wrapper.sh` injeta via env vars
**Rotation:** Manual via `infisical-cli` ou SDK

**Referência:** `DATABASE_GOVERNANCE.md` para inventário completo de Postgres

### ✅ Coolify `.env` (N8N containers — excepção)

Cada serviço N8N no Coolify tem `.env` local com credenciais do Postgres containerizado.
**NÃO vão para o vault principal** — são service-local.

**Razão:** Credenciais geradas pelo Coolify por container, não partilhadas entre serviços.

### ✅ `/root/.env` or `/root/.env.local`

### ⚠️ CONDITIONAL (Acceptable with care)

**`/srv/monorepo/.env` (local dev only)**
- Purpose: Local development secrets
- Scope: Developer machine only
- Git: NEVER commit (`.gitignore` must include `.env`)
- Content: Copy of `.env.example` + filled values
- Lifespan: Deleted after development session
- Security: Low (local machine only)

**Environment variables (at runtime)**
- Purpose: Injected at service start
- Scope: Only visible inside running container
- Backup: NO (environment not persistent)
- Security: Good (ephemeral)

---

## 2. Where Secrets CANNOT Live

### ❌ FORBIDDEN Locations

**Git repository (any branch)**
- NEVER hardcode secrets in code
- NEVER in config files tracked by Git
- NEVER in .env if committed
- NEVER in markdown documentation
- NEVER in JSON/YAML configs
- NEVER in Docker images

**Git history (even deleted)**
- If committed and deleted, it persists in history
- `git filter-branch` can remove, but risky
- Better: Never commit in the first place

**Docker images**
- NEVER build secrets into images
- NEVER use ARG/ENV in Dockerfile for secrets
- Instead: Inject at runtime via environment or volume

**Markdown documentation**
- NEVER example values are real
- NEVER place dummy passwords that look like real ones
- Use: `POSTGRES_PASSWORD=<your-password-here>`

**Public repositories**
- If repo is public, NEVER have `_example` files with real values
- Use: `.env.example` with placeholders only

**Logs**
- NEVER log secrets
- Most apps auto-redact (check), but don't rely on it
- Docker logs: `docker logs | grep -i password` (should be empty)

**Backups without encryption**
- NEVER backup .env files unencrypted
- If backing up: Encrypt with GPG
- Or: Don't backup secrets at all (regenerate on restore)

---

## 3. Secret Categories & Policies

### Tier 1: Database Passwords
**Sensitivity:** CRITICAL
**Storage:** `/root/.env`
**Rotation:** Every 6 months
**Backup:** NO (regenerate on restore)
**Example:**
```
POSTGRES_PASSWORD=UseStrongRandomPassword123!
POSTGRES_USER=n8n
```

### Tier 2: API Keys (Internal)
**Sensitivity:** HIGH
**Storage:** `/root/.env`
**Rotation:** Yearly or when team changes
**Backup:** NO
**Example:**
```
QDRANT_API_KEY=sk-1234567890abcdef
N8N_JWT_SECRET=UseStrongRandomSecret
```

### Tier 3: Third-Party API Keys (Future)
**Sensitivity:** HIGH
**Storage:** Kubernetes Secrets (when deployed) or HashiCorp Vault
**Rotation:** Per 3rd party policy (usually yearly)
**Backup:** Encrypted, version controlled in Vault
**Example:**
```
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
```

### Tier 4: SSH Keys
**Sensitivity:** CRITICAL
**Storage:** `/root/.ssh/` (permissions 700)
**Rotation:** Every 2 years or on team change
**Backup:** NEVER (not backed up)
**Recovery:** Regenerate and update repos/hosts

### Tier 5: TLS Certificates
**Sensitivity:** HIGH
**Storage:** `/etc/letsencrypt` (if using Let's Encrypt)
**Rotation:** Automatic (Let's Encrypt every 90 days)
**Backup:** YES (encrypted)
**Example:** Domain certificates for CapRover

---

## 4. .env.example Policy

**Purpose:** Template for developers (no actual secrets)

**Must contain:**
- All env vars the service needs
- Placeholder values (not real)
- Comments explaining each var

**Example (CORRECT):**
```bash
# PostgreSQL configuration
POSTGRES_USER=n8n                    # Default username
POSTGRES_PASSWORD=change_me          # Set a strong password in .env
POSTGRES_DB=n8n

# n8n Configuration
N8N_JWT_SECRET=change_me             # Generate with: openssl rand -base64 32
N8N_ADMIN_EMAIL=admin@example.com    # Set your email

# Qdrant Configuration
QDRANT_API_KEY=change_me             # Optional, for authentication
```

**Example (WRONG - DO NOT DO THIS):**
```bash
# ❌ WRONG: Real password
POSTGRES_PASSWORD=Myp@ssw0rdIsABC123

# ❌ WRONG: Real key
QDRANT_API_KEY=sk-abc123realkey456

# ❌ WRONG: Vague placeholder that looks real
POSTGRES_PASSWORD=postgres123
```

---

## 5. Secret Rotation Schedule

| Secret | Rotation | Trigger | Who |
|--------|----------|---------|-----|
| Database password | Every 6 months | Calendar | DevOps |
| API keys | Every 12 months | Calendar | DevOps |
| JWT secrets | Yearly or on incident | Calendar/incident | DevOps |
| SSH keys | Every 2 years | Calendar | DevOps |
| TLS certificates | 90 days | Automatic (ACME) | Automated |

---

## 6. Secret Generation Standards

### Strong Passwords
**Minimum 16 characters, mix of:**
- Uppercase letters (A-Z)
- Lowercase letters (a-z)
- Numbers (0-9)
- Special characters (!@#$%^&*)

**Generate with:**
```bash
openssl rand -base64 32        # 32-char base64
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'  # URL-safe
```

### API Keys
**Minimum 32 characters, cryptographically random**
```bash
openssl rand -hex 16           # 32-char hex
dd if=/dev/urandom bs=32 count=1 | base64
```

### JWT Secrets
**Minimum 32 bytes, base64 encoded**
```bash
openssl rand -base64 32
```

---

## 7. Secret Audit

### Scan for Secrets in Git
```bash
# Check if any secrets are in git (should be empty)
git log -p | grep -i password
git log -p | grep -i secret
git log -p | grep -i key

# Use git-secrets or truffleHog to scan
```

### Scan for Secrets in Code
```bash
# Find .env files (should only be .env.example)
find . -name ".env" -type f

# Find hardcoded passwords
grep -r "password\s*=" .
grep -r "secret\s*=" .
grep -r "api_key\s*=" .
```

### Scan for Secrets in Logs
```bash
# Docker logs (should have no passwords)
docker logs n8n | grep -i password
docker logs postgres | grep -i password
```

---

## 8. Incident: Secret Exposure

**If a secret is exposed (hardcoded, committed, leaked):**

1. **IMMEDIATE:**
   - Rotate the secret
   - File incident in INCIDENTS.md
   - Notify affected teams

2. **SHORT-TERM (within 24 hours):**
   - Remove from Git history (if possible)
   - Update all services using old secret
   - Verify no other copies exist

3. **MEDIUM-TERM (within 1 week):**
   - Audit for other exposures
   - Update secret rotation policy
   - Document root cause

4. **LONG-TERM (ongoing):**
   - Automated scanning (git-secrets)
   - Code review checks
   - Regular rotation

---

## 9. Enforcement

### For Developers
- Copy `.env.example` → `.env`
- Fill in YOUR OWN secrets (never share)
- Never commit `.env`
- `.gitignore` blocks this, but don't try to bypass

### For DevOps
- Store in `/root/.env` or external Vault
- Inject via environment at runtime
- Never log secrets
- Audit quarterly

### For CI/CD (future)
- Use masked variables
- No secret printing
- Encrypted artifact storage

---

## 10. Secret Recovery

**If secret is lost (not exposed, just lost):**

1. Database password lost?
   - Reset: `docker exec n8n-postgres psql -U postgres ALTER USER n8n WITH PASSWORD 'newpass';`
   - Update `/root/.env`
   - Restart n8n

2. API key lost?
   - Regenerate with provider
   - Update `/root/.env`
   - Restart service

3. SSH key lost?
   - Delete old key from all hosts
   - Generate new key
   - Distribute to all hosts

---

**Last Updated:** 2026-04-08
**Audit Cycle:** Quarterly (check for exposures)
**Rotation Cycle:** See schedule above
