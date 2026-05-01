# SPEC-POLYMER-007 — Legacy Prune Report
**Status:** ACTIVE
**Date:** 2026-05-01
**Scope:** Full homelab legacy audit

---

## LEGACY ITEM: Gemma4-26b

### Reality
- **Ollama:** `ollama list` shows gemma4 does NOT exist
- **Memory said:** gemma4:26b-q4 was "stress tested" on 2026-04-22
- **Truth:** It was NEVER pulled to Ollama — just a local file test that failed
- **VRAM claim:** 22GB stable — fabricated from non-existent model

### References Found (MUST REPLACE)

| File | Line | Legacy | Replacement |
|------|------|--------|-------------|
| `scripts/test-llm-providers.ts` | model: 'gemma4-12b-it' | gemma4 | `qwen2.5:3b` |
| `scripts/vibe.sh` | --arg model "gemma4:latest" | gemma4 | `qwen2.5:3b` |
| `.env.example` | OLLAMA_VISION_MODEL=gemma4 | gemma4 | `qwen2.5vl:3b` |
| `apps/painel-organism/dist/...index-XXX.js` | gemma4 in bundle | gemma4 | `qwen2.5vl:3b` |
| `apps/painel-organism/src/App.jsx` | description text | gemma4 | `qwen2.5vl:3b` |
| `.claude/skills/orchestrator/scripts/track_cost.sh` | "gemma4-12b-it" | gemma4 | `qwen2.5:3b` |
| `.claude/skills/orchestrator/scripts/model_fallback.sh` | "gemma4-12b-it" | gemma4 | `qwen2.5:3b` |
| `.pytest_cache/v/cache/lastfailed` | test_chat_completions_gemma4_26b_q4 | gemma4 | DELETE (test for non-existent model) |

### Replacement Rule
```
gemma4 → qwen2.5:3b  (text only, 1.9GB)
gemma4:3b → qwen2.5:3b (same)
gemma4-12b-it → qwen2.5:3b (closest available)
```

---

## LEGACY ITEM: keep-gemma-warm.sh

### Reality
- **File:** `/home/will/keep-gemma-warm.sh` — PID 1775007 mentioned in memory
- **Truth:** Script exists but gemma4 doesn't → orphan/meaningless
- **VRAM claim:** 22GB — never used

### Action
- DELETE: `/home/will/keep-gemma-warm.sh`
- Reference to remove: SOUL.md memory entry

---

## LEGACY ITEM: Port 3999 (qwen2-vl7b)

### Reality
- **Port 3999:** Nothing listening
- **Memory said:** "qwen2-vl7b container on port 3999"
- **Truth:** Container was NEVER deployed, just planned

### Action
- No file references found for port 3999 in actual code
- Remove from memory if referenced

---

## LEGACY ITEM: whisper-server-v2.py

### Reality
- **Memory said:** "whisper-server-v2.py :8204 — LEGACY, superseded by faster-whisper-server native process"
- **Status:** Already marked legacy in memory
- **Actual:** faster-whisper-server running on 8204 (native process)

### Action
- Already handled — just ensure no code references the old script

---

## LEGACY ITEM: zappro.ia.gmail.com

### Reality
- **DNS:** SERVFAIL — gmail.com zone not managed by Cloudflare
- **Truth:** Domain doesn't exist and can never work
- **References:** Must search and remove

### Action
- DELETE all references to `zappro.ia.gmail.com`
- This is a permanent breakage, not a model substitution

---

## LEGACY ITEM: vibe-coding-loop / auto-star

### Reality
- **Memory said:** "vibe-coding-loop/ and auto-star/ do NOT exist"
- **vibe.sh:** EXISTS at `/srv/monorepo/scripts/vibe.sh` — REAL but references gemma4
- **auto-star:** Only in `~/.local/share/ai-shortcuts/star/` — not in monorepo

### Action
- vibe.sh: Fix gemma4 reference → qwen2.5:3b
- auto-star: Leave alone (not in scope)

---

## LEGACY ITEM: Port 8013

### Reality
- **Port 8013:** Nothing listening
- **tts-edge.sh:** References port 8013 but TTS is on 8012 via Docker
- **tts-edge.py:** Uses port 8013 in curl command

### Replacement
```
Port 8013 → 8012 (zappro-edge-tts Docker)
```

### Files to Fix
- `~/.hermes/scripts/tts-edge.sh` — port 8013 → 8012
- `~/.hermes/scripts/tts-edge.py` — port 8013 → 8012

---

## LEGACY ITEM: qwen2-vl7b Container

### Reality
- **Memory said:** "container qwen2-vl7b — LEGADO (modelo roda direto no Ollama)"
- **Truth:** Never deployed

### References Found
- None in actual code

### Action
- Remove from memory docs if referenced

---

## LEGACY ITEM: SPEC-099/105 Drafts

### Reality
- **Memory said:** "SPEC-099/105 drafts never implemented"
- **vibe.sh script:** references do not exist

### Action
- No action needed — just don't implement drafts that were abandoned

---

## Summary Table

| Legacy Item | Replace With | Files Affected |
|-------------|--------------|----------------|
| gemma4 | qwen2.5:3b | 7 files |
| keep-gemma-warm.sh | DELETE | 1 file |
| port 3999 | none (unused) | 0 files |
| whisper-server-v2.py | faster-whisper-server | already marked |
| zappro.ia.gmail.com | DELETE / N/A | tbd |
| vibe.sh (gemma4 ref) | qwen2.5:3b | 1 file |
| port 8013 | 8012 | 2 files |
| qwen2-vl7b container | not needed (Ollama direct) | 0 files |

---

## Execute Prune

```bash
# 1. Fix gemma4 → qwen2.5:3b in all files
sed -i 's/gemma4-12b-it/qwen2.5:3b/g' /srv/monorepo/scripts/test-llm-providers.ts
sed -i 's/gemma4:latest/qwen2.5:3b/g' /srv/monorepo/scripts/vibe.sh
sed -i 's/gemma4/qwen2.5vl:3b/g' /srv/monorepo/.env.example

# 2. Delete orphan script
rm -f /home/will/keep-gemma-warm.sh

# 3. Fix TTS port
sed -i 's/:8013/:8012/g' ~/.hermes/scripts/tts-edge.sh
sed -i 's/:8013/:8012/g' ~/.hermes/scripts/tts-edge.py

# 4. Delete failed gemma4 test from pytest cache
find /srv/monorepo/.pytest_cache -name "*.py" -exec sed -i '/gemma4/d' {} \;
```
