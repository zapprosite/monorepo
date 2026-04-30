# CLI Compatibility Matrix

**Source:** CLI research + introspection  
**Date:** 2026-04-30  
**Status:** Complete

---

## Overview

Compatibility matrix comparing CLI features across **Claude Code** and **Codex CLI**.

---

## Feature Matrix

| Feature | Claude Code | Codex CLI |
|---------|:-----------:|:---------:|
| Parallel workers | **Full** | **None** |
| Rate limiting | **None** | **None** |
| Context reset per task | **Partial** | **Partial** |
| Queue operations | **Full** | **None** |
| Context isolation | **Full** | **Full** |
| Graceful shutdown | **Full** | **Partial** |
| Error recovery | **Full** | **Partial** |
| Notification on complete | **Full** | **None** |
| Deploy integration | **Full** | **Partial** |

---

## Feature Details

### Parallel Workers

| CLI | Support | Implementation |
|-----|---------|----------------|
| **Claude Code** | Full | `/execute` spawns 14 agents in parallel; Nexus/vibe-kit.sh supports up to `VIBE_PARALLEL=15` workers via `mclaude -p` |
| **Codex CLI** | None | No native parallel execution; `codex cloud exec` is experimental and not for local parallel workers |

### Rate Limiting

| CLI | Support | Implementation |
|-----|---------|----------------|
| **Claude Code** | None | No native rate limiting; external control via `VIBE_POLL_INTERVAL` throttle |
| **Codex CLI** | None | No rate limiting mechanism documented |

### Context Reset Per Task

| CLI | Support | Implementation |
|-----|---------|----------------|
| **Claude Code** | Partial | New session (`--reset`) or Nexus state manager tracks per-task context; ZFS snapshots every `VIBE_SNAPSHOT_EVERY=3` tasks |
| **Codex CLI** | Partial | `--ephemeral` flag for no session persistence; no per-task reset native |

### Queue Operations

| CLI | Support | Implementation |
|-----|---------|----------------|
| **Claude Code** | Full | Nexus queue managed via `state-manager.py`; `VIBE_WATCH_MODE` + inotifywait for filesystem-driven queue |
| **Codex CLI** | None | No queue system; single task execution only |

### Context Isolation

| CLI | Support | Implementation |
|-----|---------|----------------|
| **Claude Code** | Full | Per-session isolation; `settings.json` permissions; project trust levels; sandbox modes via hooks |
| **Codex CLI** | Full | Workspace trust levels (`trusted`/`untrusted`); sandbox modes (`read-only`, `workspace-write`, `danger-full-access`); project-level config |

### Graceful Shutdown

| CLI | Support | Implementation |
|-----|---------|----------------|
| **Claude Code** | Full | `VIBE_IDLE_COOLDOWN=180` auto-exit after idle; inotifywait-driven wake-up; ZFS snapshot on exit |
| **Codex CLI** | Partial | No auto-shutdown; `codex exec` returns when complete; no idle timeout |

### Error Recovery

| CLI | Support | Implementation |
|-----|---------|----------------|
| **Claude Code** | Full | `/retry` command; session resume; ZFS snapshots for rollback; `codex resume` equivalent |
| **Codex CLI** | Partial | `codex resume` for session resume; no automatic retry or snapshot-based rollback |

### Notification on Complete

| CLI | Support | Implementation |
|-----|---------|----------------|
| **Claude Code** | Full | `event-emit.sh` via PostToolUse hook; state-manager.py events; systemd notify support |
| **Codex CLI** | None | No native notification; hook system exists but not used for completion events |

### Deploy Integration

| CLI | Support | Implementation |
|-----|---------|----------------|
| **Claude Code** | Full | `/turbo` / `/ship` commands; PR creation to Gitea; autonomous deploy scripts under `autonomous-pipeline-v2/` |
| **Codex CLI** | Partial | `codex apply` for git apply; `codex cloud diff`; no native PR creation or deploy automation |

---

## Summary Table

| CLI | Parallel | Rate Limit | Context Reset | Queue | Isolation | Shutdown | Error Recovery | Notify | Deploy |
|-----|:--------:|:----------:|:-------------:|:-----:|:---------:|:--------:|:--------------:|:------:|:------:|
| **Claude Code** | ✅ Full | ❌ None | ⚠️ Partial | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Codex CLI** | ❌ None | ❌ None | ⚠️ Partial | ❌ None | ✅ Full | ⚠️ Partial | ⚠️ Partial | ❌ None | ⚠️ Partial |

---

## Recommendations

| Use Case | Recommended CLI |
|----------|-----------------|
| Multi-task parallel processing | **Claude Code** (Nexus framework) |
| Queue-driven autonomous pipeline | **Claude Code** (state-manager + vibe-kit) |
| Single task code review | **Codex CLI** (`codex review`) |
| Non-interactive exec in CI | **Codex CLI** (`codex exec --full-auto`) |
| Production deploy automation | **Claude Code** (`/turbo` + `/ship`) |
| Sandbox secure execution | **Codex CLI** (native sandbox modes) |

---

## References

- [Claude Code Research](./CLAUDE-CODE-RESEARCH.md)
- [Codex CLI Research](./CODEX-RESEARCH.md)
