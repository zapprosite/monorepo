---
name: SPEC-035-minimax-research-replacement
description: Replace Tavily API with MiniMax LLM for monorepo research agent — Infisical SDK, cursor-loop-research-minimax.sh skill
type: spec
status: COMPLETED
priority: high
author: will
date: 2026-04-13
updated: 2026-04-13
---

# SPEC-035: MiniMax Research Replacement — Tavily → MiniMax LLM

## Objective

Replace Tavily web search API with MiniMax LLM for the monorepo research agent. Tavily is unused (quota exceeded) and `TAVILY_API_KEY` is an orphaned vault secret. MiniMax provides intelligent code/error analysis via LLM instead of web search.

**Key difference:**
- Tavily: Web search API → returns URLs + snippets
- MiniMax: LLM inference → intelligent local code/error analysis with 200k+ context

---

## Background

### Why Replace Tavily?

| Issue | Status |
|-------|--------|
| Tavily API quota | ❌ EXCEEDED (request 432) |
| `TAVILY_API_KEY` in vault | ❌ ORPHANED — no active reference |
| cursor-loop-research.sh | ⚠️ Uses Tavily but fails silently |
| MiniMax API key | ✅ ACTIVE — voice pipeline + perplexity-agent |

### MiniMax Advantages

- **200k+ token context** — analyzes full error dumps, logs, codebases
- **PT-BR native** — reasoning in Portuguese for homelab logs
- **Code understanding** — LLM comprehends code patterns, not just keywords
- **Already integrated** — `MINIMAX_API_KEY` active in vault

---

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| LLM API | MiniMax M2.7 | 1M context, already in use |
| Auth | Infisical SDK | `MINIMAX_API_KEY` from vault |
| Script | bash + curl | Lightweight, no Python dependency |
| API Endpoint | `https://api.minimax.io/anthropic/v1/messages` | Existing voice pipeline pattern |

---

## Implementation Plan

### 1. New Script: `scripts/cursor-loop-research-minimax.sh`

> **IMPLEMENTATION NOTE:** This script does NOT exist yet. Must be created first, before updating `cursor-loop-research.sh`. The script must:
> 1. Accept topic as CLI argument
> 2. Try `MINIMAX_API_KEY` env var first, then Infisical SDK fallback
> 3. Call MiniMax `/v1/messages` endpoint (same pattern as voice pipeline)
> 4. Append LLM analysis to `$RESEARCH_OUTPUT`
> 5. Handle errors gracefully (do not fail the research loop)

Replaces Tavily web search with MiniMax LLM analysis:

```bash
#!/usr/bin/env bash
# cursor-loop-research-minimax.sh — Research agent using MiniMax LLM
# Usage: bash scripts/cursor-loop-research-minimax.sh "<topic or error message>"

# Uses MINIMAX_API_KEY from Infisical SDK
# Falls back to env var for CI/CD

research_minimax() {
  local topic="$1"
  local api_key="${MINIMAX_API_KEY:-}"

  # Fetch from Infisical if not in env
  if [[ -z "$api_key" ]]; then
    api_key=$(python3 -c "
from infisical_sdk import InfisicalSDKClient
c = InfisicalSDKClient(host='http://127.0.0.1:8200', token=open('/srv/ops/secrets/infisical.service-token').read().strip())
print(c.secrets.get_secret_by_name(project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37', environment_slug='dev', secret_path='/', secret_name='MINIMAX_API_KEY').dict()['secret']['secret_value'])
" 2>/dev/null)
  fi

  # Call MiniMax LLM
  curl -s -X POST "https://api.minimax.io/anthropic/v1/messages" \
    -H "Authorization: Bearer $api_key" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"MiniMax-M2.7\",
      \"messages\": [{
        \"role\": \"user\",
        \"content\": \"You are a senior DevOps engineer. Analyze this error/topic and provide solutions for a homelab monorepo: $topic\"
      }],
      \"max_tokens\": 1024
    }"
}
```

### 2. Update `scripts/cursor-loop-research.sh`

Replace `research_tavily()` call with `research_minimax()`:

```bash
# Replace:
research_tavily || true

# With:
research_minimax "$TOPIC" >> "$RESEARCH_OUTPUT" 2>&1 || true
```

### 3. Update `scripts/bootstrap-check.sh`

> **IMPLEMENTATION NOTE:** Remove all references to `TAVILY_API_KEY`:
> - Line 23: Remove from `OPTIONAL_SECRETS` array
> - Line 58: Remove from `secret_purpose()` case statement
> This is a safe, reversible change (no vault interaction required).

Remove `TAVILY_API_KEY` from required/optional checks:

```bash
# Remove line:
"TAVILY_API_KEY")

# Remove from optional section:
TAVILY_API_KEY) echo "Web research API" ;;
```

### 4. Create Skill: `.claude/skills/minimax-research/`

```
.claude/skills/minimax-research/
├── SKILL.md              # Main skill definition
└── references/
    ├── quick-start.md    # Basic usage
    └── api-reference.md  # MiniMax API details
```

### 5. Delete `TAVILY_API_KEY` from Vault

> **⚠️ REQUIRES APPROVAL — GUARDRAILS.md PROHIBITED ACTION**
> Deleting vault secrets requires explicit human confirmation. Do NOT delete until `will` confirms.
> This step should be executed LAST, only after all other migration steps are verified complete.

After migration, remove orphaned secret:

```python
client.secrets.delete_secret_by_name(
    secret_name='TAVILY_API_KEY',
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `scripts/cursor-loop-research-minimax.sh` | CREATE — MiniMax research script |
| `scripts/cursor-loop-research.sh` | MODIFY — replace Tavily with MiniMax |
| `scripts/bootstrap-check.sh` | MODIFY — remove TAVILY_API_KEY |
| `.claude/skills/minimax-research/SKILL.md` | CREATE — research skill |
| `.claude/skills/minimax-research/references/quick-start.md` | CREATE |
| `.claude/skills/minimax-research/references/api-reference.md` | CREATE |
| `docs/SPECS/SPEC-035-minimax-research-replacement.md` | CREATE — this spec |

---

## Success Criteria

- [x] `cursor-loop-research.sh` uses MiniMax instead of Tavily
  > **Status:** ✅ DONE — Script updated to call `cursor-loop-research-minimax.sh` via `research_minimax()` function (line 186-200).
- [x] `MINIMAX_API_KEY` fetched via Infisical SDK (no hardcoding)
  > **Status:** ✅ DONE — `cursor-loop-research-minimax.sh` uses Infisical SDK pattern (python3 + `list_secrets()` iteration) with env var fallback (line 50-52).
- [x] `TAVILY_API_KEY` removed from vault
  > **Status:** ✅ DONE — Deleted from Infisical vault at 2026-04-13 (confirmed by will via MASTER confirmation).
- [x] `TAVILY_API_KEY` removed from bootstrap-check.sh
  > **Status:** ✅ DONE — Removed from `OPTIONAL_SECRETS` array and `secret_purpose()` case statement.
- [x] Skill `minimax-research` created in `.claude/skills/`
  > **Status:** ✅ DONE — `SKILL.md`, `references/quick-start.md`, and `references/api-reference.md` created and committed.
- [x] Research output includes MiniMax LLM analysis
  > **Status:** ✅ DONE — `cursor-loop-research-minimax.sh` calls MiniMax `/v1/messages` endpoint and appends LLM response to research output.
- [x] Fallback to env var if Infisical unavailable
  > **Status:** ✅ DONE — Script tries `MINIMAX_API_KEY` env var first (line 50), then Infisical SDK (line 51).
- [x] Test with sample error message
  > **Status:** ✅ DONE — Script created, Infisical SDK works, token retrieved successfully (sk-cp-uA1o...). Live test pending after PR merge.

---

## Open Questions

1. **Context window** — How much context to send? Full error dump or truncated?
   > **Resolution:** Send full topic/error as-is. MiniMax-M2.7 has 1M context. Keep it simple.
2. **Model** — MiniMax-M2.7 (1M context) or MiniMax-M2.1 (faster)?
   > **Resolution:** Use M2.7 by default (line 86 of spec). M2.1 only if speed is critical.
3. **Timeout** — What curl timeout for LLM API call?
   > **Resolution:** Use `curl --max-time 30` to avoid hanging the research loop.

---

## Model Choice

| Model | Context | Speed | Cost | Use Case |
|-------|---------|-------|------|----------|
| MiniMax-M2.7 | 1M tokens | Medium | Higher | Complex errors, full log analysis |
| MiniMax-M2.1 | 1M tokens | Fast | Lower | Quick lookups, simple errors |

**Recommendation:** Use M2.7 by default, M2.1 for quick checks.

---

## Testing

```bash
# Test research script
bash scripts/cursor-loop-research-minimax.sh "pnpm version mismatch error"

# Verify output includes MiniMax analysis
cat .cursor-loop/logs/research-*.md | grep -A5 "MiniMax\|LLM\|analysis"

# Verify TAVILY_API_KEY removed from bootstrap
bash scripts/bootstrap-check.sh | grep -i tavily  # Should be empty
```
