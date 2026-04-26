# PLAN: Security Critical Fixes

**Date:** 2026-04-09
**Status:** PENDING — awaiting human review
**Source:** security-audit-09-04-2026 (20 agents)

---

## Context

Security audit found 8 CRITICAL findings requiring immediate action. This plan addresses them in dependency order.

---

## Dependency Graph

```
[T-0] chmod coolify .env           → [T-1] prerequisite
[T-1] Revoke OAuth secret          → manual Google Console (no deps)
[T-2] Git rm runner token          → [T-3] rotate runner token in Gitea
[T-3] Rotate runner token          → Gitea UI / API call
[T-4] Grafana credentials          → [T-5] encrypt backups (independent)
[T-5] Encrypt backups             → cleanup old backups
[T-6] coolify-sentinel privileged → docker compose edit
[T-7] n8n basic auth + encrypt   → env var + file perms

Order: T-0 → T-1 → T-2 → T-3 → (T-4 || T-5) → T-6 → T-7
```

---

## Phase 1: Immediate (no preparation needed)

### Task 1: chmod coolify .env (1 min)

**Action:** `chmod 600 /data/coolify/source/.env`

**Verification:**
```bash
ls -la /data/coolify/source/.env
# Expected: -rw------- (600)
```

**Acceptance:** File is not world-readable.

---

### Task 2: Revoke OAuth Secret (manual, 5 min)

**Action:** Go to Google Cloud Console → APIs & Services → Credentials → Delete OAuth Client `GOCSPX-fgKPRDB9UcWb-i8Pr6eblXI`

**Verification:**
```bash
# After revocation, this secret should fail:
curl -s "https://oauth2.googleapis.com/tokeninfo?access_token=GOCSPX-fgKPRDB9UcWb-i8Pr6eblXI"
# Expected: error response
```

**Acceptance:** Secret no longer valid at Google.

---

### Task 3: Git remove runner token (2 min)

**Action:**
```bash
cd /srv/monorepo
git rm --cached runner/data/.runner
echo "runner/data/.runner" >> .gitignore
git add .gitignore
git commit -m "chore: remove runner token from git tracking"
```

**Verification:**
```bash
git ls-files | grep runner
# Should return nothing
git log --all -p -S "40e5c7ae" | head -5
# Verify token is no longer in current branch HEAD
```

**Acceptance:** `runner/data/.runner` not tracked in git.

---

## Phase 2: Rotations (requires service access)

### Task 4: Rotate Gitea Runner Token (5 min)

**Action:**
1. Gitea UI → Administration → Actions → Runners
2. Deregister existing runner
3. Re-register: `docker exec zappro-gitea gitea actions register-repo --name <runner-name> --token <new-token>`
4. Update new token in Coolify deployment

**Verification:**
```bash
# New token in use:
cat /srv/monorepo/runner/data/.runner
# Should be different from old token
```

**Acceptance:** Runner connects with new token.

---

### Task 5: Grafana Credentials Rotation (15 min)

**Action:**
1. Generate new admin password: `openssl rand -base64 24`
2. Generate new OAuth secret via Google Cloud Console (new OAuth client)
3. Update Infisical: `GF_SECURITY_ADMIN_PASSWORD` and `GF_AUTH_GOOGLE_CLIENT_SECRET`
4. Update docker-compose.yml or Coolify env with new values from Infisical
5. Change OAuth allowlist from `"gmail.com zappro.site"` to just `"zappro.site"`

**Verification:**
```bash
# New OAuth secret in Infisical:
python3 -c "from infisical_sdk import ...; verify new secret exists"

# Grafana login works with new password:
curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/api/health
# Should return 200 with new credentials
```

**Acceptance:** Grafana accessible only via zappro.site OAuth domain.

---

## Phase 3: Backup Security (independent of above)

### Task 6: Encrypt Old Backups (10 min)

**Action:**
```bash
# Install age if not present:
# age is a modern encryption tool (apt install age or download binary)

# Encrypt existing backups:
age -p -r <recipient-public-key> -o /srv/backups/coolify-db-20260408.sql.age /srv/backups/coolify-db-20260408.sql
rm /srv/backups/coolify-db-20260408.sql

# For future backups, add to backup script:
# age -e -r <key> -o "$backup.sql.age" "$backup.sql"
```

**Verification:**
```bash
# Verify backup is encrypted:
file /srv/backups/coolify-db-20260408.sql.age
# Should show "age encrypted file"
```

**Acceptance:** Plaintext SQL no longer exists in /srv/backups/.

---

### Task 7: Fix coolify-sentinel Privileged Mode (10 min)

**Action:**
1. Edit coolify-sentinel docker compose or container config
2. Remove `--privileged` flag
3. Add read-only docker.sock mount: `--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock,readonly`
4. Restart container

**Verification:**
```bash
docker inspect coolify-sentinel --format '{{.HostConfig.Privileged}}'
# Should return: false

docker inspect coolify-sentinel --format '{{json .HostConfig.Binds}}'
# Should show docker.sock as read-only mount
```

**Acceptance:** Container not privileged, docker.sock is read-only mount.

---

### Task 8: n8n Basic Auth + Encryption Key (20 min)

**Action:**
1. Add to n8n container env:
   ```
   N8N_BASIC_AUTH_ACTIVE=true
   N8N_BASIC_AUTH_USER=admin
   N8N_BASIC_AUTH_PASSWORD=<new-strong-password>
   N8N_SECURE_COOKIE=true
   ```
2. Update Infisical with new password
3. Change encryption key file permissions: `chmod 600 /home/node/.n8n/config`
4. Restart n8n

**Verification:**
```bash
# Basic auth required:
curl -s -o /dev/null -w "%{http_code}" http://localhost:5678
# Should return 401 without credentials

# File permissions:
ls -la /home/node/.n8n/config
# Should show: -rw------- (600)
```

**Acceptance:** n8n requires basic auth, config file not world-readable.

---

## Phase 4: Verification

After all tasks complete:

```bash
# Verify all criticals resolved:
echo "=== Critical Fix Verification ==="

echo -n "1. coolify .env perms: "
[ "$(stat -c %a /data/coolify/source/.env)" = "600" ] && echo "PASS" || echo "FAIL"

echo -n "2. OAuth secret revoked: "
curl -s "https://oauth2.googleapis.com/tokeninfo?access_token=GOCSPX-fgKPRDB9UcWb-i8Pr6eblXI" | grep -q error && echo "PASS (revoked)" || echo "FAIL (still valid)"

echo -n "3. runner token not in git: "
git ls-files | grep -q "runner/data/.runner" && echo "FAIL" || echo "PASS"

echo -n "4. coolify-sentinel not privileged: "
docker inspect coolify-sentinel --format '{{.HostConfig.Privileged}}' | grep -q false && echo "PASS" || echo "FAIL"

echo -n "5. n8n basic auth active: "
grep -q "N8N_BASIC_AUTH_ACTIVE=true" /srv/data/n8n/docker-compose.yml 2>/dev/null && echo "PASS" || echo "CHECK MANUALLY"

echo -n "6. Backups encrypted: "
find /srv/backups -name "*.sql" ! -name "*.age" 2>/dev/null | grep -q . && echo "FAIL (plaintext found)" || echo "PASS (no plaintext)"
```

---

## Stats

| Task | Time | Risk | Dependency |
|------|------|------|------------|
| T-0 chmod | 1 min | None | None |
| T-1 revoke OAuth | 5 min (manual) | None | None |
| T-2 git rm | 2 min | None | None |
| T-3 rotate runner | 5 min | Gitea access | T-2 |
| T-4 Grafana rotate | 15 min | Service restart | None |
| T-5 encrypt backups | 10 min | None | None |
| T-6 sentinel | 10 min | Service restart | None |
| T-7 n8n | 20 min | Service restart | T-4 (password) |

**Total estimated:** ~70 min

---

## Next

Awaiting human approval to proceed.
