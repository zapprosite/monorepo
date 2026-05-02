# Hermes Consolidation — 2026-04-25

## Overview

Hermes lives in `~/.hermes/` (external) with symlink at `/srv/monorepo/hermes/`.

## Structure

```
~/.hermes/                    # Real location (287MB)
├── agents/                   # Agent configs (CORE)
├── brain/                    # Brain/memory (CORE)
├── hermes-agent/             # Main agent code (CORE)
├── config.yaml               # Config (CORE)
├── state.db                  # SQLite state (CORE)
├── sessions/                 # 20K sessions (CORE)
├── skills/                   # 73 skills (CORE)
├── mcps-servers/             # MCP server integrations
├── mcps/                     # MCP configs
├── mem0-data/                # Mem0 vector memory
├── audio_cache/              # Audio cache (CLEANUP)
├── image_cache/              # Image cache (CLEANUP)
├── logs/                     # Logs (ARCHIVE)
└── memories/                  # Memory files

## Symlink

```
/srv/monorepo/hermes/ -> /home/will/.hermes/
```

## Monorepo Integration

| Path | Description |
|------|-------------|
| `/srv/monorepo/hermes/` | Access Hermes files |
| `/srv/monorepo/mcps/mcp-memory/` | MCP memory server |
| `~/.hermes/mem0-data/` | Mem0 vectors |

## Decision

Keep Hermes data in `~/.hermes/` (not move to monorepo) because:
1. 287MB of data doesn't belong in monorepo git repo
2. State DB is SQLite (not git-friendly)
3. Sessions directory is volatile

Only create symlink for interface access.

## Cleanup Recommendations

| Item | Action | Reason |
|------|--------|--------|
| audio_cache/ | Archive/clean | Can regen |
| image_cache/ | Archive/clean | Can regen |
| logs/ | Archive | Not critical |
| *.bak, *.tmp | Delete | Temp files |
