# API Keys Guide — CLI Authentication Patterns

**Source:** CLI research + introspection  
**Date:** 2026-04-30  
**Status:** Complete

---

## Overview

This guide documents how each CLI in the monorepo manages API keys: where keys are stored, how to configure and rotate them, how to verify they are set, and the recommended security patterns.

CLIs covered:
- **Claude Code** (`claude.ai/code`)
- **Codex CLI** (`@openai/codex`)
- **mclaude** (`multi-claude`)

---

## 1. Claude Code

### Storage Location

Claude Code does **not** store API keys directly. It relies on environment variables and the MCP server configuration in `~/.claude/mcp-servers.json`.

| Storage Type | Location | Contents |
|---|---|---|
| Environment variables | Process env | `ANTHROPIC_API_KEY`, `MINIMAX_API_KEY`, etc. |
| MCP server config | `~/.claude/mcp-servers.json` | Env vars passed to MCP server processes |
| Settings | `~/.claude/settings.json` | No secrets — only flags, hooks, permissions |

### Configuration

**MCP servers** accept API keys via env var substitution in `~/.claude/mcp-servers.json`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }
    },
    "minimax": {
      "command": "uvx",
      "args": ["minimax-mcp", "-y"],
      "env": {
        "MINIMAX_API_KEY": "${MINIMAX_API_KEY}",
        "MINIMAX_API_HOST": "https://api.minimax.io"
      }
    },
    "github": {
      "command": "uvx",
      "args": ["mcp-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

The `${VAR_NAME}` syntax means: "resolve from the current process environment before spawning the MCP server."

**Agent env vars** are set in `~/.claude/settings.json` under the `env` key:

```json
{
  "env": {
    "SLASH_COMMAND_TOOL_CHAR_BUDGET": "8000"
  }
}
```

### How Keys Are Loaded

```
User's shell (.bashrc, .zshrc, .env)
    │
    ▼
Claude Code session (inherits process env)
    │
    ├──► ~/.claude/settings.json  (env vars for agent)
    │
    └──► ~/.claude/mcp-servers.json  (env vars for MCP processes)
              │
              ▼
         MCP server processes (receive resolved env vars)
```

### Rotation

1. Update the key in the source (e.g., `/srv/monorepo/.env`, secrets manager)
2. Restart the Claude Code session (new session resolves new values)
3. For MCP servers: restart the MCP server process by restarting Claude Code

### Verification

```bash
# Check if an env var is loaded (safe — does not expose value)
test -n "${ANTHROPIC_API_KEY:-}" && echo "ANTHROPIC_API_KEY is set"

# List all env vars loaded by Claude Code — use settings.json inspection
grep -E "API_KEY|TOKEN|SECRET" ~/.claude/settings.json ~/.claude/mcp-servers.json 2>/dev/null

# Verify MCP server received the key (check MCP server is running)
codex mcp list  # for Codex
# For Claude Code: check process env via monitoring
```

### Security Pattern

| Do | Don't |
|---|---|
| Store real values in `/srv/monorepo/.env` (gitignored) | Hardcode keys in config files |
| Use `${VAR}` template syntax in `mcp-servers.json` | Put real API keys in `settings.json` or `mcp-servers.json` |
| Verify with `test -n` pattern | Use `echo $API_KEY`, `printenv`, `grep` on `.env` |
| Sync `.env` → `.env.example` after changes (`env-sync.sh`) | Commit `.env` to git |

---

## 2. Codex CLI

### Storage Location

| Storage Type | Location | Contents |
|---|---|---|
| Auth credentials | `~/.codex/auth.json` | API key (if set via `OPENAI_API_KEY`), auth tokens |
| Config file | `~/.codex/config.toml` (TOML) | Model prefs, sandbox mode, MCP server configs, project trust |
| Environment variable | `OPENAI_API_KEY` | API key for authentication |
| Credential store option | `keyring` or `file` | Configurable via `cli_auth_credentials_store` |

### Configuration

**Recommended (env var for CI/CD):**
```bash
export OPENAI_API_KEY=sk-...
codex exec --full-auto "Fix the login bug"
```

**Interactive login:**
```bash
codex login --device-auth
# or
printenv OPENAI_API_KEY | codex login --with-api-key
```

**Config file** (`~/.codex/config.toml`):
```toml
# Auth credential storage: file (auth.json) | keyring | auto
cli_auth_credentials_store = "keyring"

[projects."/srv/monorepo"]
trust_level = "trusted"
```

**MCP server env var passing** (TOML):
```toml
[mcp_servers.context7]
command = "sh"
args = ["-lc", "set -a; [ -f /srv/monorepo/.env ] && . /srv/monorepo/.env; set +a; : \"${CONTEXT7_API_KEY:?CONTEXT7_API_KEY is required}\"; exec npx -y @upstash/context7-mcp@latest"]

[mcp_servers.github]
command = "sh"
args = ["-lc", "set -a; [ -f /srv/monorepo/.env ] && . /srv/monorepo/.env; set +a; : \"${GITHUB_TOKEN:?GITHUB_TOKEN is required}\"; exec uvx mcp-github"]
```

### Credential Storage Options

```toml
cli_auth_credentials_store = "file"    # stored in ~/.codex/auth.json
cli_auth_credentials_store = "keyring" # OS credential manager (preferred)
cli_auth_credentials_store = "auto"     # keyring if available, else file
```

### Rotation

1. Set new `OPENAI_API_KEY` in environment
2. Run `codex login --with-api-key` to update stored credentials
3. Or simply update the env var and restart the session

### Verification

```bash
# Check if OPENAI_API_KEY is set (safe pattern)
test -n "${OPENAI_API_KEY:-}" && echo "OPENAI_API_KEY is set"

# Verify Codex auth status
codex login --status

# Show loaded config (redacts secret values)
codex config list

# Check which env vars Codex received
codex exec --env 2>&1 | head -20  # shows env block
```

### Security Pattern

| Do | Don't |
|---|---|
| Use `OPENAI_API_KEY` env var for CI/CD | Store real keys in `config.toml` |
| Use `keyring` credential store for local use | Use `file` store on shared systems |
| Pass env vars via `.env` sourcing in `args` for MCP | Hardcode secrets in TOML `args` array |
| Use `codex login --with-api-key` to store securely | Put `sk-...` directly in config files |

---

## 3. mclaude (multi-claude)

### Storage Location

| Storage Type | Location | Contents |
|---|---|---|
| Config file | `~/.multi-claude/config.json` | Provider templates, installation metadata |
| Credential store | `~/.multi-claude/credentials.enc` | Encrypted API keys (AES-256-GCM) |
| Environment variable | Inherited from shell | Used at runtime to spawn Claude Code |

### Configuration

**Config file** (`~/.multi-claude/config.json`):
```json
{
  "version": "1.0.0",
  "providers": [
    {
      "name": "minimax",
      "type": "minimax",
      "apiKeyEnvVar": "MINIMAX_API_KEY",
      "apiHost": "https://api.minimax.io"
    }
  ],
  "installations": [
    {
      "name": "crm-ownership",
      "provider": "minimax",
      "model": "MiniMax-M2.7",
      "claudeDir": "/srv/monorepo/.claude/instances/crm-ownership"
    }
  ]
}
```

**Encrypted credential store** (`~/.multi-claude/credentials.enc`):
- API keys are encrypted at rest using AES-256-GCM
- Key derivation via `argon2id` from a master password or system keyring
- Decrypted in memory only when needed to spawn a worker

### Credential Store Files

| File | Purpose |
|---|---|
| `~/.multi-claude/config.json` | Provider configs, installation metadata — no secrets |
| `~/.multi-claude/credentials.enc` | Encrypted API keys — never committed to git |
| `~/.multi-claude/keystore.json` | Encrypted key derivation salt (keychain-backed on Linux) |

### Rotation

1. Run `mclaude` TUI → select provider → update API key
2. Or use headless mode: `mclaude --edit-provider <name> --new-key`
3. The encrypted store is updated in place

### Verification

```bash
# Check if mclaude config exists
test -f ~/.multi-claude/config.json && echo "Config exists"

# List configured providers (no secret values shown)
mclaude --list-providers

# Verify a specific provider's env var is accessible (no exposure)
test -n "${MINIMAX_API_KEY:-}" && echo "MINIMAX_API_KEY is set"

# Test provider connectivity (without exposing key)
mclaude --test-provider minimax
```

### Security Pattern

| Do | Don't |
|---|---|
| Store API keys encrypted at rest (`credentials.enc`) | Store plain-text keys in `config.json` |
| Use `apiKeyEnvVar` to reference env var at runtime | Hardcode real keys in config |
| Keep `~/.multi-claude/` permissions `600` | Commit `credentials.enc` or `keystore.json` to git |
| Use system keyring for master key derivation | Store master password in a file |

---

## Cross-CLI Comparison

| Aspect | Claude Code | Codex CLI | mclaude |
|---|---|---|---|
| **Key storage** | Env var + MCP config | Env var + `auth.json` or keyring | Encrypted file (`credentials.enc`) |
| **Config file** | `~/.claude/mcp-servers.json` | `~/.codex/config.toml` | `~/.multi-claude/config.json` |
| **Key format** | `${VAR}` env substitution | Direct env var or `OPENAI_API_KEY` | Env var name reference + encrypted store |
| **MCP env var passing** | JSON env block | TOML `args` with `.env` sourcing | Provider-level env var reference |
| **Credential store** | None (env only) | `auth.json` or OS keyring | AES-256-GCM encrypted file |
| **Rotation method** | Restart session (env updates) | `codex login --with-api-key` | TUI or headless `--edit-provider` |
| **Verification** | `test -n` on env var | `codex login --status` | `mclaude --list-providers` + env check |

---

## Recommended Security Pattern (Monorepo)

### 1. Real Keys — `.env` (never git commit)

```
/srv/monorepo/.env           # Real values — gitignored, sourced by apps
/srv/monorepo/.env.example   # ${VAR} templates — tracked in git
```

### 2. CLI Authentication

| CLI | Auth method |
|---|---|
| **Claude Code** | Inherit from shell env; MCP servers reference `${VAR}` in `mcp-servers.json` |
| **Codex CLI** | `OPENAI_API_KEY` env var; `codex login --with-api-key` for keyring storage |
| **mclaude** | `apiKeyEnvVar` in config; encrypted store for at-rest keys |

### 3. Environment Propagation

```bash
# Safe pattern — source .env and use keys in commands (never in output)
set -a
[ -f /srv/monorepo/.env ] && . /srv/monorepo/.env
set +a

# Then verify (no exposure)
test -n "${ANTHROPIC_API_KEY:-}" && echo "ANTHROPIC_API_KEY is set"
test -n "${MINIMAX_API_KEY:-}" && echo "MINIMAX_API_KEY is set"
```

### 4. Verification Commands (All CLIs)

```bash
# Claude Code
test -n "${ANTHROPIC_API_KEY:-}" && echo "set"

# Codex CLI
test -n "${OPENAI_API_KEY:-}" && echo "set"

# mclaude
test -n "${MINIMAX_API_KEY:-}" && echo "set"
mclaude --list-providers
```

---

## Rotation Checklist

| Step | Action |
|---|---|
| 1 | Obtain new key from provider |
| 2 | Update source `.env` file |
| 3 | Run `bash /srv/ops/scripts/env-sync.sh` to sync `.env.example` |
| 4 | Verify new key: `source .env && test -n "${KEY:-}" && echo "loaded"` |
| 5 | Restart CLI session (resolves new env vars) |
| 6 | For mclaude: run `mclaude --edit-provider <name> --new-key` to update encrypted store |

---

## References

- [Claude Code Research](./CLAUDE-CODE-RESEARCH.md)
- [Codex CLI Research](./CODEX-RESEARCH.md)
- [CLI Compatibility Matrix](./CLI-COMPATIBILITY-MATRIX.md)
- Anti-hardcoded secrets rules: `~/.claude/rules/anti-hardcoded-secrets.md`
- Cloudflare secrets rules: `~/.claude/rules/cloudflare-secrets.md`
- Secrets patterns: `/srv/monorepo/docs/OPERATIONS/SECRETS-PATTERNS.md`
- env-sync script: `/srv/monorepo/scripts/env-sync.sh`