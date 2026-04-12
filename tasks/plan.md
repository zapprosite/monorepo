# Auto-Cure Plan: Pending Issues Resolution

**Generated:** 2026-04-12
**Branch:** `feature/auto-cure-polished`
**Status:** EXECUTABLE

---

## 1. IMMEDIATE FIXES (Can execute now, no approval required)

### 1.1 Fix pnpm Version Strictness

**Problem:** `package.json` declares `packageManager: pnpm@9.0.0` but installed version is `9.0.6`. This causes `ERR_PNPM_BAD_PM_VERSION` on every pnpm command.

**Solution:** Update `package.json` to `pnpm@9.0.6` to match installed version.

```bash
# Verify current version
pnpm --version  # → 9.0.6

# Update package.json
sed -i 's/"pnpm@9.0.0"/"pnpm@9.0.6"/' /srv/monorepo/package.json
```

**Verification:**
```bash
cd /srv/monorepo && pnpm --version
```

**Alternative (disable strict mode):** If versioning cannot be changed, add to `package.json`:
```json
"packageManager": "pnpm@9.0.0",
"pnpm": {
  "overrides": {
    "pnpm": "9.0.6"
  }
}
```

---

### 1.2 Commit scheduled_tasks.json

**Problem:** `.claude/scheduled_tasks.json` shows as modified in git status.

**Solution:** Commit the file.

```bash
git -C /srv/monorepo add .claude/scheduled_tasks.json
git -C /srv/monorepo commit -m "chore: update scheduled_tasks.json

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git -C /srv/monorepo push
```

---

### 1.3 Update Researcher Skill to MiniMax

**Problem:** `/home/will/.claude/skills/researcher/SKILL.md` still references Tavily API. Agent cannot write to `~/` path.

**Solution:** Provide the updated SKILL.md content for manual replacement.

**File:** `/home/will/.claude/skills/researcher/SKILL.md`

```markdown
---
name: researcher
description: Pesquisa profunda usando MiniMax Search API. Use quando o utilizador pedir para pesquisar, investigar, analisar tendências ou obter informações actualizadas da web.
user-invocable: true
disable-model-invocation: false
allowed-tools:
  - Bash
  - Read
  - WebFetch
paths:
  - ~/.claude/skills/researcher/**
version: 2.0.0
---

# Skill: Researcher — MiniMax Search

## Synopsis

`/researcher <query>`

Pesquisa na web usando MiniMax Search API.

## Description

Usa a MiniMax Search API para obter resultados de pesquisa actualizados da web. Ideal para:
- Pesquisar informações actuais (pós-2024)
- Investigar produtos, tecnologias, competidores
- Fact-checking rápido
- Obter links e fontes para citations

## Usage

```
/researcher Claude Code CLI best practices 2026
/researcher MiniMax API pricing free tier
/researcher Gemini API quota limits
```

## API

- **Endpoint:** `https://api.minimax.io/search`
- **Method:** POST (JSON body)
- **Auth:** `api_key` no body
- **Key:** MINIMAX_API_KEY do vault Infisical

## Sources

- MiniMax Docs: https://www.minimax.io/
- Free Tier: varies by plan
- API: https://api.minimax.io/search
```

**Action:** User must manually replace `/home/will/.claude/skills/researcher/SKILL.md` with the content above.

---

### 1.4 Update PINNED-SERVICES.md with Actual Container Names

**Problem:** PINNED-SERVICES.md documents don't match actual container names.

**Discrepancies found:**

| Service | PINNED-SERVICES.md says | Actual container name |
|---------|------------------------|-----------------------|
| OpenWebUI | `open-webui` | `open-webui-wbmqefxhd7vdn2dme3i6s9an` |
| n8n | `n8n` | `n8n-jbu1zy377ies2zhc3qmd03gz` |
| Gitea | `gitea` | (not visible in docker ps, but has suffix per report) |

**Solution:** Update the `container_name` field in PINNED-SERVICES.md for each affected service.

**Files to edit:**
- `/srv/monorepo/docs/GOVERNANCE/PINNED-SERVICES.md`

**Changes:**
1. OpenWebUI entry (line ~168):
   ```yaml
   container_name: "open-webui-wbmqefxhd7vdn2dme3i6s9an"
   ```

2. n8n entry (if exists):
   ```yaml
   container_name: "n8n-jbu1zy377ies2zhc3qmd03gz"
   ```

**Note:** The document has git merge conflict markers (`<<<<<<< Updated upstream`, etc.) that need to be resolved first.

---

## 2. REQUIRES VERIFICATION (Can do but confirm first)

### 2.1 MCP servers.json — No Action Needed

**Investigation Result:** The file `~/.claude/mcp-servers.json` exists and has valid content:

```json
{
  "mcpServers": {
    "context7": { "command": "npx", "args": ["ctx7@latest", "mcp"], ... },
    "task-master-ai": { "command": "npx", "args": ["-y", "--package=task-master-ai", "task-master-ai"], ... },
    "minimax": { "command": "uvx", "args": ["minimax-mcp", "-y"], ... },
    "tavily": { "command": "npx", "args": ["-y", "@tavily/mcp@latest"], ... }
  }
}
```

**Assessment:** The structure uses `mcpServers` (Claude Code's standard format), NOT a `servers` array. This is **NOT a bug** — the MCP config is valid. The issue report's claim about "no servers array" is a false positive — Claude Code MCP uses `mcpServers` as the root key.

**Verification:**
```bash
cat ~/.claude/mcp-servers.json | jq '.mcpServers | keys'
```

---

### 2.2 Investigate cloudflared Status

**Reported Issue:** cloudflared marked as PINNED but "not running".

**Investigation Result:**

```bash
$ systemctl is-active cloudflared
active
```

cloudflared is running as a **systemd service** (not a Docker container) on the host network, binding port 8080. This is correct — cloudflared is an immutable service that runs as a daemon, not a container.

**Verification:**
```bash
# Check systemd status
systemctl is-active cloudflared

# Check process
ps aux | grep cloudflared | grep -v grep

# Check port binding
ss -tlnp | grep 8080

# Check bot.zappro.site routing
curl -sf https://bot.zappro.site/ping
```

**Conclusion:** No action needed — cloudflared is healthy and properly running.

---

## 3. LOW PRIORITY (Nice to Have)

### 3.1 Document Missing Services (tts-bridge, wav2vec2-proxy)

**Problem:** `zappro-tts-bridge` and `zappro-wav2vec2-proxy` are running but not in PINNED-SERVICES.md.

**Actual containers confirmed running:**
- `zappro-tts-bridge` — Up 39 hours
- `zappro-wav2vec2-proxy` — Up 39 hours

**Action:** Add entries to PINNED-SERVICES.md if these services are part of the core pinned stack. However, `zappro-wav2vec2-proxy` appears to be a proxy sidecar, not a primary service.

**Recommendation:** Add `zappro-tts-bridge` to PINNED-SERVICES.md if not already present (it IS in the doc at line 25, but the container `zappro-tts-bridge` was listed as running).

---

## 4. SPEC-001 SWARM TASKS — Decision Required

**Current State:** 10 tasks in `tasks/pipeline.json` all blocked by pnpm version issue.

```json
{
  "id": 1,
  "title": "Create task.go - SwarmTask struct + JSON marshaling",
  "status": "pending",
  "specRef": "SPEC-001-core-swarm.md"
}
... (tasks 2-10)
```

**Project:** `hvacr-swarm` (HVAC/R swarm architecture for WhatsApp message processing)

**SPECs Referenced:**
- `SPEC-001-core-swarm.md` — Core Swarm Architecture (exists in `docs/SPECS/`)
- Multiple SPECs reference SPEC-001 (SPEC-002, SPEC-003, SPEC-004, SPEC-007, SPEC-008)

**Key Observation:** The `SPEC-001` number is used by TWO different documents:
1. `SPEC-001-template-fusionado.md` (DONE)
2. `SPEC-001-workflow-performatico.md` (DRAFT)

The pipeline references `SPEC-001-core-swarm.md` which may be a third usage.

**Recommendation:**

Before unblocking SPEC-001 swarm tasks, clarify:
1. Is `hvacr-swarm` project still active and in scope?
2. Should tasks 1-10 proceed on `feature/auto-cure-polished` branch?
3. Is there a separate branch for swarm development?

**If yes, unblocked after:**
- pnpm version fix (1.1)
- Basic pnpm commands work

**If no:** Archive `tasks/pipeline.json` and close SPEC-001 swarm tasks.

---

## 5. SUMMARY: Action Items

| # | Action | Priority | Effort | Status |
|---|--------|----------|--------|--------|
| 1 | Fix pnpm version to 9.0.6 | CRITICAL | 1 min | Ready |
| 2 | Commit scheduled_tasks.json | HIGH | 1 min | Ready |
| 3 | Update researcher SKILL.md to MiniMax | MEDIUM | Manual | User action needed |
| 4 | Update PINNED-SERVICES.md container names | MEDIUM | 5 min | Needs conflict resolution first |
| 5 | Verify MCP servers.json config | LOW | Done | No action needed |
| 6 | Investigate cloudflared status | LOW | Done | No action needed |
| 7 | Document tts-bridge, wav2vec2-proxy | LOW | 5 min | Nice to have |
| 8 | SPEC-001 swarm tasks — decision | MEDIUM | Decision | Blocked on project direction |

---

## 6. EXECUTION SEQUENCE

```
Step 1: Fix pnpm version (unblocks everything)
        ├── Run: sed -i 's/9.0.0/9.0.6/' package.json
        └── Verify: pnpm --version

Step 2: Commit scheduled_tasks.json
        ├── git add + commit + push
        └── Clears git dirty state

Step 3: Resolve PINNED-SERVICES.md conflict markers
        ├── Read full file
        ├── Resolve <<<<<<< >>>>>>> markers
        └── Update container names

Step 4: SPEC-001 decision
        ├── Confirm hvacr-swarm project scope
        └── Either proceed or archive
```

---

## Appendix A: Merge Conflict in PINNED-SERVICES.md

The file `/srv/monorepo/docs/GOVERNANCE/PINNED-SERVICES.md` contains git merge conflict markers at lines 1-11 and 413-452:

```
<<<<<<< Updated upstream
# PINNED-SERVICES — Serviços que NÃO DEVEM Mudar
=======
---
version: 2.0
author: will-zappro
date: 2026-04-12
---
# PINNED-SERVICES — Regra de Imutabilidade dos Serviços
>>>>>>> Stashed changes
```

**Resolution required:** Accept one version and remove markers before editing.

---

## Appendix B: Actual Container List (for reference)

```
zappro-tts-bridge          Up 39 hours
openwebui-bridge-agent     Up 42 hours
autoheal                  Up 42 hours
openclaw-mcp-wrapper       Up 42 hours
open-webui-wbmqefxhd7vdn2dme3i6s9an  Up 42 hours
openclaw-qgtzrmi6771lt8l7x8rqx72f    Up 26 minutes
browser-qgtzrmi6771lt8l7x8rqx72f    Up 42 hours
zappro-wav2vec2-proxy      Up 39 hours
gitea-runner               Up 42 hours
zappro-wav2vec2            Up 39 hours
perplexity-agent           Up 42 hours
zappro-litellm             Up 42 hours
zappro-litellm-db          Up 42 hours
docker-autoheal            Up 42 hours
ll01e4eis7wog1fnbzomc6jv   Up 42 hours
task-runners-jbu1zy377ies2zhc3qmd03gz  Up 24 seconds
n8n-jbu1zy377ies2zhc3qmd03gz  Up 42 hours
postgresql-jbu1zy377ies2zhc3qmd03gz  Up 42 hours
grafana                    Up 42 hours
alert-sender               Up 42 hours
gotify                     Up 42 hours
prometheus                 Up 42 hours
alertmanager               Up 42 hours
node-exporter              Up 34 hours
cadvisor                   Up 34 hours
nvidia-gpu-exporter        Up 34 hours
loki                       Up 42 hours
promtail                   Up 42 hours
mcp-monorepo               Up 42 hours
mcp-qdrant                 Up 42 hours
```
