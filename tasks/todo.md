# TODO — Detective Mode & Homelab Persistence
**Host:** will-zappro
**Date:** 2026-04-07
**Goal:** Detective mode research, systemd persistence, Gemma4 monitoring integration

---

## Slice 1: Detective Research

- [ ] **TASK-1A:** Create `/srv/ops/agents/scripts/detective_agent.sh`
  - **Verification:** `bash /srv/ops/agents/scripts/detective_agent.sh` produces JSON output
  - **Files:** `/srv/ops/agents/scripts/detective_agent.sh` (new)

- [ ] **TASK-1B:** Research voice-pipeline similar repos in homelab
  - **Verification:** Found `/home/will/Desktop/voice-pipeline` and related services
  - **Files:** `/home/will/Desktop/voice-pipeline/` (existing)

- [ ] **TASK-1C:** MCP forum research — stable versions as of 04/07/2026
  - **Verification:** WebSearch results for faster-whisper, kokoro TTS stability
  - **Files:** Rome Lab criteria report in `/srv/ops/agents/logs/detective/`

---

## Slice 2: Audit Current State

- [ ] **TASK-2A:** Create `/srv/ops/agents/scripts/audit_agent.sh`
  - **Verification:** Script produces audit report in `/srv/ops/agents/logs/audit/`
  - **Files:** `/srv/ops/agents/scripts/audit_agent.sh` (new)

- [ ] **TASK-2B:** Debug and fix failed systemd services
  - **Verification:** `systemctl status homelab-gemma-monitor.service` shows ACTIVE
  - **Files:** `/etc/systemd/system/homelab-gemma-monitor.service`, `/srv/ops/scripts/homelab-gemma-monitor.sh`

- [ ] **TASK-2C:** Document all voice-pipeline related services
  - **Verification:** `/srv/monorepo/docs/INFRASTRUCTURE/VOICE_SERVICES.md` exists
  - **Files:** `/srv/monorepo/docs/INFRASTRUCTURE/VOICE_SERVICES.md` (new)

---

## Slice 3: Systemd Service Persistence

- [ ] **TASK-3A:** Create `/etc/systemd/system/voice-pipeline-persist.service`
  - **Verification:** Service starts whisper-api on boot
  - **Files:** `/etc/systemd/system/voice-pipeline-persist.service` (new)

- [ ] **TASK-3B:** Fix `homelab-gemma-monitor.service` (EXEC error)
  - **Verification:** `systemctl status homelab-gemma-monitor.service` shows ACTIVE (exited)
  - **Files:** `/srv/ops/scripts/homelab-gemma-monitor.sh`

- [ ] **TASK-3C:** Fix `homelab-health-check.service` (EXEC error 203)
  - **Verification:** `systemctl status homelab-health-check.service` shows ACTIVE (exited)
  - **Files:** `/srv/ops/scripts/homelab-health-check.sh`

- [ ] **TASK-3D:** Verify services survive Ubuntu reboot
  - **Verification:** After reboot, all homelab-* services ACTIVE
  - **Files:** ZFS snapshot `@pre-reboot-timestamp`

---

## Slice 4: Gemma4 Monitoring Integration

- [ ] **TASK-4A:** Enhance `/srv/ops/agents/scripts/llm_agent.sh`
  - **Verification:** Uses gemma4:latest, includes Rome Lab criteria
  - **Files:** `/srv/ops/agents/scripts/llm_agent.sh` (enhanced)

- [ ] **TASK-4B:** Configure Gemma4 analysis loop (15min timer)
  - **Verification:** `systemctl list-timers | grep gemma` shows active
  - **Files:** `/etc/systemd/system/homelab-gemma-monitor.timer`

- [ ] **TASK-4C:** Integrate Telegram alerting
  - **Verification:** Test Telegram message sends successfully
  - **Files:** `send_telegram()` calls in monitoring scripts

---

## Slice 5: Prepare Agents/Subagents/Tools

- [ ] **TASK-5A:** Create detective subagent directory structure
  - **Verification:** `ls /srv/ops/agents/scripts/detective/` shows all scripts
  - **Files:** `/srv/ops/agents/scripts/detective/` (new)

- [ ] **TASK-5B:** Create research tools (forum_search, repo_scan, stability_check)
  - **Verification:** Each tool produces expected JSON output
  - **Files:** `/srv/ops/agents/scripts/detective/*.sh` (new)

- [ ] **TASK-5C:** Prepare ai-context MCP sync for detective findings
  - **Verification:** Detective logs appear in memory/ after sync
  - **Files:** `/home/will/.claude/mcps/ai-context-sync/`

---

## Critical Files Reference

| File | Task | Purpose |
|------|------|---------|
| `/srv/ops/scripts/homelab-gemma-monitor.sh` | 3B | Gemma4 monitoring script |
| `/srv/ops/scripts/homelab-health-check.sh` | 3C | Health check script |
| `/etc/systemd/system/homelab-gemma-monitor.service` | 3B | Systemd service |
| `/etc/systemd/system/homelab-health-check.service` | 3C | Systemd service |
| `/home/will/Desktop/voice-pipeline/whisper_api.py` | 1B, 3A | Whisper API server |
| `/srv/ops/agents/scripts/llm_agent.sh` | 4A | LLM analysis agent |
| `/srv/ops/agents/scripts/detective_agent.sh` | 1A | Detective research agent |
| `/srv/ops/agents/scripts/audit_agent.sh` | 2A | Audit agent |

---

## Dependencies

```
TASK-1A → TASK-1B → TASK-1C
    │           │
    └───────────┴──► TASK-2A → TASK-2B → TASK-2C
                                        │
                    ┌───────────────────┘
                    ▼
                TASK-3A → TASK-3B → TASK-3C → TASK-3D
                                        │
                    ┌───────────────────┘
                    ▼
                TASK-4A → TASK-4B → TASK-4C
                                        │
                    ┌───────────────────┘
                    ▼
                TASK-5A → TASK-5B → TASK-5C
```

---

## Checkpoints

| Checkpoint | After | Criteria |
|-----------|-------|----------|
| CP-1 | Slice 1 | Detective agent finds voice-pipeline repo |
| CP-2 | Slice 2 | Audit report clean, no FAILED services |
| CP-3 | Slice 3 | All systemd services ACTIVE after reboot |
| CP-4 | Slice 4 | Gemma4 fires every 15min, sends Telegram |
| CP-5 | Slice 5 | All agents/subagents/tools ready |

---

**Last Updated:** 2026-04-07
