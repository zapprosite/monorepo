# Codex CLI Research

**Source:** CLI introspection + Web research  
**Date:** 2026-04-30  
**Status:** Complete

---

## Overview

Codex CLI is OpenAI's command-line agentic coding tool. It runs as an interactive TUI or non-interactively via `exec`, accepts API keys via environment or login, uses TOML config at `~/.codex/config.toml`, and supports MCP server integration, hooks, and sandboxed command execution.

---

## Installation

```bash
npm install -g @openai/codex
brew install --cask codex
# Linux/macOS binaries: https://github.com/openai/codex
```

---

## Authentication

### API Key (recommended for CI/CD)
```bash
# Via environment variable (any sk- prefixed key)
export OPENAI_API_KEY=sk-...

# Via codex login
printenv OPENAI_API_KEY | codex login --with-api-key

# Via device flow
codex login --device-auth
```

### Config Location
- Auth tokens: `~/.codex/auth.json` (also stores `OPENAI_API_KEY` if set)
- `CODEX_HOME` defaults to `~/.codex`

### Credential Storage Options
```toml
cli_auth_credentials_store = "file"    # auth.json under CODEX_HOME
cli_auth_credentials_store = "keyring" # OS credential store
cli_auth_credentials_store = "auto"     # keyring if available, else file
```

### Forced Login (admin-managed config)
```toml
forced_login_method = "chatgpt"  # or "api"
forced_chatgpt_workspace_id = "00000000-0000-0000-0000-000000000000"
```

---

## Config File

**Location:** `~/.codex/config.toml` (TOML format)

### Config Lookup Order
1. CLI flag `-c key=value` (dotted path, parsed as TOML literal)
2. `~/.codex/config.toml`
3. Project-level config (`.codex.json` or `codex.env` in workspace root)
4. Environment variables

### Example Config
```toml
codex_hooks = true

model = "gpt-5.5"
model_reasoning_effort = "xhigh"
sandbox_mode = "danger-full-access"
approvals_reviewer = "user"

[mcp_servers.context7]
command = "sh"
args = ["-lc", "set -a; [ -f /srv/monorepo/.env ] && . /srv/monorepo/.env; set +a; : \"${CONTEXT7_API_KEY:?CONTEXT7_API_KEY is required}\"; exec npx -y @upstash/context7-mcp@latest"]

[mcp_servers."task-master-ai"]
command = "npx"
args = ["-y", "--package=task-master-ai", "task-master-ai"]

[mcp_servers.minimax]
command = "sh"
args = ["-lc", "set -a; [ -f /srv/monorepo/.env ] && . /srv/monorepo/.env; set +a; : \"${MINIMAX_API_KEY:?MINIMAX_API_KEY is required}\"; export MINIMAX_API_HOST=\"${MINIMAX_API_HOST:-https://api.minimax.io}\"; exec uvx minimax-mcp -y"]

[mcp_servers.github]
command = "sh"
args = ["-lc", "set -a; [ -f /srv/monorepo/.env ] && . /srv/monorepo/.env; set +a; : \"${GITHUB_TOKEN:?GITHUB_TOKEN is required}\"; exec uvx mcp-github"]

[projects."/srv/monorepo"]
trust_level = "trusted"

[projects."/tmp"]
trust_level = "trusted"

[notice.model_migrations]
"gpt-5.3-codex" = "gpt-5.4"

[tui.model_availability_nux]
"gpt-5.5" = 4
```

### Key Config Options

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | Model to use (e.g. `gpt-5.5`, `o3`) |
| `model_reasoning_effort` | string | Reasoning effort: `low`, `medium`, `high`, `xhigh` |
| `sandbox_mode` | string | `read-only`, `workspace-write`, `danger-full-access` |
| `approvals_reviewer` | string | Who reviews approvals: `user`, `model` |
| `codex_hooks` | bool | Enable hooks system |
| `trust_level` | string | Project trust: `untrusted`, `trusted` |

### Profile System
```bash
codex -p <profile_name>  # Select from [profiles] section in config.toml
```

### Config Override via CLI
```bash
codex -c model="o3" -c 'sandbox_permissions=["disk-full-read-access"]'
codex -c 'shell_environment_policy.inherit=all'
```

---

## CLI Commands

### Main Commands
```
codex [PROMPT]           # Interactive TUI (default)
codex exec [PROMPT]      # Non-interactive execution
codex review [PROMPT]    # Code review non-interactively
codex login              # Manage authentication
codex logout             # Remove stored credentials
codex mcp                # Manage MCP servers
codex plugin             # Manage plugins
codex mcp-server         # Start Codex as MCP server (stdio)
codex sandbox            # Run in sandboxed environment
codex apply              # Apply latest agent diff (git apply)
codex resume             # Resume previous session
codex fork               # Fork previous session
codex cloud              # [EXPERIMENTAL] Codex Cloud tasks
codex completion         # Generate shell completions
codex features           # Inspect feature flags
```

### Key Flags (global)
```
-c, --config <key=value>  Override config value (dotted path, TOML)
--enable <FEATURE>        Enable feature (equiv: -c features.<name>=true)
--disable <FEATURE>       Disable feature
--remote <ADDR>           Connect to remote app server (ws://host:port or wss://)
--remote-auth-token-env <ENV_VAR>  Bearer token for remote server
-i, --image <FILE>        Attach image(s) to prompt
-m, --model <MODEL>       Set model
--oss                     Use open-source provider
--local-provider <OSS_PROVIDER>  Specify: lmstudio or ollama
-p, --profile <PROFILE>   Use config profile
-s, --sandbox <MODE>     Sandbox: read-only, workspace-write, danger-full-access
--full-auto               Low-friction sandboxed auto execution
--dangerously-bypass-approvals-and-sandbox  DANGEROUS: skip all prompts+sandbox
-C, --cd <DIR>            Set working root
--add-dir <DIR>           Additional writable directories
-a, --ask-for-approval <POLICY>  untrusted, on-failure(deprecated), on-request, never
--search                  Enable live web search
--no-alt-screen           Inline mode (preserve scrollback, for tmux/zellij)
```

### Approval Policies
```
untrusted   Only run "trusted" commands (ls, cat, sed) without asking
on-request  Model decides when to ask
never       Never ask — execution failures returned to model
```

### Sandbox Modes
```
read-only        No filesystem write, no network
workspace-write  Write only inside workspace
danger-full-access  Full disk + network access
```

---

## Non-Interactive Exec

```bash
codex exec [OPTIONS] [PROMPT]
codex exec -c model="o3" --full-auto "Fix the login bug"
codex exec --skip-git-repo-check "Analyze this file"
codex exec --json  # JSONL output to stdout
codex exec --output-last-message /tmp/result.json
codex exec --ephemeral  # No session persistence
codex exec --ignore-user-config  # Skip ~/.codex/config.toml
codex exec --ignore-rules  # Skip .rules files
```

### Review Mode
```bash
codex review "Check for SQL injection"
codex review --uncommitted  # Review all changes
codex review --base main    # Compare against branch
codex review --commit abc123 # Review specific commit
```

---

## MCP Server Integration

### Management Commands
```bash
codex mcp list        # List configured MCP servers
codex mcp get <name>  # Show MCP server config
codex mcp add <name>  # Add new MCP server
codex mcp remove <name>
codex mcp login       # Authenticate to MCP server
codex mcp logout
```

### Config (TOML)
```toml
[mcp_servers.context7]
command = "sh"
args = ["-lc", "set -a; [ -f /srv/monorepo/.env ] && . /srv/monorepo/.env; set +a; : \"${CONTEXT7_API_KEY:?CONTEXT7_API_KEY is required}\"; exec npx -y @upstash/context7-mcp@latest"]

[mcp_servers.github]
command = "sh"
args = ["-lc", "set -a; [ -f /srv/monorepo/.env ] && . /srv/monorepo/.env; set +a; : \"${GITHUB_TOKEN:?GITHUB_TOKEN is required}\"; exec uvx mcp-github"]
```

---

## Hooks System

**File:** `~/.codex/hooks.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "EVENT_DIR=/home/will/.claude/events EVENT_TYPE=TOOL_CALL bash /home/will/.claude/events/event-emit.sh tool=${tool_name}"
          }
        ]
      }
    ]
  }
}
```

Hook types: `command`, `env`  
Event types: `PostToolUse`, `PreToolUse`, `SessionStart`, etc.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | API key authentication |
| `CODEX_HOME` | Config directory (default: `~/.codex`) |
| `CODEX_CA_CERTIFICATE` | PEM bundle for custom TLS/Corporate CA |
| `env_key` | Custom model provider — env var name for API key |

---

## Workspace / Project Trust

```toml
[projects."/srv/monorepo"]
trust_level = "trusted"

[projects."/tmp"]
trust_level = "trusted"
```

Trust levels: `untrusted` | `trusted`

---

## Cloud Commands (EXPERIMENTAL)

```bash
codex cloud exec     # Submit task without TUI
codex cloud status   # Task status
codex cloud list     # List tasks
codex cloud apply    # Apply diff locally
codex cloud diff     # Show unified diff
```

---

## Version

```bash
codex --version
```

---

## Key Findings for Monorepo Integration

1. **Auth:** `OPENAI_API_KEY` env var + `codex login --with-api-key` for non-interactive
2. **Config:** TOML at `~/.codex/config.toml` with profile and MCP server support
3. **MCP:** Already integrated with context7, github, minimax, task-master-ai via env-sourced keys
4. **Hooks:** `~/.codex/hooks.json` supports PostToolUse events for observability
5. **Exec:** Non-interactive via `codex exec --full-auto --json` for pipeline use
6. **Review:** `codex review --uncommitted` for automated code review
7. **Sandbox:** `danger-full-access` for trusted local execution, `workspace-write` for safer
8. **Models:** Uses `gpt-5.5` by default (configurable via `-m` or config)

---

## References

- Docs: https://developers.openai.com/codex
- GitHub: https://github.com/openai/codex
- NPM: https://www.npmjs.com/package/@openai/codex