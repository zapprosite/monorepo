# OpenCode CLI Research

## Overview

OpenCode CLI is an AI-powered coding assistant by SST (Same Day Terris). It provides a terminal-based interface for AI-assisted development with support for multiple LLM providers.

**Website:** https://opencode.ai

---

## Installation

```bash
# Install script (Linux/macOS)
curl -fsSL https://opencode.ai/install | bash

# Package managers
npm install -g opencode-ai
bun install -g opencode-ai
pnpm install -g opencode-ai
yarn global add opencode-ai

# Homebrew
brew install anomalyco/tap/opencode

#pacman (Arch)
sudo pacman -S opencode

# Chocolateo (Windows)
choco install opencode

# Scoop (Windows)
scoop install opencode

# Docker
docker run -it --rm ghcr.io/anomalyco/opencode
```

---

## Core CLI Commands

| Command | Description |
|---------|-------------|
| `opencode` | Start OpenCode in current project directory |
| `opencode /init` | Analyze project and create `AGENTS.md` |
| `opencode /connect` | Connect to LLM provider (select provider) |
| `opencode /undo` | Revert changes |
| `opencode /redo` | Reapply undone changes |
| `opencode /share` | Generate shareable link to conversation |
| `opencode run [message..]` | Non-interactive execution |
| `opencode agent create` | Create new agent with custom config |
| `opencode agent list` | List all available agents |
| `opencode github run` | Run GitHub agent (for GitHub Actions) |
| `opencode acp` | Start ACP server for stdin/stdout |

### Interactive Features

- **File referencing:** Use `@` to fuzzy search and reference files
- **Plan mode:** Press `<TAB>` to switch between Plan mode (preview) and Build mode (execute)
- **Images:** Drag and drop images into terminal for context

---

## API Key Configuration

### Method 1: Interactive Login (Preferred)

```bash
opencode auth login
```

This guides you through setting up API keys for any provider. Credentials are stored in `~/.local/share/opencode/auth.json`.

### Method 2: Environment Variables

API keys can be defined via environment variables or a `.env` file in your project. OpenCode automatically loads project-level `.env` files.

### Method 3: Config File

Define provider API keys directly in the config file under `provider` settings.

### Server Password

```bash
OPENCODE_SERVER_PASSWORD  # Enables HTTP basic auth for serve/web commands
```

---

## Configuration Files

### File Format

OpenCode uses **JSON** and **JSONC** (JSON with Comments) format. No TOML support.

### Config Locations (Precedence)

1. Remote config (`.well-known/opencode`) - organizational defaults
2. Global config (`~/.config/opencode/opencode.json`)
3. Custom config (`OPENCODE_CONFIG` env var)
4. Project config (`opencode.json` in project root)
5. `.opencode` directories (agents, commands, plugins)
6. Inline config (`OPENCODE_CONFIG_CONTENT` env var)
7. Managed config files (system directories)
8. macOS MDM managed preferences (highest priority)

### Environment Variables for Config

| Variable | Description |
|----------|-------------|
| `OPENCODE_CONFIG` | Custom config file path |
| `OPENCODE_TUI_CONFIG` | TUI config file path |
| `OPENCODE_CONFIG_DIR` | Config directory |
| `OPENCODE_CONFIG_CONTENT` | Inline config JSON |
| `OPENCODE_AUTH` | Auth data file path |

### Config Schema Options

| Category | Options |
|----------|---------|
| `server` | Port, hostname, mDNS, CORS settings |
| `shell` | Shell preference (pwsh, zsh, bash) |
| `tools` | Enable/disable LLM tools (write, bash, edit, etc.) |
| `model` / `small_model` | Primary and lightweight model selection |
| `provider` | Provider-specific settings (timeout, region, api_key) |
| `agent` | Custom agent definitions with model, prompt, tools |
| `default_agent` | Default agent selection (build, plan, custom) |
| `tui` | TUI-specific settings (separate tui.json recommended) |
| `theme` | UI theme selection |
| `share` | Sharing mode: manual, auto, disabled |
| `command` | Custom command definitions with templates |
| `keybinds` | Keyboard shortcut customization |
| `snapshot` | Enable/disable file change tracking |
| `autoupdate` | Auto-update preference (true/false/notify) |
| `formatter` | Code formatter configuration |
| `permission` | Tool permission requirements (ask, allow, deny) |
| `compaction` | Context compaction behavior (auto, prune, reserved) |
| `watcher` | File watcher ignore patterns |
| `mcp` | MCP server configuration |
| `plugin` | Plugin loading from .opencode/plugins/ or npm |
| `instructions` | Paths/glob patterns to instruction files |
| `disabled_providers` | Providers to skip loading |
| `enabled_providers` | Allowlist of providers to use |

### Config File Example

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "server": {
    "port": 3000,
    "hostname": "localhost"
  },
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4",
  "provider": {
    "anthropic": {
      "api_key": "{env:ANTHROPIC_API_KEY}"
    }
  },
  "agent": {
    "code-reviewer": {
      "description": "Reviews code for best practices",
      "model": "anthropic/claude-sonnet-4-5",
      "prompt": "You are a code reviewer...",
      "tools": {
        "write": false,
        "edit": false
      }
    }
  },
  "default_agent": "plan",
  "permission": "ask"
}
```

### Variable Substitution

Config supports variables:
- `{env:VARIABLE_NAME}` - Environment variable
- `{file:path/to/file}` - File contents (relative or absolute paths)

---

## Agents Configuration

### Directory Locations

- `~/.config/opencode/agents/` - Global agents
- `.opencode/agents/` - Project-level agents

Agents can be defined as:
- JSON files with `model`, `prompt`, `tools`, `description`
- Markdown files with frontmatter

### Agent Schema

```jsonc
{
  "description": "Agent description",
  "model": "provider/model-name",
  "prompt": "System prompt for the agent",
  "tools": {
    "write": true,
    "edit": true,
    "bash": true,
    "read": true
  }
}
```

---

## ACP (Agent Communication Protocol)

ACP enables OpenCode to communicate via stdin/stdout for external integrations.

```bash
opencode acp              # Start ACP server
opencode acp --cwd /path  # Specify working directory
```

---

## Related Documentation

- Official Docs: https://opencode.ai/docs
- Config Schema: https://opencode.ai/config.json
