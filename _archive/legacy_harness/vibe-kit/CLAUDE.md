# NEXUS AUTONOMOUS PIPELINE — VIBE-KIT

**YOU ARE IN AN AUTONOMOUS EXECUTION PIPELINE. READ THIS BEFORE ANY ACTION.**

---

## YOU MUST USE THESE COMMANDS

```bash
# Start the pipeline (REQUIRED before any work)
source /srv/monorepo/scripts/multi-cli-adapter.sh
nexus-ctl.sh start

# DO NOT use plain 'claude' or 'codex' or 'opencode' directly.
# All work MUST go through the queue system.
```

---

## ARCHITECTURE

```
Human → nexus-ctl.sh start → run-vibe.sh (lead)
                              ↓
                         queue.json
                              ↓
                    Workers (mclaude/codex/opencode)
                              ↓
                    smoke-runner.sh (verify)
                              ↓
                    notify-complete.sh (email)

# You are a WORKER. The lead assigns tasks via queue.json.
```

---

## WORKER RULES

| Rule | Description |
|------|-------------|
| **NO direct commits** | All work goes through queue → workers → PR |
| **ALWAYS use context-reset** | Before each task: `bash scripts/context-reset.sh <task_id>` |
| **ALWAYS verify** | After work: `bash scripts/smoke-runner.sh` |
| **NEVER carry context** | Each task gets fresh context, no memory from previous tasks |
| **RETRY on failure** | If smoke fails, retry up to 3x before reporting |

---

## QUICK COMMANDS

```bash
# Start pipeline
nexus-ctl.sh start

# Check status
nexus-ctl.sh status
vibe-ctl.sh status

# Manual queue operations
python3 .claude/vibe-kit/queue-manager.py stats
python3 .claude/vibe-kit/queue-manager.py claim <worker_id>

# Run tests
bash scripts/smoke-runner.sh
bash smoke-tests/stress-concurrent.sh

# Monitor
tail -f logs/nexus-*.log
```

---

## IF YOU DON'T USE THE QUEUE SYSTEM

You are working OUTSIDE the pipeline. This means:
- No tracking of work
- No retries on failure
- No verification
- No notifications

**The pipeline exists to ensure quality and reliability. Ignoring it causes chaos.**

---

## CLI MULTI-SUPPORT

This workspace supports multiple CLIs:

| CLI | Command | API Key |
|-----|---------|---------|
| **Claude Code** | `claude --dangerously-skip-permissions -p "..."` | `ANTHROPIC_API_KEY` |
| **Codex** | `codex -C /srv/monorepo --full-auto` | `OPENAI_API_KEY` |
| **OpenCode** | `opencode run --config .opencode.json` | `OPENCODE_API_KEY` |
| **mclaude** | `mclaude --provider minimax --model MiniMax-M2.7` | `MINIMAX_API_KEY` |

The `multi-cli-adapter.sh` auto-detects which CLI is running and sets up correctly.

---

## ERROR HANDLING

| Error | Action |
|-------|--------|
| Worker crashed | `queue-manager.py retry <task_id> <worker_id>` |
| Queue stuck | `nexus-ctl.sh restart` |
| Context overflow | `bash scripts/context-reset.sh <task_id>` |
| Rate limit hit | Wait 5min, reduce `VIBE_PARALLEL` |

---

## CONTEXT ISOLATION

Each task runs in ISOLATED context. Previous task context does NOT persist.

```
Task T001 → context/T001/ → (done) → Task T002 → fresh context
          ↓                     ↓
       no memory            no memory
```

---

## IF THIS IS YOUR FIRST TIME

1. `source /srv/monorepo/scripts/multi-cli-adapter.sh`
2. `nexus-ctl.sh start`
3. Watch workers spawn with `nexus-ctl.sh status`
4. Monitor logs with `tail -f logs/nexus-*.log`

---

## STANDARD BEHAVIOR (DO NOT DEVIATE)

1. CLAUDE.md is MANDATORY — this doc is always loaded first
2. Workers claim tasks from queue.json via queue-manager.py
3. Each task: claim → context-reset → execute → smoke-verify → complete
4. On smoke FAIL: retry up to 3x, then mark failed
5. On completion: notify-complete.sh sends email

**This is not optional. This is the protocol.**

---

*Nexus Autonomous Pipeline v2.0 — Q2 2026*
*Claude Code / Codex / OpenCode compatible*