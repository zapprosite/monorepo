# SPEC-SPEC-AUTOMATOR — Automatic SPEC → Deploy Pipeline

**Date:** 2026-04-12
**Status:** IN_PROGRESS
**Type:** System Infrastructure

---

## Objective

Zero-touch pipeline: user creates `/auto-spec [idea]`, system does EVERYTHING else:

- Create SPEC from idea
- Run `/pg` to generate tasks
- AI chooses loop (/computer-loop fast vs /cursor-loop enterprise)
- AI executes all tasks
- AI commits, pushes, creates PR
- AI syncs to memory
- AI runs `/clear` (terminal cleanup)
- AI creates new random branch
- System ready for next SPEC

**User does ONE thing: write the SPEC idea.**

---

## System Architecture

```
/auto-spec [idea]
    ↓
[auto-spec wrapper]
    ↓
Creates SPEC-*.md from idea
    ↓
[Claude Code CLI - AI decides]
    ↓
Reads SPEC → complexity score → chooses loop
    ↓
[Loop Executed by AI]
    ↓
[Completion Handler]
    → commit → push → PR → sync → /clear → new branch
```

---

## Components

### 1. auto-spec Command

- File: `.claude/commands/auto-spec.md`
- Creates SPEC from user prompt
- Triggers main orchestrator

### 2. spec-automator.sh

- Main orchestrator script
- Coordinates all phases
- Runs context-monitor in background
- Handles completion

### 3. context-monitor.sh

- Background process
- Checks context usage every 30s
- At 70%: sync to memory
- At 90%: checkpoint + sync + /clear

### 4. completion-handler.sh

- Runs after successful loop
- Executes: commit + push + PR + sync + /clear + new branch
- Called by spec-automator.sh on success

---

## Loop Selection Logic

Claude Code CLI (AI) reads SPEC and decides:

| Complexity Score | Loop                        | Reason                     |
| ---------------- | --------------------------- | -------------------------- |
| 0-30 (simple)    | `/computer-loop --fast`     | 1 task, no pg needed       |
| 31-60 (medium)   | `/computer-loop --standard` | Multiple tasks, pg needed  |
| 61+ (complex)    | `/cursor-loop --enterprise` | Full pipeline, checkpoints |

**AI decision is autonomous — no script forces it.**

### Complexity Score Calculation

```
score = 0
score += new_files_count * 2
score += new_services_count * 15       # containers, docker, zfs
score += breaking_changes_count * 20
score += test_required_boolean * 10
score += infra_changes_count * 15       # network, ports
score += security_sensitive_boolean * 15
score += new_dependencies_count * 8

# AI evaluates content of SPEC to estimate
# This is judgment call by the AI model itself
```

---

## Context Budget Monitor

### Thresholds

| Context Usage | Action                   |
| ------------- | ------------------------ |
| > 70%         | Sync to memory (backup)  |
| > 90%         | Full checkpoint + /clear |

### Implementation

Background script running every 30s:

```bash
# Monitor context
if [ "$context_pct" -gt 90 ]; then
    save_checkpoint()
    sync_to_memory()
    /clear  # clear Claude Code CLI
elif [ "$context_pct" -gt 70 ]; then
    sync_to_memory()
fi
```

### /clear Authorization

User explicitly authorizes `/clear` in this SPEC:

> **MASTER AUTHORIZATION:** System may call `/clear` automatically when context > 90% to optimize performance. This keeps the CLI responsive.

---

## Completion Handler

On successful loop completion:

```bash
# 1. Commit all changes
git add -A
git commit -m "[feat/auto]: $(description from SPEC)"

# 2. Push
git push --force-with-lease origin HEAD

# 3. Create PR (if not main branch)
if [ "$(git branch --show-current)" != "main" ]; then
    gh pr create --title "[auto] $(description)" --body "Auto-generated PR from SPEC"
fi

# 4. Sync AI-CONTEXT
bash /home/will/.claude/mcps/ai-context-sync/sync.sh

# 5. /clear (Claude Code CLI cleanup)
echo "/clear" |克劳德 Code CLI

# 6. Create new random branch for next SPEC
NEW_BRANCH="feat/$(date +%s)-$(openssl rand -hex 3)"
git checkout -b $NEW_BRANCH

# 7. Report completion
echo "✅ Feature complete. Branch: $NEW_BRANCH"
```

---

## Random Branch Name

Format: `feat/TIMESTAMP-RANDOM`

Example:

- `feat/1712937600-a3f8b2`
- `feat/1712937722-9x7k4m`

Timestamp is Unix epoch, random is hex (8 chars).

---

## Error Handling

| Situation             | Action                              |
| --------------------- | ----------------------------------- |
| Loop fails            | Retry 3x, then notify human         |
| AI chooses wrong loop | Human can abort, manually intervene |
| /clear fails          | Log error, continue (non-blocking)  |
| PR creation fails     | Retry once, log, continue           |

---

## Files Created

| File                            | Purpose                    |
| ------------------------------- | -------------------------- |
| `.claude/commands/auto-spec.md` | Command wrapper            |
| `scripts/spec-automator.sh`     | Main orchestrator          |
| `scripts/context-monitor.sh`    | Background context watcher |
| `scripts/completion-handler.sh` | End-of-feature automation  |

---

## Success Criteria

- [ ] `/auto-spec [idea]` creates SPEC and triggers pipeline
- [ ] AI autonomously chooses correct loop complexity
- [ ] Loop executes without human intervention
- [ ] On success: commit + PR + sync + /clear + new branch
- [ ] System ready for next SPEC without manual steps

---

## User Authorization

> **MASTER AUTHORIZATION:**
> I authorize the spec-automator system to:
>
> 1. Automatically select loop complexity based on SPEC analysis
> 2. Execute full pipeline without pauses (except real failures)
> 3. Run `/clear` when context > 90% to maintain CLI performance
> 4. Create random branch names after each feature completion
>
> This authorization is granted by owner on 2026-04-12.
