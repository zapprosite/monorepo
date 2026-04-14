---
name: ADR-045-hermes-claude-code-integration
description: Hermes-Agent integration with Claude Code CLI — subprocess and MCP bridge patterns
status: PROPOSED
priority: high
author: Principal Engineer
date: 2026-04-14
specRef: SPEC-038
---

# ADR-045: Hermes-Agent Integration with Claude Code CLI

## Context

Hermes-Agent serves as the "Relogio Mestre" (master clock) for the homelab. The question is whether Hermes can leverage Claude Code CLI as a sub-agent or tool, either by:

1. Invoking Claude Code as a subprocess (tool pattern)
2. Connecting to Claude Code's MCP server (MCP bridge pattern)

## Findings

### 1. Claude Code CLI Modes

| Mode            | Command                       | Description                     |
| --------------- | ----------------------------- | ------------------------------- |
| Interactive     | `claude`                      | Default REPL mode               |
| Non-interactive | `claude -p "prompt"`          | Print response and exit         |
| MCP server      | `claude mcp serve`            | Exposes MCP server on port 3100 |
| MCP client      | `claude mcp add <name> <cmd>` | Connect to external MCP servers |

**Non-interactive mode with JSON output:**

```bash
claude -p "Say hello" --output-format json --bare
```

Returns structured JSON with `result`, `session_id`, `usage`, etc.

### 2. Hermes-Agent Integration Points

| Hermes Feature                  | Can Invoke Claude Code? | Method                                        |
| ------------------------------- | ----------------------- | --------------------------------------------- |
| Bash tool (built-in)            | YES                     | `claude -p "..." --output-format json --bare` |
| Custom skill (command)          | YES                     | Bash script wrapping `claude -p`              |
| Custom skill (python_wrapper)   | YES                     | Python subprocess wrapper                     |
| MCP server (`hermes mcp serve`) | YES                     | Expose Hermes as MCP server                   |
| MCP client (`hermes mcp add`)   | YES                     | Connect to Claude Code's MCP server           |

### 3. Approach A: Subprocess Pattern (SIMPLEST — WORKS TODAY)

Hermes skill that invokes Claude Code via Bash:

```bash
#!/bin/bash
# hermes-claude-invoke.sh
# Usage: hermes-claude-invoke.sh "prompt text" [session_id]
PROMPT="$1"
SESSION="${2:-}"
OUTPUT_FORMAT="json"
EXTRA_FLAGS="--bare --dangerously-skip-permissions"

if [ -n "$SESSION" ]; then
  claude -p "$PROMPT" \
    --output-format "$OUTPUT_FORMAT" \
    --no-session-persistence \
    $EXTRA_FLAGS \
    --session-id "$SESSION"
else
  claude -p "$PROMPT" \
    --output-format "$OUTPUT_FORMAT" \
    --no-session-persistence \
    $EXTRA_FLAGS
fi
```

**Integration in hermes.json:**

```json
{
  "name": "claude_code",
  "description": "Invoke Claude Code CLI as a sub-agent for code tasks",
  "command": "/path/to/hermes-claude-invoke.sh",
  "allowed-tools": ["Bash"]
}
```

**Hermes skill invocation:**

```
/hermes invoke claude_code "Review the API router for security issues"
```

**Limitations:**

- No tool passthrough (Claude Code tools not available to Hermes)
- Authentication still required (ANTHROPIC_API_KEY or OAuth)
- Rate limited by API costs
- Ephemeral sessions (no memory between calls)

### 4. Approach B: MCP Bridge Pattern (FULL TOOL PASSTHROUGH)

Connect Hermes to Claude Code's MCP server via `hermes mcp add`:

```bash
# On Hermes side:
hermes mcp add claude-code --transport http http://localhost:3100/mcp

# Claude Code must be running MCP server:
claude mcp serve
```

**Problem:** `claude mcp serve` requires browser authentication (redirects to login).

**Workaround:** Use MCPO (MCP Open) bridge with stdio-based Claude Code connection:

```bash
# MCPO bridges stdio MCP servers to HTTP
docker run -p 8080:8080 ghcr.io/open-webui/mcpo:latest \
  --port 8080 -- claude mcp
```

**Limitation:** MCPO not installed in current setup (`mcpo not found`).

### 5. Approach C: Hermes ACP Mode (EDITOR INTEGRATION)

Hermes has an ACP (Agent Client Protocol) mode for editor integration:

```bash
hermes acp
```

This is designed for VS Code, Zed, JetBrains — not for Hermes-to-Claude Code integration.

### 6. Authentication Requirements

Both Claude Code and Hermes require authentication:

| Service        | Auth Method                 | Status                    |
| -------------- | --------------------------- | ------------------------- |
| Claude Code    | `ANTHROPIC_API_KEY` env var | Works in `-p` mode        |
| Claude Code    | OAuth/browser login         | Required for `mcp serve`  |
| Hermes         | `MINIMAX_API_KEY` env var   | Configured in secrets.env |
| Hermes Gateway | `HERMES_API_KEY`            | Configured                |

**For subprocess pattern:** Set `ANTHROPIC_API_KEY` in the Bash environment before calling `claude -p`.

## Decision

**Implement Approach A (Subprocess Pattern) first** — it works today, requires no additional packages, and provides Claude Code's reasoning capabilities to Hermes even without tool passthrough.

**Approach B (MCP Bridge)** requires:

1. Installing MCPO: `pip install mcpo` or Docker
2. Solving the `claude mcp serve` auth flow
3. More complex setup

## Implementation Plan

### Phase 1: Subprocess Skill (Immediate)

1. Create `~/.hermes/skills/claude_code/SKILL.md`
2. Create `/srv/ops/scripts/hermes-claude-invoke.sh`
3. Add entry to `~/.hermes/hermes.json`
4. Test: `hermes chat -q "Invoke claude_code: say hello"`

### Phase 2: MCP Bridge (Future)

1. Install MCPO: `pip install mcpo`
2. Configure `claude mcp serve` auth workaround
3. Connect via `hermes mcp add`

## Architecture Diagram

```
HERMES-AGENT (Ubuntu Desktop)
│
├── coolify_sre skill ──────► sre-monitor.sh
├── perplexity_browser skill ─► browser-use + OpenRouter
├── claude_code skill ──────► claude -p "..." (subprocess)
│                               │
│                               └──► ANTHROPIC_API_KEY ──► Claude Code CLI
│                                                              │
│                                         Claude Code tools:   │
│                                         Bash, Read, Edit,    │
│                                         Glob, Grep, etc.     │
│                                                              │
│                               (Result returned to Hermes     │
│                                as text/JSON output)          │
└── MCP servers ──────────────► context7, github, tavily, etc.
```

## Alternatives Considered

| Approach               | Pros                               | Cons                                |
| ---------------------- | ---------------------------------- | ----------------------------------- |
| Subprocess `claude -p` | Simple, works today, no extra deps | No tool passthrough                 |
| MCP bridge (MCPO)      | Full tool passthrough              | Auth complexity, MCPO not installed |
| hermes acp             | Built-in editor integration        | Not designed for CLI-to-CLI         |
| OpenWebUI bridge       | Existing container on port 3456    | Only exposes OpenWebUI tools        |

## References

- Claude Code CLI: `/usr/local/bin/claude` (v2.1.107)
- Hermes Agent: `~/.local/bin/hermes` (v0.9.0)
- `claude --help` and `hermes --help` for full CLI reference
- SPEC-038: OPERAÇÃO OVERLORD — Hermes-Agent migration
