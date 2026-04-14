# TODO: Security Critical Fixes

**Plan:** tasks/plan-security-critical.md
**Status:** PENDING — awaiting human review

---

## Task T-0: chmod coolify .env

**Status:** PENDING
**Verification:** `stat -c %a /data/coolify/source/.env` → `600`

---

## Task T-1: Revoke OAuth Secret (manual)

**Status:** PENDING
**Verification:** Google Console → Delete OAuth Client [GOOGLE_OAUTH_SECRET]

---

## Task T-2: Git remove runner token

**Status:** PENDING
**Verification:** `git ls-files | grep runner/data/.runner` → empty

---

## Task T-3: Rotate Gitea Runner Token

**Status:** PENDING
**Blocked by:** T-2
**Verification:** Runner connects with new token

---

## Task T-4: Grafana Credentials Rotation

**Status:** PENDING
**Verification:** Grafana login with new password + OAuth restricted to zappro.site

---

## Task T-5: Encrypt Backups

**Status:** PENDING
**Verification:** `find /srv/backups -name "*.sql" ! -name "*.age"` → empty

---

## Task T-6: Fix coolify-sentinel Privileged

**Status:** PENDING
**Verification:** `docker inspect coolify-sentinel --format '{{.HostConfig.Privileged}}'` → false

---

## Task T-7: n8n Basic Auth + Encryption Key

**Status:** PENDING
**Blocked by:** T-4
**Verification:** `curl -o /dev/null -w "%{http_code}" http://localhost:5678` → 401

---

## Verification Script

After all tasks:
```bash
bash tasks/plan-security-critical.md  # run verification section
```
