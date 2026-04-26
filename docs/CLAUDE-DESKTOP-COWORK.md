# Claude Code Desktop — Linux Cowork + MCP Integration

**Source:** https://code.claude.com/docs/en/desktop
**Retrieved:** 2026-04-26
**Purpose:** Enterprise integration reference for Nexus + LiteLLM stack

---

## Overview

> Get more out of Claude Code Desktop: parallel sessions with Git isolation, drag-and-drop pane layout, integrated terminal and file editor, side chats, computer use, Dispatch sessions from your phone, visual diff review, app previews, PR monitoring, connectors, and enterprise configuration.

Claude Desktop has three tabs:
- **Chat** — conversations
- **Cowork** — Dispatch and longer agentic work
- **Code** — software development

## Linux Status

**For Windows ARM64:** download the ARM64 installer.
**For Linux:** "Linux is not supported."

However, an unofficial Linux build exists via community packages. See audit in `/srv/monorepo/docs/` for security details.

---

## Environment Configuration

Before sending first message, configure four things in the prompt area:

1. **Environment**: Local machine, Remote (Anthropic-hosted cloud sessions), or SSH connection
2. **Project folder**: folder or repository Claude works in
3. **Model**: pick from dropdown
4. **Permission mode**: how much autonomy Claude has

---

## Permission Modes

| Mode | Settings key | Behavior |
|------|--------------|----------|
| **Ask permissions** | `default` | Claude asks before editing files or running commands |
| **Auto accept edits** | `acceptEdits` | Auto-accepts file edits and common filesystem commands |
| **Plan mode** | `plan` | Reads files, runs commands to explore, proposes plan without editing |
| **Auto** | `auto` | Executes all actions with background safety checks |
| **Bypass permissions** | `bypassPermissions` | No permission prompts — use only in sandboxed containers/VMs |

---

## Model Configuration

Models are selected from dropdown in the session. For CLI, models are configured via environment variables.

### Connecting to LiteLLM

Claude Code Desktop can connect to custom LLM backends via MCP (Model Context Protocol) or direct API configuration.

Key environment variables for custom backends:
- `ANTHROPIC_BASE_URL` — proxy endpoint (e.g., `http://localhost:4000` for LiteLLM)
- `ANTHROPIC_AUTH_TOKEN` — API key for auth

---

## MCP (Model Context Protocol)

MCP enables connecting external tools and services. Claude Code Desktop supports MCP servers for:
- Database connections
- Filesystem operations
- Custom tool integrations
- Vector stores (Qdrant, Mem0)
- Memory systems

### MCP Configuration Location

Desktop config: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "memory": {
      "command": "python",
      "args": ["/srv/monorepo/mcps/mcp-memory/server.py"],
      "env": {
        "QDRANT_HOST": "10.0.19.5:6333",
        "QDRANT_API_KEY": "your-key"
      }
    }
  }
}
```

---

## Enterprise Configuration

Enterprise admins can:
- Restrict which permission modes are available
- Disable bypass permissions option
- Configure team-wide default settings

### Security Notes

- `bypassPermissionsModeEnabled: true` in config requires extreme caution — only use in sandboxed environments
- API keys should never be hardcoded — use environment variables
- For LiteLLM integration, use `LITELLM_MASTER_KEY` environment variable

---

## Key Features

### Parallel Sessions
Each session has its own chat history, project folder, and code changes. Run several in parallel.

### Git Integration
- Review and comment on diffs
- Monitor PR status via GitHub CLI (`gh`)
- Auto-fix and auto-merge capabilities

### Preview Pane
Claude can:
- Start dev servers automatically
- Take screenshots to verify changes
- Test API endpoints

### Terminal
Integrated terminal shares the same environment as Claude. Available in local sessions only.

---

## SSH Sessions

Claude can connect to remote machines via SSH. Configure in environment dropdown.

---

## Related Documents

- [LiteLLM Configuration](../docs/LITELLM_CONFIG.md) — current LiteLLM setup
- [MCP Servers](../docs/MCP_SERVERS.md) — MCP integration docs
- [Enterprise Feature Branch Template](../docs/ENTERPRISE-FEATURE-BRANCH.md)
- [SRE Dashboard](../SRE-DASHBOARD.md)

---

## CLI Comparison (Coming from CLI)

The CLI and Desktop share similar features but some things carry over differently. See CLI docs for environment variable configuration.