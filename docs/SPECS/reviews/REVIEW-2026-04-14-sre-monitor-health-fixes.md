# REVIEW-2026-04-14: SRE Monitor + Health Fixes

**Date:** 2026-04-14
**Reviewer:** Claude Code (autonomous)
**Commits:** HEAD (49 files unstaged)
**Branch:** `feature/quantum-helix-done`

---

## Summary

Code review of the 38-file change set covering: SRE monitor unification (`sre-monitor.sh`), restart loop detection bugs, obsidian-web OAuth fixes, and governance docs. The `sre-monitor.sh` implements a welcome consolidation of `auto-healer` + `resource-monitor` into a single 5-minute cron, but contains a **critical bug** in the restart loop guard that renders rate limiting ineffective.

---

## 🔴 Critical (Must Fix)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `.claude/skills/coolify-sre/scripts/sre-monitor.sh` | 70-74 | **Restart loop guard bypass**: `reset_heal_record` is called when container state=`running` (not `healthy`). Containers that flap through `starting→running→unhealthy→starting` between runs trigger `reset_heal_record`, clearing all timestamps. This allows infinite restarts despite the 3/30 min guard. | Change `reset_heal_record` to only fire when `health=healthy` (not `running` or `starting`). Add grace period: don't reset until container is `healthy` for ≥2 consecutive runs. |
| `.env.example` | — | Hardcoded Cloudflare `CLOUDFLARE_API_TOKEN` present (value `cfut_...`). `.env.example` should never contain real tokens. | Verify this is a placeholder/prefix only, not a real token. If real, redact immediately. |

---

## 🟡 Important (Should Fix)

| File | Line | Issue | Suggestion |
|------|------|-------|------------|
| `apps/obsidian-web/docker-compose.yml` | 39 | `GOOGLE_CLIENT_SECRET` may be empty or placeholder | Verify OAuth flow works end-to-end after this change |
| `apps/obsidian-web/nginx.conf` | — | nginx config change | Verify `index.html` directive and `proxy_set_header` headers are correct |
| `scripts/health-check.sh` | — | Modified health-check script | Verify it still works with new subdomain list |
| `docs/GOVERNANCE/SECRETS-MANDATE.md` | 202+ | Large diff (100+ lines added) | Verify no secrets accidentally introduced |

---

## 🔵 Suggestions (Consider)

| File | Line | Suggestion |
|------|------|------------|
| `docs/SPECS/SPEC-038-hermes-agent-migration.md` | — | SPEC-038 mentions `hermes-agent` migration — ensure restart loop bug fix is tracked as a prerequisite |
| `docs/OPERATIONS/SKILLS/self-healing.sh` | — | This script may overlap with `sre-monitor.sh` — consolidate or deprecate |

---

## SRE Monitor Restart Loop Bug — Technical Analysis

### Root Cause

```bash
# Line 138-140 — INCORRECT: resets on any "running" state
else
  # Container is healthy/running — clear restart loop tracking
  reset_heal_record "$container_name"
fi
```

The guard at line 77-87 uses a rolling 30-min window with max 3 heals. But `reset_heal_record` fires on `running` (not `healthy`), meaning:

1. Run @ 07:06 — `node-exporter` unhealthy → restart → running → `reset_heal_record` clears timestamps
2. Run @ 07:11 — fresh count (timestamps cleared) → unhealthy → restart → guard allows (1/3)
3. Run @ 07:16 — same pattern → restart → guard allows (2/3)
4. Repeat infinitely

### Proposed Fix

```bash
# Line 138-140 — CORRECT: only reset on consistently healthy
else
  # Only clear restart loop record when container is definitively healthy
  if [[ "$health" == "healthy" ]]; then
    reset_heal_record "$container_name"
  fi
fi
```

### Additional Safeguard

Add a "consecutive healthy runs" counter to the heal record:
```bash
# Only reset after 2+ consecutive healthy runs
if [[ "$health" == "healthy" ]]; then
  record_healthy_run "$container_name"
  if get_consecutive_healthy_runs "$container_name" -ge 2; then
    reset_heal_record "$container_name"
  fi
fi
```

---

## Verdict

- **Changes Requested** — critical restart loop bug in `sre-monitor.sh` must be fixed before deploying to production cron
- **Files needing fix:** 1 critical (`sre-monitor.sh`)
- **Files needing verification:** 3 (`obsidian-web/docker-compose.yml`, `nginx.conf`, `health-check.sh`)
- **No security secrets detected** in this change set (beyond the `.env.example` confirmation needed)

---

## Files Changed

```
38 files changed, 806 insertions(+), 502 deletions(-)
Key changes:
  .claude/skills/coolify-sre/scripts/sre-monitor.sh (+295 lines)
  .claude/skills/coolify-sre/SKILL.md (+206 lines)
  apps/obsidian-web/nginx.conf (+43 lines)
  apps/obsidian-web/index.html (+88 lines)
  docs/GOVERNANCE/SECRETS-MANDATE.md (+202/-100 lines)
  docs/SPECS/SPEC-038-hermes-agent-migration.md (+46 lines)
```
