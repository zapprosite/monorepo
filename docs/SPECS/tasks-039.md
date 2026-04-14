# TASK-039: bot.zappro.site → Hermes Gateway

> Generated from: SPEC-039-hermes-gateway-tunnel.md
> Date: 2026-04-14
> Priority: CRITICAL

---

## Overview

This pipeline covers the activation of `bot.zappro.site` as endpoint for the Hermes Gateway (Telegram bot) via Cloudflare Tunnel. The Hermes Gateway is already running (PID 1990953) in polling mode — tasks below cover tunnel DNS setup and end-to-end validation.

**Recommended Approach:** Option B — Create `hermes.zappro.site` as new subdomain (low complexity, zero risk) instead of updating the existing bot.zappro.site tunnel.

---

## Tasks

### TASK-039-001
**Title:** Verify Hermes Gateway is running and accessible locally
**Priority:** P0
**Status:** pending
**Verification Command:** `curl -s http://10.0.5.2:8642/health || curl -s http://localhost:8642/health`
**Dependencies:** None
**Success Criteria Mapped:** SC-1, SC-2

---

### TASK-039-002
**Title:** Create hermes.zappro.site Cloudflare tunnel (Option B — recommended)
**Priority:** P0
**Status:** pending
**Verification Command:** `curl -sI https://hermes.zappro.site | grep HTTP`
**Dependencies:** TASK-039-001
**Success Criteria Mapped:** SC-1, SC-2

**Notes:**
- Use the `new-subdomain` skill or Cloudflare API to create `hermes.zappro.site` → `10.0.5.2:8642`
- See `/srv/ops/ai-governance/SUBDOMAINS.md` for current state
- See `/srv/ops/ai-governance/PORTS.md` before using any port

---

### TASK-039-003
**Title:** Configure cloudflared on Ubuntu Desktop for hermes.zappro.site
**Priority:** P0
**Status:** pending
**Verification Command:** `cloudflared tunnel list` or check tunnel status in Cloudflare dashboard
**Dependencies:** TASK-039-002
**Success Criteria Mapped:** SC-1

---

### TASK-039-004
**Title:** Update bot.zappro.site tunnel config or deprecate (Option A — only if approved)
**Priority:** P1
**Status:** pending
**Verification Command:** `curl -sI https://bot.zappro.site | grep HTTP`
**Dependencies:** TASK-039-002, TASK-039-003
**Success Criteria Mapped:** SC-1, SC-2

**Notes:**
- Only execute if Option A is explicitly approved by will
- Risk: Telegram bot history may be affected
- Alternative: deprecate bot.zappro.site and point to OpenClaw via separate tunnel

---

### TASK-039-005
**Title:** End-to-end Telegram test — /start command via hermes.zappro.site
**Priority:** P0
**Status:** pending
**Verification Command:** Send `/start` to @bot.zappro.site via Telegram and verify response
**Dependencies:** TASK-039-002, TASK-039-003
**Success Criteria Mapped:** SC-3, SC-5

---

### TASK-039-006
**Title:** Verify Telegram polling mode is stable (no webhook needed for homelab)
**Priority:** P1
**Status:** pending
**Verification Command:** Check Hermes Gateway logs for polling activity; verify no webhook registration errors
**Dependencies:** TASK-039-005
**Success Criteria Mapped:** SC-4

**Notes:**
- Polling mode is recommended for homelab (no public IP required)
- Webhook mode requires HTTPS public endpoint with valid cert
- Skip if polling remains stable after tunnel is live

---

### TASK-039-007
**Title:** Update SPEC-038 (Hermes Agent Migration) with tunnel status
**Priority:** P2
**Status:** pending
**Verification Command:** Review SPEC-038 for any references to bot.zappro.site that need updating
**Dependencies:** TASK-039-005
**Success Criteria Mapped:** SC-5

---

### TASK-039-008
**Title:** Update memory and docs index with hermes.zappro.site deployment
**Priority:** P2
**Status:** pending
**Verification Command:** Verify memory-keeper sync and docs-index updated
**Dependencies:** TASK-039-005, TASK-039-007
**Success Criteria Mapped:** SC-5

---

## Success Criteria Mapping

| Criterion | Tasks |
|-----------|-------|
| SC-1: Cloudflare tunnel updated to Hermes Gateway (10.0.5.2:8642) | TASK-039-002, TASK-039-003 |
| SC-2: bot.zappro.site or hermes.zappro.site responds HTTP 200 | TASK-039-002, TASK-039-004 |
| SC-3: Telegram bot responds to /start | TASK-039-005 |
| SC-4: Telegram webhook configured (if necessary) | TASK-039-006 |
| SC-5: End-to-end Telegram message → Hermes → response | TASK-039-005, TASK-039-007, TASK-039-008 |

---

## Critical Path

```
TASK-039-001 → TASK-039-002 → TASK-039-003 → TASK-039-005 → TASK-039-008
```

---

## Open Questions (to resolve during implementation)

| # | Question | Decision Required |
|---|----------|-------------------|
| 1 | Use Option A (update bot.zappro.site) or Option B (create hermes.zappro.site)? | Before TASK-039-004 |
| 2 | Does Telegram webhook need public HTTPS? | Before TASK-039-006 |
| 3 | Deprecate or keep bot.zappro.site as alias? | Before TASK-039-004 |
| 4 | Gateway polling mode sufficient for production? | Before TASK-039-006 |
