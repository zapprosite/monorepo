# DETECTIVE MODE — Homelab Research & Persistence Plan
**Host:** will-zappro
**Date:** 2026-04-07
**Goal:** Research stable datacenter-grade versions, prepare agents, find voice-pipeline repo, ensure persistence across reboots via Gemma4 monitoring

---

## Executive Summary

O homelab precisa de "detective mode" — um modo de investigação que:
1. Encontra repositórios similares ao `desktop voice-pipeline` instalados no homelab
2. Faz auditoria research usando MCPs de foruns (conforme Rome Lab stability criteria)
3. Prepara `/srv/ops/agents/` com subagentes e tools para operação autônoma
4. Cria systemd services persistentes que sobrevivem reboot Ubuntu
5. Integra tudo com Gemma4 8B via Ollama para monitoramento inteligente

**Problema atual:** `homelab-gemma-monitor.service` e `homelab-health-check.service` estão **FAILED** (EXEC error — scripts não encontrados ou não executáveis).

---

## Rome Lab Stability Criteria (Versão 2026-04-07)

Usado para julgar estabilidade de versões datacenter-grade:

| Critério | Descrição |
|---------|-----------|
| **Version Maturity** | GA/stable release? Tagsgit? Release notes? |
| **Known Issues (forums 04/07/2026)** | Issues abertos em fóruns, GitHub issues, Reddit homelab |
| **Crash Reports / Cycling** | exit codes 1/137/143, watchdog cycling, OOM kills |
| **Dependency Chain Robustness** | Deps纷纷 atualizados? Sem broken deps? |
| **Recovery After Reboot/Power Loss** | systemd restart policy, ZFS snapshots, healthcheck |

---

## Dependency Graph — Components

```
                    ┌─────────────────────────────┐
                    │   DETECTIVE MODE AGENT        │
                    │   (overseer_agent.sh)         │
                    └──────────────┬──────────────┘
                                   │
        ┌──────────────┬───────────┴───────────┬──────────────┐
        ▼              ▼                       ▼              ▼
┌──────────────┐ ┌──────────────┐    ┌──────────────┐ ┌──────────────┐
│ RESEARCHER    │ │ AUDITOR      │    │ SERVICE       │ │ MONITOR      │
│ AGENT        │ │ AGENT        │    │ MANAGER       │ │ AGENT        │
│ (MCP forum)  │ │ (audit.sh)   │    │ (systemd)    │ │ (Gemma4)     │
└──────┬───────┘ └──────┬───────┘    └──────┬───────┘ └──────┬───────┘
       │                │                   │                │
       ▼                ▼                   ▼                ▼
┌──────────────┐ ┌──────────────┐    ┌──────────────┐ ┌──────────────┐
│ context7     │ │ ZFS audit    │    │ whisper-api │ │ Ollama       │
│ MCP          │ │ Docker ps    │    │ :8201        │ │ gemma4       │
│ cloudflare   │ │ systemd      │    │ kokoro       │ │ monitoring   │
│ MCP          │ │ units        │    │ :8012        │ │              │
└──────────────┘ └──────────────┘    └──────────────┘ └──────────────┘
```

---

## Vertical Slices

### SLICE 1: Detective Research Agent
**Encontrar voice-pipeline repo e pesquisar via MCPs em foruns**

| Task | File | Status |
|------|------|--------|
| TASK-1A | `/srv/ops/agents/scripts/detective_agent.sh` | Create |
| TASK-1B | Research voice-pipeline similar repos in homelab | Research |
| TASK-1C | MCP forum research — search for stable versions as of 04/07/2026 | Research |

### SLICE 2: Audit Current State
**Auditar estado atual dos serviços e identificar gaps**

| Task | File | Status |
|------|------|--------|
| TASK-2A | `/srv/ops/agents/scripts/audit_agent.sh` | Create |
| TASK-2B | Audit failed systemd services (gemma-monitor, health-check) | Debug |
| TASK-2C | Document all voice-pipeline related services | Document |

### SLICE 3: Systemd Service Persistence
**Criar systemd services persistentes que sobrevivem reboot**

| Task | File | Status |
|------|------|--------|
| TASK-3A | `/etc/systemd/system/voice-pipeline-persist.service` | Create |
| TASK-3B | `/etc/systemd/system/homelab-gemma-monitor.service` fix | Fix |
| TASK-3C | `/etc/systemd/system/homelab-health-check.service` fix | Fix |
| TASK-3D | Verify services survive reboot | Verify |

### SLICE 4: Gemma4 Monitoring Integration
**Integrar com Gemma4 8B via Ollama para monitoramento inteligente**

| Task | File | Status |
|------|------|--------|
| TASK-4A | `/srv/ops/agents/scripts/llm_agent.sh` (enhanced) | Enhance |
| TASK-4B | Gemma4 analysis loop via systemd timer | Configure |
| TASK-4C | Telegram alerting on detection | Integrate |

### SLICE 5: Prepare Agents/Subagents/Tools
**Preparar infraestrutura de agentes completa**

| Task | File | Status |
|------|------|--------|
| TASK-5A | Create detective subagent directory structure | Create |
| TASK-5B | Create tools for research (forum search, repo scan) | Create |
| TASK-5C | Prepare ai-context MCP sync for detective findings | Prepare |

---

## Phase 1: Detective Research

### TASK-1A: Create Detective Agent Script

**File to create:** `/srv/ops/agents/scripts/detective_agent.sh`

**Responsibility:** Finds voice-pipeline-like repositories on homelab and researches stability via MCPs.

**Acceptance Criteria:**
- Finds `/home/will/Desktop/voice-pipeline` (confirmed via ls)
- Identifies all whisper-api instances (host :8201 + container)
- Identifies all Kokoro TTS instances (host :8012 + container)
- Outputs structured JSON with found components

**Verification:**
```bash
bash /srv/ops/agents/scripts/detective_agent.sh
# Expected: JSON with voice-pipeline components found
```

---

### TASK-1B: Research Voice-Pipeline Similar Repos

**Research targets:**
1. `/home/will/Desktop/voice-pipeline` — desktop voice dictation pipeline (F8/F9 hotkeys)
2. `/home/will/Desktop/voice-pipeline/scripts/openclaw-stt-watchdog.sh` — OpenClaw STT watchdog
3. `/srv/monorepo/docs/adr/20260404-voice-dev-pipeline.md` — ADR voice pipeline

**Rome Lab criteria check:**
- Version maturity: voice-pipeline is at tag v3.0 (2026-04-06)
- Known issues: None critical found in docs
- Crash reports: STT watchdog cycling issue documented
- Dependency chain: faster-whisper + Ollama gemma4 + xclip
- Recovery: systemd services for hotkeys (need fixing)

---

### TASK-1C: MCP Forum Research

**MCPs available:**
- `context7` — Documentação de libs em tempo real
- `cloudflare-api` — API Cloudflare (para DNS/tunnel research)
- `ai-context` — Sincronização de documentação

**Forum research via WebSearch:**
- Search "faster-whisper stable version 2026"
- Search "kokoro TTS onnx stable issues 2026"
- Search "faster-whisper crash cycling GPU 2026"
- Search "homelab STT whisper vs deepgram stability"

**Rome Lab criteria application:**
- Report versions with GA/stable tag
- Flag versions with known crashes or cycling
- Recommend dependency versions

---

## Phase 2: Audit Current State

### TASK-2A: Create Audit Agent Script

**File to create:** `/srv/ops/agents/scripts/audit_agent.sh`

**Responsibility:** Comprehensive audit of homelab state, focused on voice-pipeline and systemd services.

**Checks:**
1. Docker containers related to voice (whisper-api, kokoro, openclaw)
2. Systemd services status (failed vs active)
3. ZFS pool health (tank)
4. GPU VRAM availability
5. Network connectivity (cloudflared, DNS)

**Acceptance Criteria:**
- Produces audit report in Markdown
- Identifies all FAILED systemd services
- Checks voice-pipeline hotkey registrations
- Verifies whisper-api accessibility

**Verification:**
```bash
bash /srv/ops/agents/scripts/audit_agent.sh
# Check output in /srv/ops/agents/logs/audit/YYYY-MM-DD.log
```

---

### TASK-2B: Debug Failed Systemd Services

**Failed services identified:**
1. `homelab-gemma-monitor.service` — FAILED (EXEC error, exit-code 1)
2. `homelab-health-check.service` — FAILED (EXEC error, exit-code 203)

**Root causes to investigate:**
- Script file missing at expected path `/srv/ops/scripts/homelab-gemma-monitor.sh`
- Script not executable (`chmod +x`)
- Wrong interpreter shebang (`#!/bin/bash` vs `#!/usr/bin/env bash`)
- Missing env variables (`/home/will/aurelia/.env` not found)

**Debug commands:**
```bash
# Check service definition
systemctl cat homelab-gemma-monitor.service

# Check script exists and is executable
ls -la /srv/ops/scripts/homelab-gemma-monitor.sh
file /srv/ops/scripts/homelab-gemma-monitor.sh

# Check journal for detailed error
journalctl -u homelab-gemma-monitor.service -n 50
journalctl -u homelab-health-check.service -n 50
```

---

### TASK-2C: Document Voice-Pipeline Services

**Services to document:**
1. `whisper-local.service` — Docker container (port 8020)
2. `zappro-voice-gateway.service` — Python voice gateway (aurelia)
3. `homelab-gemma-monitor.service` — Gemma4 monitoring
4. `homelab-health-check.service` — Health check cron
5. `homelab-gemma-monitor.timer` — 15min timer
6. `homelab-health-check.timer` — 15min timer

**Output file:** `/srv/monorepo/docs/INFRASTRUCTURE/VOICE_SERVICES.md`

---

## Phase 3: Systemd Service Persistence

### TASK-3A: Create Voice-Pipeline Persistence Service

**File to create:** `/etc/systemd/system/voice-pipeline-persist.service`

**Purpose:** Ensures voice-pipeline components start on boot and stay running.

**Components to persist:**
1. Whisper API on host (python3 `/home/will/Desktop/voice-pipeline/whisper_api.py`)
2. Hotkey services (jarvis-hotkey, voice-hotkey via systemd user)
3. STT watchdog cron

**Service template:**
```ini
[Unit]
Description=Voice Pipeline Persistence — Whisper + Hotkeys
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/home/will/Desktop/voice-pipeline/scripts/start-whisper-api.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

**Verification:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable voice-pipeline-persist.service
sudo systemctl start voice-pipeline-persist.service
# Reboot and verify whisper-api :8201 is up
```

---

### TASK-3B: Fix homelab-gemma-monitor.service

**Current issue:** Script exits with code 1 (EXEC error)

**Fix steps:**
1. Verify script exists at `/srv/ops/scripts/homelab-gemma-monitor.sh`
2. Make executable: `chmod +x /srv/ops/scripts/homelab-gemma-monitor.sh`
3. Add shebang check: `head -1 /srv/ops/scripts/homelab-gemma-monitor.sh`
4. Fix env loading: verify `/home/will/aurelia/.env` exists
5. Test manually: `bash /srv/ops/scripts/homelab-gemma-monitor.sh`

**Verification:**
```bash
systemctl status homelab-gemma-monitor.service
journalctl -u homelab-gemma-monitor.service -n 10
```

---

### TASK-3C: Fix homelab-health-check.service

**Current issue:** Script exits with code 203 (EXEC — execution failed)

**Likely cause:** Script path issue or missing interpreter

**Fix steps:**
1. Verify script at `/srv/ops/scripts/homelab-health-check.sh` exists
2. Make executable
3. Check shebang
4. Verify all referenced paths exist
5. Test manually

**Verification:**
```bash
systemctl status homelab-health-check.service
journalctl -u homelab-health-check.service -n 10
```

---

### TASK-3D: Verify Services Survive Reboot

**Test procedure:**
1. Create ZFS snapshot before reboot: `sudo zfs snapshot -r tank@pre-reboot-$(date +%Y%m%d%H%M%S)`
2. Schedule reboot via `sudo systemctl reboot`
3. After reboot, verify:
   - `systemctl status homelab-gemma-monitor.service` — active (running)
   - `systemctl status homelab-health-check.service` — active (running)
   - `curl -s http://localhost:8201/health` — whisper-api up
   - `curl -s http://localhost:8012/health` — kokoro up

**Verification:**
```bash
# Before reboot
sudo zfs snapshot -r tank@pre-reboot-$(date +%Y%m%d%H%M%S)

# After reboot
systemctl list-units --type=service | grep homelab
curl -s http://localhost:8201/health
docker ps --format '{{.Names}}:{{.Status}}' | grep -E 'whisper|kokoro|openclaw'
```

---

## Phase 4: Gemma4 Monitoring Integration

### TASK-4A: Enhance LLM Agent

**File to enhance:** `/srv/ops/agents/scripts/llm_agent.sh`

**Enhancements:**
1. Add Rome Lab stability criteria as system prompt
2. Add voice-pipeline detection to LLM context
3. Add "detective mode" system prompt for research tasks
4. Integrate with Telegram for alert escalation

**Acceptance Criteria:**
- Uses gemma4:latest via Ollama (not qwen3.5)
- Includes Rome Lab criteria in prompt template
- Sends Telegram alerts on CRITICAL detections
- Produces structured JSON output

**Verification:**
```bash
bash /srv/ops/agents/scripts/llm_agent.sh diagnose "voice pipeline stability"
# Expected: JSON with stability assessment
```

---

### TASK-4B: Configure Gemma4 Analysis Loop

**Current timer:** `homelab-gemma-monitor.timer` — every 15 minutes

**Loop behavior:**
1. Timer fires every 15 minutes
2. Service runs `homelab-gemma-monitor.sh`
3. Script collects homelab state (GPU, containers, ZFS)
4. If issues found → calls Gemma4 via Ollama
5. If Gemma4 finds CRITICAL → sends Telegram alert
6. If all OK → logs silently (no alert)

**Verification:**
```bash
systemctl status homelab-gemma-monitor.timer
systemctl list-timers | grep gemma
```

---

### TASK-4C: Integrate Telegram Alerting

**Current state:** Telegram alerting exists but not working (EXEC error prevents alerts)

**Integration points:**
1. `homelab-gemma-monitor.sh` — send_telegram() function
2. `homelab-health-check.sh` — send_telegram() function
3. `llm_agent.sh` — CRITICAL escalation

**Required env vars:**
- `TELEGRAM_BOT_TOKEN` — from `/home/will/aurelia/.env`
- `TELEGRAM_ALLOWED_USER_IDS` — Will's Telegram ID

**Verification:**
```bash
# Test Telegram directly
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_ALLOWED_USER_IDS}" \
  -d "text=Detective Mode activated — test alert"
```

---

## Phase 5: Prepare Agents/Subagents/Tools

### TASK-5A: Create Detective Subagent Directory

**Directory structure:**
```
/srv/ops/agents/
├── scripts/
│   └── detective/
│       ├── forum_search.sh      # MCP forum research
│       ├── repo_scan.sh         # Scan for voice-pipeline repos
│       ├── stability_check.sh   # Rome Lab criteria check
│       └── report.sh            # Generate detective report
├── prompts/
│   └── detective/
│       └── system_prompt.txt    # Detective mode instructions
├── config/
│   └── detective/
│       └── thresholds.yaml     # Stability thresholds
└── logs/
    └── detective/
        └── YYYY-MM-DD.json     # Detective findings
```

**Acceptance Criteria:**
- All scripts executable
- All directories exist with correct permissions
- Log rotation configured

---

### TASK-5B: Create Research Tools

**Tool 1: forum_search.sh**
```bash
# Searches for stable version info via WebSearch MCP
# Usage: ./forum_search.sh <component>
# Output: JSON with version recommendations
```

**Tool 2: repo_scan.sh**
```bash
# Scans homelab for voice-pipeline-like repos
# Usage: ./repo_scan.sh
# Output: JSON array of found repos
```

**Tool 3: stability_check.sh**
```bash
# Applies Rome Lab criteria to check stability
# Usage: ./stability_check.sh <component> <version>
# Output: JSON with stability score
```

**Acceptance Criteria:**
- forum_search.sh returns results from WebSearch
- repo_scan.sh finds `/home/will/Desktop/voice-pipeline`
- stability_check.sh produces score 0-100

---

### TASK-5C: Prepare AI-CONTEXT MCP Sync

**Current:** `ai-context` MCP syncs docs to memory

**Enhancement:** Add detective findings to sync:
```
/srv/ops/agents/logs/detective/*.json → memory/detective/
```

**Verification:**
```bash
# Trigger manual sync
/home/will/.claude/mcps/ai-context-sync/sync.sh

# Verify detective findings in memory
ls -la ~/.claude/projects/-srv-monorepo/memory/detective/
```

---

## Critical Files for Implementation

| File | Phase | Purpose |
|------|-------|---------|
| `/srv/ops/scripts/homelab-gemma-monitor.sh` | 3B | Gemma4 monitoring (needs fix) |
| `/srv/ops/scripts/homelab-health-check.sh` | 3C | Health check (needs fix) |
| `/etc/systemd/system/homelab-gemma-monitor.service` | 3B | Systemd service definition |
| `/home/will/Desktop/voice-pipeline/whisper_api.py` | 1B, 3A | Whisper API server |
| `/srv/ops/agents/scripts/llm_agent.sh` | 4A | LLM analysis agent |

---

## Checkpoints

1. **Checkpoint 1 (After Slice 1):** Detective agent can find voice-pipeline repo
2. **Checkpoint 2 (After Slice 2):** Audit agent produces clean report
3. **Checkpoint 3 (After Slice 3):** All systemd services FAILED → ACTIVE
4. **Checkpoint 4 (After Slice 4):** Gemma4 monitoring fires and produces analysis
5. **Checkpoint 5 (After Slice 5):** All agents/subagents/tools ready

---

## Dependencies

```
Slice 1 (Research) ─────────────────────────────────► No deps
                                                             │
Slice 2 (Audit) ◄────────────────────────────────────────────┘
       │                                                       
       ▼                                                       
Slice 3 (Systemd) ──────────────────────────────► Slice 2 must complete first
       │                                        │
       ▼                                        ▼
Slice 4 (Gemma4) ◄───────────────────────────► Slice 3 must have services ACTIVE
       │                                        │
       ▼                                        ▼
Slice 5 (Agents) ◄─────────────────────────────► All previous slices
```

---

**Last Updated:** 2026-04-07
**Author:** Claude Code (Planning session)
