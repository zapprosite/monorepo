# Documentation Drift Report

**Generated:** 2026-04-26
**Based on:** SPEC-091 holistic docs cleanup
**Status:** REVIEW NEEDED

---

## Executive Summary

This report identifies documentation files that may be outdated or reference non-existent paths, commands, or configurations. Based on prior analysis (SPEC-091).

---

## High Risk Drift

### README.md

| Issue | Severity | Description |
|-------|----------|-------------|
| Hardcoded ports | HIGH | References `:4010` (Gym), `:8642` (Hermes), `:4000` (API), `:3456` (Chat) — these may change |
| Domain references | HIGH | `gym.zappro.site`, `hermes.zappro.site`, `api.zappro.site` — subdomain changes not tracked |
| Port :4002 | HIGH | `llm.zappro.site :4002` — LiteLLM port conflicts with PORTS.md (4000 = aurelia-api) |

### ARCHITECTURE.md

| Issue | Severity | Description |
|-------|----------|-------------|
| Port numbers | MEDIUM | Architecture diagrams show specific ports that may drift |
| Service URLs | MEDIUM | URLs to internal services may be stale |

---

## Medium Risk Drift

### CONTRIBUTING.md

| Issue | Severity | Description |
|-------|----------|-------------|
| Reference paths | MEDIUM | Line 100: `docs/GUIDES/LANGUAGE-STANDARDS.md` — verify exists |
| Reference paths | MEDIUM | Line 101: `docs/GUIDES/` — directory may not exist |

### RUNBOOK.md

| Issue | Severity | Description |
|-------|----------|-------------|
| Commands drift | MEDIUM | Docker Compose commands may reference old paths |
| Recovery steps | MEDIUM | ZFS snapshot commands may need verification |

---

## Files Referencing Non-Existent Paths

Based on SPEC-091 analysis:

```bash
# Verify these paths exist
test -e docs/GUIDES/LANGUAGE-STANDARDS.md && echo "EXISTS" || echo "MISSING"
test -e docs/GUIDES/backup-runbook.md && echo "EXISTS" || echo "MISSING"
test -e docs/GUIDES/DISASTER-RECOVERY.md && echo "EXISTS" || echo "MISSING"
test -e docs/GUIDES/env-management.md && echo "EXISTS" || echo "MISSING"
```

---

## Recommendations

1. **Port documentation** — Centralize port definitions in `PORTS.md` and reference programmatically
2. **URL templating** — Use variables for domain/port in docs instead of hardcoding
3. **Periodic validation** — Run `docs-validate.yml` CI on every PR affecting docs/

---

## CI Validation

A CI workflow (`docs-validate.yml`) is provided to detect drift automatically.
See: `.github/workflows/docs-validate.yml`

---

**Template:** enterprise-template-v2
**Review:** Required before merge
