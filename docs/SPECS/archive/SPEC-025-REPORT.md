---
archived: true
superseded_by: SPEC-024 (monorepo) + SPEC-025-openclaw-ceo-mix-voice-stack
see_also:
  - SPEC-024, SPEC-025
---

> ⚠️ ARCHIVED — Superseded by [SPEC-024](../SPEC-024.md) and related canonical specs.

# SPEC-025-REPORT: Auto-Cure Execution Report

**Date/Time:** 2026-04-12 06:34
**Scanner:** `tasks/autonomous/auto-cure-scanner.sh`
**Mode:** ENTERPRISE PINNED

---

## Summary

| Category | Result |
|----------|--------|
| Hardcoded Secrets | PASS |
| Governance Doc Frontmatter | FAIL (17 docs missing) |
| Hardcoded Docker Configs | WARN (3 found) |
| Infisical SDK Patterns | PASS |
| Version Lock | PASS (turbo 2.9.6) |
| Script Permissions | PASS |
| Locked-Config Mechanism | PASS |
| Gitignore | PASS |

---

## Issues Found by Scanner

### Issue 1: Governance Docs Missing Frontmatter (FAIL)

17 governance documents are missing required `version:` and `author:` frontmatter fields:

| Document | Missing Fields |
|---------|---------------|
| ANTI-FRAGILITY.md | author |
| APPROVAL_MATRIX.md | version, author |
| CHANGE_POLICY.md | version, author |
| CONTRACT.md | version, author |
| DATABASE_GOVERNANCE.md | version, author |
| DOCUMENTATION_MAP.md | version, author |
| DUPLICATE-SERVICES-RULE.md | version, author |
| GUARDRAILS.md | version, author |
| IMMUTABLE-SERVICES.md | version, author |
| INCIDENTS.md | version, author |
| LOCKED-CONFIG.md | version, author |
| MASTER-PASSWORD-PROCEDURE.md | version, author |
| OPENCLAW_DEBUG.md | version, author |
| PINNED-SERVICES.md | version, author |
| QUICK_START.md | version, author |
| README.md | version, author |
| RECOVERY.md | version, author |
| SECRETS_POLICY.md | version, author |

### Issue 2: Hardcoded Docker Configs (WARN)

Found potentially hardcoded values in docker-compose files:

- `/srv/monorepo/docker-compose.gitea-runner.yml:7`: `image: docker.io/gitea/act_runner:nightly-dind`
- `/srv/monorepo/docker-compose.yml:3`: `image: postgres:15-alpine`
- `/srv/monorepo/docker-compose.yml`: ports and environment sections

### Issue 3: PINNED-SERVICES.md Table Parsing

The pinned services table extraction is returning raw markdown instead of parsed container names. The table structure appears correct but the awk extraction is not filtering properly.

---

## Issues Fixed

- **Hardcoded Secrets:** PASS - No hardcoded API keys (sk-*, ghp_*, AKIA*) found
- **Infisical SDK:** PASS - All scripts using Infisical SDK instead of os.getenv
- **Script Permissions:** PASS - All scripts are executable
- **Locked-Config Mechanism:** PASS - unlock-config.sh, lock-config.sh, verify-locked.sh all exist
- **Gitignore:** PASS - Includes node_modules/, .pnpm-store/, locked-config/

---

## Remaining Issues

1. **Governance docs frontmatter (CRITICAL):** 17 files need `version:` and `author:` fields added
2. **Hardcoded Docker images (WARN):** postgres:15-alpine and act_runner:nightly-dind should use env var substitution or pinned SHA
3. **Pinned services table (PARSING):** PINNED-SERVICES.md table not parsing correctly - needs awk pattern fix

---

## Next Steps

### Priority 1: Fix Governance Doc Frontmatter

Add frontmatter to all 17 governance documents. Required fields:
```yaml
---
version: 1.0.0
author: will-zappro
---
```

Documents to update:
- /srv/monorepo/docs/GOVERNANCE/ANTI-FRAGILITY.md
- /srv/monorepo/docs/GOVERNANCE/APPROVAL_MATRIX.md
- /srv/monorepo/docs/GOVERNANCE/CHANGE_POLICY.md
- /srv/monorepo/docs/GOVERNANCE/CONTRACT.md
- /srv/monorepo/docs/GOVERNANCE/DATABASE_GOVERNANCE.md
- /srv/monorepo/docs/GOVERNANCE/DOCUMENTATION_MAP.md
- /srv/monorepo/docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md
- /srv/monorepo/docs/GOVERNANCE/GUARDRAILS.md
- /srv/monorepo/docs/GOVERNANCE/IMMUTABLE-SERVICES.md
- /srv/monorepo/docs/GOVERNANCE/INCIDENTS.md
- /srv/monorepo/docs/GOVERNANCE/LOCKED-CONFIG.md
- /srv/monorepo/docs/GOVERNANCE/MASTER-PASSWORD-PROCEDURE.md
- /srv/monorepo/docs/GOVERNANCE/OPENCLAW_DEBUG.md
- /srv/monorepo/docs/GOVERNANCE/PINNED-SERVICES.md
- /srv/monorepo/docs/GOVERNANCE/QUICK_START.md
- /srv/monorepo/docs/GOVERNANCE/README.md
- /srv/monorepo/docs/GOVERNANCE/RECOVERY.md
- /srv/monorepo/docs/GOVERNANCE/SECRETS_POLICY.md

### Priority 2: Review Hardcoded Docker Configs

Evaluate if docker-compose images should use pinned SHA tags instead of mutable tags like `nightly-dind` and `15-alpine`.

### Priority 3: Fix Scanner Table Parsing

Update `auto-cure-scanner.sh` line 124 to properly extract container names from markdown tables.

---

## Pinned Services Status (All Healthy)

```
zappro-tts-bridge         Up 39 hours
openwebui-bridge-agent  Up 42 hours (healthy)
autoheal                 Up 42 hours (healthy)
openclaw-mcp-wrapper     Up 42 hours (healthy)
open-webui               Up 42 hours (healthy)
openclaw                 Up 15 minutes (healthy)
browser                  Up 42 hours (healthy)
zappro-wav2vec2-proxy    Up 39 hours
gitea-runner             Up 42 hours
zappro-wav2vec2          Up 39 hours (healthy)
perplexity-agent         Up 42 hours (healthy)
zappro-litellm           Up 42 hours
zappro-litellm-db        Up 42 hours (healthy)
docker-autoheal          Up 42 hours (healthy)
n8n                      Up 42 hours (healthy)
postgresql               Up 42 hours (healthy)
grafana                  Up 42 hours (healthy)
alert-sender             Up 42 hours (healthy)
```

---

**Report Generated:** 2026-04-12 06:34
**Scanner Version:** auto-cure-scanner.sh
