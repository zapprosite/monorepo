---
name: audit-workflow
description: Audit trail for AI tool workflow — list recent executions, health status, and audit log entries. Part of SPEC-001 workflow performatico.
trigger: /audit-workflow
owner: will-zappro
---

# Skill: /audit-workflow

Lists the last 50 workflow audit log entries from `~/.claude/audit/workflow-*.jsonl`.

## Usage

```
/audit-workflow
```

## Output Format

```
=== Audit Log: workflow-performatico ===
Last 50 entries (newest first):

[YYYY-MM-DD HH:MM:SS] tool: CLAUDE_CODE_CLI | action: feature-commit | result: success | commit: abc123 | branch: feature/foo
[YYYY-MM-DD HH:MM:SS] tool: OPENCODE_CLI    | action: deploy        | result: success | ...
...

Total: N entries
```

## Script Location

`~/.claude/skills/audit-workflow/audit.sh`

## Files Checked

- `~/.claude/audit/workflow-*.jsonl` (glob pattern)
- Created by: `workflow-performatico` skill suite

## Verification

```bash
ls ~/.claude/audit/workflow-*.jsonl
```

If no files exist, the output will indicate that no audit entries have been recorded yet.

## Health Check

Before listing audit entries, the skill checks health of all 3 tools:

| Tool | Check | Status |
|------|-------|--------|
| Claude Code CLI | `claude --version` | ✅ found / ❌ not found |
| OpenCode CLI | `opencode --version` | ✅ found / ❌ not found |
| OpenClaw | `curl -sf http://localhost:8080/health` | ✅ UP / ❌ DOWN |

If OpenClaw is DOWN, a warning is shown with instructions to check the container.
