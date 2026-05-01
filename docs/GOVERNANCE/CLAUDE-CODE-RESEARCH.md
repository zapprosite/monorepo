# Claude Code CLI Research

## Overview

Research on Claude Code CLI (claude.ai/code) based on local configuration and usage patterns.

---

## 1. CLI Commands

### Slash Commands (built-in)

| Command | Description |
|---------|-------------|
| `/spec` | Spec-driven development — write structured SPEC.md before coding |
| `/plan` | Break work into small verifiable tasks with acceptance criteria |
| `/execute` | 14-agent parallel orchestrator: SPEC → pipeline → PR |
| `/test` | Run focused or full test suite |
| `/review` | Code review prioritizing defects and risk |
| `/ship` | Verify, sync AI context, prepare deploy handoff |
| `/sec` | Security audit |
| `/build` | Incremental build implementation |
| `/commit` | Git commit with conventional messages |
| `/turbo` | Quick feature ship — commit → push → merge → tag → new branch |
| `/feature` | Create feature branch, implement, test, open PR |
| `/img` | Image analysis via Qwen2.5-VL-3B via Ollama |
| `/cursor-loop` | Autonomous CI/CD cursor loop |
| `/code-review` | Universal code review |
| `/plan` | Planning workflow |
| `/auto-spec` | Auto SPEC → Deploy pipeline |

### Nexus Framework Commands

Located at `.claude/vibe-kit/nexus.sh`:

```bash
# Status and discovery
.claude/vibe-kit/nexus.sh --status
.claude/vibe-kit/nexus.sh --mode list

# Mode selection (7 modes: debug, test, backend, frontend, review, docs, deploy)
nexus.sh --mode debug

# PREVC workflow per SPEC
nexus.sh --spec SPEC-NNN --phase plan|review|execute|verify|complete
```

---

## 2. Configuration Files

### Main Settings

**Location:** `~/.claude/settings.json`

```json
{
  "env": {
    "SLASH_COMMAND_TOOL_CHAR_BUDGET": "8000"
  },
  "permissions": {
    "allow": ["Bash(*)", "Read(**)", "Edit(**)"],
    "deny": [
      "Read(*.env*)",
      "Read(*terraform.tfvars*)",
      "Read(*id_rsa*)",
      "Bash(apt upgrade*)",
      "Bash(zfs destroy*)",
      "Bash(terraform destroy*)"
    ],
    "defaultMode": "bypassPermissions",
    "bypassPermissions": false
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/PreToolUse-Bash-validate.bash" }]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/PreToolUse-Edit-validate.bash" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/PostToolUse-event-emit.bash" }]
      }
    ]
  },
  "enabledPlugins": { "flow-next@flow-next": true },
  "language": "Portuguese",
  "alwaysThinkingEnabled": true,
  "effortLevel": "high",
  "skipDangerousModePermissionPrompt": true,
  "mcpServers": { /* See MCP Servers section */ },
  "model": "opus[1m]"
}
```

### Permissions

| Pattern | Effect |
|---------|--------|
| `Bash(*)` | Allow all bash commands |
| `Read(*.env*)` | Deny reading env files |
| `Read(*terraform.tfvars*)` | Deny reading tfvars |
| `Bash(zfs destroy*)` | Deny ZFS destroy |
| `BypassPermissions: false` | Require permission prompts |

### Hooks

**PreToolUse Hooks:**
- `PreToolUse-Bash-validate.bash` — Validates Bash commands before execution
- `PreToolUse-Edit-validate.bash` — Validates Edit/Write/MultiEdit operations

**PostToolUse Hooks:**
- Emits tool call events for monitoring

---

## 3. Environment Variables

### Settings-defined env

```json
"env": {
  "SLASH_COMMAND_TOOL_CHAR_BUDGET": "8000"
}
```

### MCP Server env vars

```json
"mcpServers": {
  "context7": {
    "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }
  },
  "minimax": {
    "env": {
      "MINIMAX_API_KEY": "${MINIMAX_API_KEY}",
      "MINIMAX_API_HOST": "https://api.minimax.io"
    }
  },
  "github": {
    "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
  }
}
```

### Nexus/vibe-kit env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `VIBE_WATCH_MODE` | false | Use inotifywait immediate wake-up |
| `VIBE_POLL_INTERVAL` | 5 | Poll interval in seconds |
| `VIBE_IDLE_COOLDOWN` | 180 | Exit after N seconds of empty queue |
| `VIBE_SNAPSHOT_EVERY` | 3 | ZFS snapshot every N tasks |
| `VIBE_PARALLEL` | 15 | Max parallel mclaude workers |

### State Manager

```bash
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py get events <type>
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py event <type> key=value ...
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py agent-start <id> --tool Read --cwd /srv/monorepo
EVENT_DIR=$CLAUDE_DIR/events python3 state-manager.py agent-complete <id> [result]
```

---

## 4. MCP Servers

### Config File

**Location:** `~/.claude/mcp-servers.json`

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }
    },
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {}
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

### Local MCP Servers

**Location:** `~/.claude/mcp-servers/`

- `skill-bridge/` — Custom skill bridge implementation

---

## 5. Agent/Worker System

### Nexus (49-Agent Orchestrator)

7 modes x 7 agents = 49 combinations:

```
Layer 1 — nexus.sh       # Orchestrator entry point
Layer 2 — vibe-kit.sh     # Infinite loop runner
Layer 3 — state-manager.py # Cross-CLI atomic state
```

### vibe-kit.sh

Infinite loop runner for brain-refactor queue. Spawns up to 15 parallel mclaude workers.

Key env vars: `VIBE_WATCH_MODE`, `VIBE_POLL_INTERVAL`, `VIBE_IDLE_COOLDOWN`, `VIBE_SNAPSHOT_EVERY`

### Execute Command (14 Agents)

| # | Agent | Function |
|---|-------|----------|
| 1 | SPEC-ANALYZER | Analisa SPEC, extrai AC e ficheiros |
| 2 | ARCHITECT | Revê arquitectura e flags issues |
| 3 | CODER-1 | Backend (Fastify/tRPC) |
| 4 | CODER-2 | Frontend (React/MUI) |
| 5 | TESTER | Escreve testes |
| 6 | SMOKE | Smoke tests |
| 7 | SECURITY | Audit OWASP + secrets |
| 8 | DOCS | Actualiza documentação |
| 9 | TYPES | TypeScript check |
| 10 | LINT | Lint |
| 11 | SECRETS | Scan secrets |
| 12 | GIT | Commits changes |
| 13 | REVIEWER | Code review final |
| 14 | SHIPPER | Cria PR no Gitea |

---

## 6. File Structure

```
~/.claude/
├── CLAUDE.md              # User's global instructions
├── settings.json          # Main CLI settings (permissions, hooks, MCP)
├── mcp-servers.json       # MCP server configurations
├── mcp-servers/           # Local MCP server implementations
│   └── skill-bridge/
├── commands/              # Slash command definitions
│   ├── spec.md
│   ├── plan.md
│   ├── execute.md
│   ├── test.md
│   ├── review.md
│   ├── ship.md
│   └── ... (16 total)
├── hooks/                 # Pre/Post tool hooks
│   ├── PreToolUse-Bash-validate.bash
│   ├── PreToolUse-Edit-validate.bash
│   └── PostToolUse-event-emit.bash
├── agents/                # Specialized agent definitions
├── rules/                 # Global rules (anti-hardcoded, secrets, language)
├── agent-skills/          # Agent skill definitions
├── projects/              # Project-specific memory
├── teams/                 # Team configurations
├── sessions/              # Session history
├── events/                # Event system
├── state.json             # Cross-CLI state
└── cache/                 # Cache directory
```

---

## 7. Key Features

### PREVC Workflow

| Phase | Gate | Description |
|-------|------|-------------|
| **P**lan | Plan approval required | SPEC draft → approved |
| **R**eview | Design review required | Architecture review → approved |
| **E**xecute | Implementation | Developers build, vibe-kit runs parallel workers |
| **V**erify | Smoke tests + checks | Automated verification |
| **C**omplete | Ship checklist | `/ship` sync + commit + PR |

### Cross-CLI Event System

```
Claude Code ──[PostToolUse hook]──> settings.json
Codex CLI   ──[PostToolUse hook]──> hooks.json
OpenCode    ──[wrapper boot event]──> state.json

         inotifywait filesystem events
                   │
                   ▼
         inotify-watch.service (systemd)
         inotify-watch.sh ──writes──> state.json
```

Event types: `TOOL_CALL`, `CLAUDE_ACCESS`, `QUEUE_CHANGE`, `OPENCODE_BOOT`, `STRESS`

---

## 8. Security Rules (from AGENTS.md)

**NEVER:**
- `echo $API_KEY`, `printenv | grep SECRET`, `grep "API_KEY" .env`
- `cat /srv/ops/secrets/*.env`
- Hardcode secrets in code

**SAFE Pattern:**
```bash
test -n "${VARIAVEL:-}" && echo "definida"
```

**Template vars:** `.env.example` with `${VAR_NAME}` pattern
**Real values:** `/srv/monorepo/.env` (gitignored)

---

## 9. Related Documentation

- `/srv/monorepo/CLAUDE.md` — Project-level CLAUDE.md
- `/srv/monorepo/AGENTS.md` — Nexus framework documentation
- `~/.claude/rules/anti-hardcoded-secrets.md` — Anti-hardcode rules
- `~/.claude/rules/cloudflare-secrets.md` — Cloudflare secrets rules
- `~/.claude/rules/language-convention.md` — Code EN / Docs PT-BR
- `/srv/monorepo/docs/CLI-RESEARCH/` — This directory