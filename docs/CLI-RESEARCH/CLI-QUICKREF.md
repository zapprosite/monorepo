# CLI Quick Reference — mclaude | swarm | nexus/vibe

| | **mclaude** | **swarm** | **nexus-ctl.sh / vibe-ctl.sh** |
|---|---|---|---|
| **Type** | Bun/TS CLI | Go binary | Bash scripts |
| **Location** | `mclaude` (PATH) | `/srv/monorepo/bin/swarm` | `/srv/monorepo/scripts/` |
| **Purpose** | Claude Code multi-provider launcher | HVAC agent swarm orchestrator | Nexus/vibe-kit autonomous loop control |

---

## 1. Command Comparison

### Install / Bootstrap

| Action | mclaude | swarm | nexus/vibe |
|---|---|---|---|
| Install | `bun install -g @leogomide/multi-claude` | Run from `/srv/monorepo/bin/swarm` (no install) | No install — run scripts directly |
| First run | Interactive TUI (no args) or `mclaude --provider <name>` | Requires Redis; auto-starts HTTP on `:8080` | `nexus-ctl.sh start` or `vibe-ctl.sh start` |
| Config | `~/.multi-claude/config.json` | Env vars + `config/agents.json` | `~/.claude/vibe-kit/` |

### Execution

| Action | mclaude | swarm | nexus/vibe |
|---|---|---|---|
| Run | `mclaude [--provider <name>] [--model <m>] [claude-code-flags...]` | `swarm` (background daemon) | `nexus-ctl.sh <cmd>` / `vibe-ctl.sh <cmd>` |
| Headless | `--provider <name> [--model <m>] [-c] [-p "query"]` | Runs as HTTP server; interact via `/webhook/*` | `nexus-auto.sh {loop\|single\|status}` |
| Interactive | `mclaude` (opens TUI) | Not interactive | `vibe.sh "<task>" [--dry-run]` |

### Config Files

| Action | mclaude | swarm | nexus/vibe |
|---|---|---|---|
| Config path | `~/.multi-claude/config.json` | Env vars + `SWARM_AGENTS_PATH` (default `config/agents.json`) | `~/.claude/vibe-kit/state.json`, `queue.json` |
| List config | `mclaude --list` (JSON) | `curl localhost:8080/health` | `nexus-ctl.sh status` / `vibe-ctl.sh status` |

### Status

| Action | mclaude | swarm | nexus/vibe |
|---|---|---|---|
| Status | `mclaude --version` | `curl localhost:8080/health` → `{"status":"ok"}` | `nexus-ctl.sh status` / `vibe-ctl.sh status` |
| Debug logs | `mclaude --logs [last\|tail]` | Log to stdout/stderr | `tail -f /srv/monorepo/logs/nexus-ctl.log` |

---

## 2. Environment Variables

### mclaude

| Variable | Description |
|---|---|
| `CLAUDE_API_KEY` | Override provider API key |
| `CLAUDE_CONFIG_DIR` | Config directory (default `~/.multi-claude/`) |
| `ANTHROPIC_API_KEY` | Passed through to Claude Code |

### swarm

| Variable | Default | Description |
|---|---|---|
| `REDIS_ADDR` | `localhost:6379` | Redis address |
| `REDIS_PASSWORD` | — | Redis auth password |
| `QDRANT_ADDR` | `localhost:6334` | Qdrant vector DB |
| `QDRANT_API_KEY` | — | Qdrant API key |
| `SWARM_HTTP_PORT` | `:8080` | HTTP listen address |
| `SWARM_AGENTS_PATH` | `config/agents.json` | Agents config file |
| `MINIMAX_API_KEY` | — | MiniMax API key for ranking agent |
| `GEMINI_API_KEY` | — | Gemini API key for classifier agent |
| `WHATSAPP_SECRET` | — | WhatsApp app validation secret |
| `WHATSAPP_TOKEN` | — | WhatsApp access token |
| `WHATSAPP_PHONE_ID` | — | WhatsApp phone ID |
| `STRIPE_SECRET_KEY` | — | Stripe billing key |
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token |
| `DEV_MODE` | — | Set to `true` to bypass API key requirements |

### nexus-ctl.sh / vibe-ctl.sh

| Variable | Default | Description |
|---|---|---|
| `MONOREPO` | `/srv/monorepo` | Monorepo root |
| `WORKER_ID` | `auto-<pid>` | Worker identifier in logs |
| `VIBE_PARALLEL` | — | Max parallel workers (env var checked by vibe-kit) |
| `MAX_WORKERS` | `8` | Max workers in nexus-auto.sh |

---

## 3. Worker Invocation Syntax

### mclaude — Claude Code Workers

```bash
# Interactive TUI
mclaude

# Headless with provider + model
mclaude --provider deepseek --model deepseek-chat -p "explain this"
mclaude --provider ollama --model llama3 -c          # -c = continue last conversation

# Specific installation
mclaude --provider anthropic --model opus-3 --installation work -p "build auth"

# Print mode only (no Claude Code spawn)
mclaude --provider deepseek -p "what models available"

# List all providers/models/installations (JSON)
mclaude --list

# Pass through to Claude Code
mclaude --provider ollama --model llama3 -- --debug  # extra flags after --
```

### swarm — Agent Workers

```bash
# Start daemon (Redis required)
swarm

# HTTP endpoints
POST   /webhook/whatsapp         WhatsApp inbound handler
GET    /webhook/whatsapp          WhatsApp verification challenge
GET    /health                   Health check → {"status":"ok"}
# Board routes (GET/POST) via swarm.BoardHandler (see config/agents.json)
```

### nexus-ctl.sh — Nexus Loop

```bash
nexus-ctl.sh start    # Start the Nexus autonomous loop
nexus-ctl.sh stop     # Stop the loop
nexus-ctl.sh status   # Show PID, queue depth, phase
nexus-ctl.sh restart  # Stop + start
nexus-ctl.sh reset    # Clear queue and state
nexus-ctl.sh help    # Show help
```

### vibe-ctl.sh — Vibe-Kit Loop

```bash
vibe-ctl.sh start    # Start the vibe-kit loop
vibe-ctl.sh stop     # Stop the loop
vibe-ctl.sh status   # Show PID, queue depth
vibe-ctl.sh restart  # Stop + start
vibe-ctl.sh reset    # Clear queue and state
vibe-ctl.sh help     # Show help
```

### nexus-auto.sh — Nexus Worker

```bash
nexus-auto.sh loop       # Run continuous autonomous loop (claim tasks from queue.json)
nexus-auto.sh single     # Claim and execute one task only, then exit
nexus-auto.sh status     # Print queue and state summary
```

### vibe.sh — Vibe Coding Loop

```bash
vibe.sh "<task description>"              # Classify intent → SPEC → Pipeline → Execute
vibe.sh "<task>" --dry-run                # Plan only, do not execute
vibe.sh --run --spec SPEC-123456           # Run existing SPEC from pipeline
vibe.sh --spec SPEC-123456                # Quick mode: load SPEC and execute pipeline
```

---

## 4. Common Flags

### mclaude

| Flag | Description |
|---|---|
| `-h`, `--help` | Show help message |
| `-v`, `--version` | Show version number |
| `--provider <name>` | Provider name/template ID/slug (headless mode) |
| `--model <model>` | Model to use |
| `--installation <name>` | Named installation to use |
| `--master-password <pw>` | Master password for encrypted credentials |
| `--list` | List providers, models, installations (JSON) |
| `--logs [last\|tail]` | Show debug log files |
| `-c`, `--continue` | Continue most recent conversation (Claude Code flag) |
| `-p "query"` | Print mode, non-interactive query (Claude Code flag) |
| `--debug` | Enable Claude Code debug mode |

### swarm

| Flag | Description |
|---|---|
| (no flags) | Starts HTTP server; daemon mode, no CLI flags |

### nexus-ctl.sh / vibe-ctl.sh

| Flag | Description |
|---|---|
| `help` | Show usage and command list |

### nexus-auto.sh

| Flag | Description |
|---|---|
| (positional) `loop\|single\|status` | Run mode |

### vibe.sh

| Flag | Description |
|---|---|
| `--dry-run` | Plan only, skip execution |
| `--run` | Execute without interactive prompts |
| `--spec <id>` | Use existing SPEC instead of generating |
| `--help` | Show usage examples |

---

## 5. Exit Codes

| CLI | Codes |
|---|---|
| mclaude | Standard shell (0 = success, 1 = error) |
| swarm | 0 on clean exit; crashes log to stderr |
| nexus-ctl.sh / vibe-ctl.sh | `0` success, `1` error, `2` unknown command |
| nexus-auto.sh | `0` success, non-zero = task failure |

---

## 6. Log Locations

| CLI | Log file |
|---|---|
| mclaude | `~/.multi-claude/logs/` or `mclaude --logs last` |
| swarm | stdout/stderr (systemd journal) |
| nexus-ctl.sh | `/srv/monorepo/logs/nexus-ctl.log` |
| vibe-ctl.sh | `/srv/monorepo/.claude/vibe-kit/logs/vibe-ctl.log` |
| nexus-auto.sh | `/srv/monorepo/logs/nexus-auto.log` |
| vibe.sh | `/srv/monorepo/logs/vibe-daemon.log` |

---

*Last updated: 2026-04-30*