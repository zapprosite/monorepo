#!/bin/bash
# generate-tree.sh — Generate monorepo TREE.md for hermes-second-brain
# SPEC-091: Tier 2 second brain — monorepo TREE.md (<500 lines)

set -euo pipefail

# Validate running from monorepo root
if [[ ! -f "/srv/monorepo/AGENTS.md" ]]; then
    echo "ERROR: Must run from /srv/monorepo/ or with absolute path"
    exit 1
fi

OUTPUT="${1:-monorepo-TREE.md}"
# Normalize path: realpath on parent dir + filename
if [[ "$OUTPUT" = /* ]]; then
    OUTPUT="$(dirname "$OUTPUT")/$(basename "$OUTPUT")"
else
    OUTPUT="$(pwd)/$OUTPUT"
fi
MAX_LINES=500

# Header
cat > "$OUTPUT" << 'HEADER'
---
type: tree
name: monorepo-TREE
description: Machine-readable monorepo structure for hermes-second-brain
generated: 2026-04-20
status: filled
---

# Monorepo Tree

**Generated:** 2026-04-20
**Purpose:** Second-brain TREE.md — concise overview, not full docs

## Stack

| Layer | Tech | Port |
|-------|------|------|
| Backend API | Fastify + tRPC + Orchid ORM | :3000 |
| Frontend | React 19 + MUI + tRPC | :5173 |
| AI Gateway | OpenAI-compatible facade | :4002 |
| LLM Primary | MiniMax-M2.7 | — |
| LLM Fallback | llama3-portuguese-tomcat-8b | — |
| Vision | qwen2.5vl:7b (Ollama) | :11434 |
| TTS | Kokoro (:8013) → TTS Bridge | — |
| STT | whisper-medium-pt (:8204) | — |
| Vector DB | Qdrant | :6333 |
| Agent | Hermes Gateway | :8642 |

## Directory Structure

```
/
├── apps/
│   ├── api/              # Fastify + tRPC backend
│   └── ai-gateway/        # OpenAI-compatible facade (SPEC-047)
├── packages/
│   └── circuit-breaker/  # Circuit breaker impl (SPEC-068)
├── docs/                  # Canonical docs (SPEC-091 prune target)
│   ├── SPECS/             # Feature specs
│   ├── ADRs/              # Architecture decisions
│   ├── GUIDES/            # How-to guides
│   └── archive/           # Archived docs (SPEC-091)
├── scripts/               # Operational scripts
│   ├── sync-second-brain.sh
│   ├── generate-tree.sh   # This script
│   └── prune-docs.sh
├── tasks/                 # TaskMaster pipeline
├── smoke-tests/           # Smoke tests
└── .claude/              # Claude Code config + skills
```

## Active SPECs

| SPEC | Title | Status |
|------|-------|--------|
| 050 | Network & Port Governance | codified |
| 068 | Circuit Breaker | codified |
| 074 | Hermes Second Brain | active |
| 090 | Orchestrator v3 | active |

## Key Scripts

| Script | Purpose |
|--------|---------|
| `scripts/sync-second-brain.sh` | Sync to hermes-second-brain via Gitea |
| `scripts/generate-tree.sh` | Generate this TREE.md |
| `scripts/prune-docs.sh` | Prune dead SPECs (dry-run) |
| `smoke-tests/smoke-env-secrets-validate.sh` | Validate .env secrets |

## Ports (Canonical)

Reserved: :3000 (Open WebUI), :4000 (LiteLLM), :4002 (ai-gateway), :8000 (Coolify), :8080 (Open WebUI Coolify), :8642 (Hermes), :6333 (Qdrant)

Free: :4002-4099 (microservices), :5173 (Vite)

## Secrets (.env canonical)

- `AI_GATEWAY_FACADE_KEY`
- `LITELLM_MASTER_KEY`
- `TTS_BRIDGE_URL`, `STT_DIRECT_URL`
- `HERMES_API_KEY`, `HERMES_GATEWAY_URL`
- `CLOUDFLARE_API_TOKEN`, `COOLIFY_API_KEY`
- `GITEA_ACCESS_TOKEN`

## Smoke Tests

```bash
# Run all smoke tests
bash smoke-tests/run-all.sh

# Individual
bash smoke-tests/smoke-env-secrets-validate.sh
```

## Last Sync

TREE.md generated 2026-04-20 via SPEC-091 prune. Next auto-sync: cron `614f0574` (every 30 min).
HEADER

# Count lines
LINE_COUNT=$(wc -l < "$OUTPUT")
echo "Generated $OUTPUT with $LINE_COUNT lines"

if [ "$LINE_COUNT" -gt "$MAX_LINES" ]; then
    echo "WARNING: TREE.md exceeds $MAX_LINES lines ($LINE_COUNT lines)"
    exit 1
fi

echo "OK: TREE.md is within $MAX_LINES line limit"
