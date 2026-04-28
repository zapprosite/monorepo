# Nexus ↔ Hermes Second Brain Flow

**Status:** Active
**Updated:** 2026-04-28

## Overview

Nexus uses Hermes Second Brain as the persistent memory layer during PREVC workflow execution. The flow defines how context is fetched before tasks, packed during execution, and written back after completion.

## Architecture

```
Nexus (monorepo)                  Hermes Second Brain (separate repo)
┌─────────────────────┐           ┌─────────────────────────────────┐
│  PREVC Workflow     │           │  Memory Layer                   │
│  P → R → E → V → C  │◄─────────►│  Mem0 API (:8642)              │
│                     │  context  │  Qdrant (:6333)                │
│  vibe-kit workers   │  fetch/   │  Ollama (:11434)               │
│  (15× mclaude)     │  pack     │  Redis (:6379)                 │
└─────────────────────┘           └─────────────────────────────────┘
         │                                      │
         └──────────────┐  ┌────────────────────┘
                        ▼  ▼
              ┌─────────────────────┐
              │  Qdrant collection   │
              │  claude-code-memory  │
              │  (Gen5 NVMe /tank)  │
              └─────────────────────┘
```

## PREVC ↔ Memory Integration

### Phase P — Plan

```
Action: context_fetch
Method: Query Qdrant collection "claude-code-memory" for relevant memories
Output: Concise memory snippet injected into task context
CLI:   curl -s -H "api-key: $QDRANT_API_KEY" http://localhost:6333/collections/claude-code-memory/points/search \
        -d '{"vector": [embedding], "limit": 5, "score_threshold": 0.7}'
```

Nexus queries Hermes for:
- Prior art on similar specs/features
- Previous decisions and ADRs
- Agent session history

### Phase R — Review

```
Action: context_pack
Method: Archive review findings to "second-brain" collection
Output: Decision records, risk assessments
```

Review agents write back:
- Feasibility assessments
- Risk flags
- Dependency graph

### Phase E — Execute

```
Action: context_pack (ongoing)
Method: Append task completions to "claude-code-memory"
Output: Task artifacts, code snippets, test results
```

Workers write to memory:
- Completed task summaries
- Rejected approaches and why
- Key decisions made during execution

### Phase V — Verify

```
Action: result_summary
Method: Fetch execution memory, diff with expectations
Output: Verification report
```

Nexus retrieves:
- What was planned vs what was delivered
- Gaps identified by test agents
- Performance benchmarks

### Phase C — Complete

```
Action: memory_writeback
Method: Final sync to "claude-code-memory" + "second-brain"
Output: Full session summary, tagged and searchable
```

Archived:
- Spec number and title
- All tasks completed/failed
- Files changed
- Deployment status

### Phase Ship — Context Sync

```
Action: context_sync
Method: MCP dotcontext artifact export + Hermes writeback
Target: monorepo-context Qdrant collection + Mem0
```

## Collections Used

| Collection | Purpose | Read | Write |
|-----------|---------|------|-------|
| `claude-code-memory` | Nexus session memory | Nexus | Nexus |
| `second-brain` | Knowledge graph | Nexus | Nexus |
| `monorepo-context` | Full-text search index | Nexus | ai-context-sync |
| `will` | Personal agent memories | All agents | All agents |

## Security Boundaries

- **Public:** README, SOUL.md, CLAUDE.md, pyproject.toml, libs/, skills/
- **Private:** .env, secrets/, data/, qdrant_storage/, tasks.db, logs/
- **Gitignored:** All runtime data, memory exports, backups

## Health Check

```bash
# Verify Hermes is reachable
curl -sf http://localhost:8642/health || echo "Hermes down"

# Verify Qdrant collections
curl -sf -H "api-key: $QDRANT_API_KEY" \
  http://localhost:6333/collections | \
  jq '.result.collections[].name'

# Verify memory writes
curl -sf -H "api-key: $QDRANT_API_KEY" \
  http://localhost:6333/collections/claude-code-memory/points/search \
  -d '{"vector": [0.1]*1536, "limit": 1}' | \
  jq '.result[] | .id, .score'
```

## File Reference

| File | Role |
|------|------|
| `hermes-second-brain/SOUL.md` | Security & architecture principles |
| `hermes-second-brain/CLAUDE.md` | Agent onboarding for memory layer |
| `hermes-second-brain/skills/librarian/SKILL.md` | Memory operations skill |
| `hermes-second-brain/libs/subagents/` | Memory archivist, collection manager |
| `.claude/vibe-kit/nexus.sh` | Nexus entry point |
| `.claude/vibe-kit/queue.json` | Task queue (ephemeral) |
