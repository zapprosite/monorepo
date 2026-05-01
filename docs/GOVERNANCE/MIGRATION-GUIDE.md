# CLI Migration Guide

**Source:** CLI research + compatibility matrix  
**Date:** 2026-04-30  
**Status:** Complete

---

## Overview

Guide for migrating between Claude Code, Codex CLI, and OpenCode CLI. Covers key differences, script adaptation, worker reconfiguration, and quick checklist.

---

## 1. Key Differences

### CLI Feature Comparison

| Feature | Claude Code | Codex CLI | OpenCode |
|---------|:-----------:|:---------:|:--------:|
| Parallel workers | **Full** (15 via VIBE_PARALLEL) | **None** | **None** |
| Queue operations | **Full** (state-manager.py) | **None** | **None** |
| Rate limiting | **None** (VIBE_POLL_INTERVAL) | **None** | **None** |
| Context reset | **Partial** (ZFS snapshots) | **Partial** (`--ephemeral`) | **Partial** |
| Notification on complete | **Full** (event-emit.sh) | **None** | **None** |
| Deploy integration | **Full** (/turbo, /ship) | **Partial** (codex apply) | **Partial** |
| Graceful shutdown | **Full** (VIBE_IDLE_COOLDOWN) | **Partial** | **Partial** |

### Command Mapping

| Claude Code | Codex CLI | OpenCode |
|-------------|-----------|----------|
| `/execute` (14 agents) | `codex exec --full-auto` | `opencode exec --full-auto` |
| `/review` | `codex review` | `opencode review` |
| `/spec` | Manual SPEC drafting | Manual SPEC drafting |
| `/plan` | Manual task breakdown | Manual task breakdown |
| `/turbo` | `codex cloud diff` | `opencode cloud diff` |
| `/ship` | Manual PR creation | Manual PR creation |
| `mclaude -p` (parallel workers) | Single task only | Single task only |

### Config File Format

| CLI | Config Location | Format |
|-----|-----------------|--------|
| Claude Code | `~/.claude/settings.json` | JSON |
| Codex CLI | `~/.codex/config.toml` | TOML |
| OpenCode | `~/.opencode/config.toml` | TOML |

---

## 2. Script Adaptation

### Environment Variables

```bash
# Claude Code
export ANTHROPIC_API_KEY=sk-...

# Codex CLI
export OPENAI_API_KEY=sk-...

# OpenCode
export OPENAI_API_KEY=sk-...  # Same as Codex
```

### Config Translation

**Claude Code (`~/.claude/settings.json`):**
```json
{
  "permissions": {
    "allow": ["Bash(*)", "Read(**)"],
    "deny": ["Read(*.env*)"]
  },
  "mcpServers": {
    "context7": { "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" } }
  }
}
```

**Codex CLI (`~/.codex/config.toml`):**
```toml
codex_hooks = true

[mcp_servers.context7]
command = "sh"
args = ["-lc", "set -a; [ -f /srv/monorepo/.env ] && . /srv/monorepo/.env; set +a; exec npx -y @upstash/context7-mcp@latest"]
```

### Hook System Translation

**Claude Code (PostToolUse via settings.json):**
```json
"PostToolUse": [
  { "matcher": "*", "hooks": [{ "type": "command", "command": "~/.claude/hooks/PostToolUse-event-emit.bash" }] }
]
```

**Codex CLI (`~/.codex/hooks.json`):**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [{ "type": "command", "command": "EVENT_DIR=/home/will/.claude/events bash /home/will/.claude/events/event-emit.sh tool=${tool_name}" }]
      }
    ]
  }
}
```

### Worker Spawn Patterns

**Claude Code (Nexus parallel workers):**
```bash
# vibe-kit.sh spawns mclaude workers
VIBE_PARALLEL=15 mclaude -p --pending等我

# Execute command (14 agents)
claude --dangerously-enable-all-developer-shortcuts /execute
```

**Codex CLI (single task):**
```bash
# No parallel execution
codex exec --full-auto "Your task prompt"

# Review mode
codex review --uncommitted
```

### Queue Management

**Claude Code (state-manager.py):**
```bash
# Add to queue
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py event QUEUE_CHANGE key=value

# Get events
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py get events QUEUE_CHANGE
```

**Codex/OpenCode:**
No native queue system. External orchestration required.

---

## 3. Worker Reconfiguration

### From Claude Code to Codex/OpenCode

**Before (Claude Code + Nexus):**
```bash
# nexus.sh --mode debug
# vibe-kit.sh with VIBE_PARALLEL=15

# 49-agent orchestration (7 modes x 7 agents)
# Queue-driven via state-manager.py
# ZFS snapshots every VIBE_SNAPSHOT_EVERY=3 tasks
```

**After (Codex/OpenCode single-task):**
```bash
# Single task execution
codex exec --full-auto "Task description"

# For parallel: external orchestrator needed
# Example: GNU parallel + codex exec
parallel "codex exec --full-auto {}" ::: task_list.txt

# Review: codex review --uncommitted
```

### Config Translation Checklist

- [ ] Convert `~/.claude/settings.json` (JSON) → `~/.codex/config.toml` (TOML)
- [ ] Translate permissions `allow/deny` → sandbox modes (`read-only`, `workspace-write`, `danger-full-access`)
- [ ] Migrate MCP server configs from `mcpServers` (JSON) → `[mcp_servers]` (TOML)
- [ ] Convert hooks from JSON format → `~/.codex/hooks.json`
- [ ] Update API key env var: `ANTHROPIC_API_KEY` → `OPENAI_API_KEY`
- [ ] Replace Nexus/vibe-kit parallel workers with external parallelization (GNU parallel, xargs)

### Sandbox Mode Mapping

| Claude Code Permission | Codex Sandbox |
|------------------------|---------------|
| `Read(**)` | `read-only` |
| `Bash(*)` with deny rules | `workspace-write` |
| `BypassPermissions: false` | `untrusted` approval policy |
| `BypassPermissions: true` | `danger-full-access` |

---

## 4. Quick Migration Checklist

### Claude Code → Codex CLI

```
PRE-MIGRATION
□ Export current config: cp ~/.claude/settings.json ~/settings-backup.json
□ Document VIBE_PARALLEL workers count (default: 15)
□ Note VIBE_WATCH_MODE and VIBE_IDLE_COOLDOWN settings
□ List all custom hooks in use

CONFIGURATION
□ Install Codex: npm install -g @openai/codex
□ Create ~/.codex/config.toml from scratch or translate
□ Set OPENAI_API_KEY instead of ANTHROPIC_API_KEY
□ Configure MCP servers in TOML format
□ Set up hooks.json for event emission

SCRIPTS
□ Replace mclaude calls with codex exec
□ Replace /execute (14 agents) with sequential codex exec calls
□ Replace Nexus queue (state-manager.py) with external queue system
□ Replace VIBE_SNAPSHOT_EVERY with manual ZFS snapshots
□ Update notification scripts (event-emit.sh → hooks.json PostToolUse)

WORKERS
□ Replace VIBE_PARALLEL=15 with GNU parallel or similar
□ Replace vibe-kit.sh infinite loop with while + codex exec
□ Replace inotifywait-driven wake-up with cron polling
□ Update VIBE_IDLE_COOLDOWN shutdown logic

VALIDATION
□ Test codex exec --full-auto "echo test"
□ Verify codex review --uncommitted works
□ Confirm MCP servers connect: codex mcp list
□ Test hooks fire: check event-emit.sh triggers
□ Validate sandbox mode: codex exec -s read-only "ls /"
```

### Claude Code → OpenCode

```
PRE-MIGRATION
□ Same as Codex (config backup, env var documentation)

CONFIGURATION
□ Install OpenCode per official docs
□ Create ~/.opencode/config.toml
□ Set OPENAI_API_KEY
□ Configure MCP servers in TOML format

SCRIPTS
□ Replace mclaude calls with opencode exec
□ Same script adaptation as Codex

WORKERS
□ Same worker reconfiguration as Codex
□ GNU parallel for parallelization
```

### Codex → Claude Code (Reverse)

```
PRE-MIGRATION
□ Export Codex config: cp ~/.codex/config.toml ~/codex-config-backup.toml
□ Document sandbox_mode and approvals_reviewer settings

CONFIGURATION
□ Reconfigure Claude Code via claude --configure
□ Create ~/.claude/settings.json
□ Set ANTHROPIC_API_KEY instead of OPENAI_API_KEY
□ Configure MCP servers in JSON format
□ Set up PreToolUse/PostToolUse hooks

SCRIPTS
□ Replace codex exec calls with mclaude or claude
□ Replace codex review with /review
□ Add /execute for parallel multi-agent tasks
□ Implement Nexus queue (state-manager.py + vibe-kit.sh)

WORKERS
□ Enable VIBE_PARALLEL=15 for parallel workers
□ Enable VIBE_WATCH_MODE for inotifywait-driven wake-up
□ Configure VIBE_IDLE_COOLDOWN for auto-shutdown
□ Set VIBE_SNAPSHOT_EVERY for ZFS snapshots

VALIDATION
□ Test claude --dangerously-enable-all-developer-shortcuts /execute
□ Verify /review works
□ Confirm MCP servers: claude mcp list
□ Test hooks: check PostToolUse-event-emit.bash fires
□ Validate permissions: claude permission allow Bash(*)
```

---

## 5. Known Limitations When Migrating

### From Claude Code to Codex/OpenCode

| Capability | Will Be Lost | Workaround |
|------------|--------------|------------|
| 14-agent parallel execution | Yes | Sequential exec or external orchestrator |
| Nexus 49-agent framework | Yes | Manual task distribution |
| Queue-driven autonomous pipeline | Yes | Custom queue + cron polling |
| ZFS snapshot per task | Yes | Manual `zfs snapshot` before tasks |
| inotifywait wake-up | Yes | Poll with sleep intervals |
| Auto notification on complete | Yes | External notification script |

### From Codex/OpenCode to Claude Code

| Capability | Gained | Notes |
|------------|--------|-------|
| Parallel workers | Yes (15 via VIBE_PARALLEL) | Requires Nexus/vibe-kit setup |
| Queue operations | Yes (state-manager.py) | Requires state-manager.py setup |
| Deploy integration | Yes (/turbo, /ship) | Requires Gitea credentials |
| ZFS snapshots | Yes | Requires ZFS setup |

---

## 6. Reference Files

| File | Purpose |
|------|---------|
| [Claude Code Research](./CLAUDE-CODE-RESEARCH.md) | Full Claude Code CLI documentation |
| [Codex CLI Research](./CODEX-RESEARCH.md) | Full Codex CLI documentation |
| [CLI Compatibility Matrix](./CLI-COMPATIBILITY-MATRIX.md) | Feature comparison table |
| `/srv/monorepo/AGENTS.md` | Nexus framework documentation |

---

## 7. Quick Reference Cards

### Claude Code Essential Commands
```bash
claude --dangerously-enable-all-developer-shortcuts /execute   # 14-agent parallel
mclaude -p --pending                                              # Parallel workers
claude /review                                                   # Code review
claude /spec                                                     # Spec-driven dev
claude /ship                                                     # Deploy prep
```

### Codex CLI Essential Commands
```bash
codex exec --full-auto "task"           # Non-interactive exec
codex review --uncommitted              # Code review
codex mcp list                          # List MCP servers
codex apply                             # Apply agent diff
codex sandbox -s danger-full-access     # Run in sandbox
```

### OpenCode Essential Commands
```bash
opencode exec --full-auto "task"        # Non-interactive exec
opencode review --uncommitted           # Code review
opencode mcp list                      # List MCP servers
opencode sandbox -s danger-full-access # Run in sandbox
```