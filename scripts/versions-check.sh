#!/usr/bin/env bash
# versions-check.sh — Detect drift between VERSION-LOCK.md and actual installed versions
# Part of: SPEC-071-V1 (VERSION LOCK ENTERPRISE)
# Exit code: 0 = no drift, 1 = drift detected

set -euo pipefail

LOCK_FILE="${1:-VERSION-LOCK.md}"
DRIFT=0

echo "=== Version Drift Detection ==="
echo "Lock file: $LOCK_FILE"
echo ""

# ── Parse VERSION-LOCK.md ────────────────────────────────────────────────────────

# Extract pinned versions from lock file using Python for reliable parsing
parse_lock() {
  python3 -c "
import re, sys
lock = open('$LOCK_FILE').read()
tools = {
    'TURBO':           r'\| Turbo\s+\|\s+([^\s|]+)',
    'PNPM':            r'\| pnpm\s+\|\s+([^\s|]+)',
    'CLAUDE':          r'\| Claude Code CLI\s+\|\s+([^\s|]+)',
    'TYPESCRIPT':      r'\| TypeScript\s+\|\s+([^\s|]+)',
    'BIOME':           r'\| Biome\s+\|\s+([^\s|]+)',
    'KOKORO':          r'\| Kokoro FastAPI\s+\|\s+([^\s|]+)',
}
for key, pattern in tools.items():
    m = re.search(pattern, lock)
    print(f'{key}=\"{m.group(1) if m else \"NOT_FOUND\"}\"')
"
}

eval "$(parse_lock)"
TURBO_PINNED="${TURBO:-NOT_FOUND}"
PNPM_PINNED="${PNPM:-NOT_FOUND}"
CLAUDE_PINNED="${CLAUDE:-NOT_FOUND}"
TYPESCRIPT_PINNED="${TYPESCRIPT:-NOT_FOUND}"
BIOME_PINNED="${BIOME:-NOT_FOUND}"
KOKORO_PINNED="${KOKORO:-NOT_FOUND}"

# ── Check Turbo ─────────────────────────────────────────────────────────────────

echo "Checking Turbo..."
TURBO_ACTUAL=$(pnpm exec turbo --version 2>/dev/null | awk '{print $1}' || echo "NOT_INSTALLED")
if [[ "$TURBO_ACTUAL" != "$TURBO_PINNED" ]]; then
  echo "  DRIFT: turbo $TURBO_ACTUAL (pinned: $TURBO_PINNED)"
  DRIFT=1
else
  echo "  OK: turbo $TURBO_ACTUAL"
fi

# ── Check pnpm ──────────────────────────────────────────────────────────────────

echo "Checking pnpm..."
PNPM_ACTUAL=$(pnpm --version 2>/dev/null || echo "NOT_INSTALLED")
if [[ "$PNPM_PINNED" == "9.0.x" ]]; then
  if [[ "$PNPM_ACTUAL" == 9.* ]]; then
    echo "  OK: pnpm $PNPM_ACTUAL (pinned: $PNPM_PINNED)"
  else
    echo "  DRIFT: pnpm $PNPM_ACTUAL (pinned: $PNPM_PINNED)"
    DRIFT=1
  fi
elif [[ "$PNPM_ACTUAL" != "$PNPM_PINNED" ]]; then
  echo "  DRIFT: pnpm $PNPM_ACTUAL (pinned: $PNPM_PINNED)"
  DRIFT=1
else
  echo "  OK: pnpm $PNPM_ACTUAL"
fi

# ── Check Claude Code CLI ───────────────────────────────────────────────────────

echo "Checking Claude Code CLI..."
if command -v claude &>/dev/null; then
  CLAUDE_ACTUAL=$(claude --version 2>/dev/null | awk '{print $1}' || echo "UNKNOWN")
else
  CLAUDE_ACTUAL="NOT_INSTALLED"
fi
if [[ "$CLAUDE_ACTUAL" == "NOT_INSTALLED" ]] || [[ "$CLAUDE_ACTUAL" == "UNKNOWN" ]]; then
  echo "  DRIFT: claude $CLAUDE_ACTUAL (pinned: $CLAUDE_PINNED)"
  DRIFT=1
else
  # Major.minor comparison
  PIN_MAJOR_MINOR=$(echo "$CLAUDE_PINNED" | cut -d. -f1-2)
  ACTUAL_MAJOR_MINOR=$(echo "$CLAUDE_ACTUAL" | cut -d. -f1-2)
  if [[ "$PIN_MAJOR_MINOR" == "$ACTUAL_MAJOR_MINOR" ]]; then
    echo "  OK: claude $CLAUDE_ACTUAL (pinned: $CLAUDE_PINNED)"
  else
    echo "  DRIFT: claude $CLAUDE_ACTUAL (pinned: $CLAUDE_PINNED)"
    DRIFT=1
  fi
fi

# ── Check TypeScript (per app) ─────────────────────────────────────────────────

echo "Checking TypeScript across apps..."
for app_dir in apps/*/; do
  app_name=$(basename "$app_dir")
  PKG_FILE="$app_dir/package.json"
  if [[ -f "$PKG_FILE" ]]; then
    TS_VERSION=$(python3 -c "import json; d=json.load(open('$PKG_FILE')); print(d.get('devDependencies',{}).get('typescript','N/A'))" 2>/dev/null || echo "N/A")
    if [[ "$TS_VERSION" != "N/A" ]]; then
      # Normalize: ^5.7.3 means >=5.7.3 <6.0.0
      # Extract major.minor from pinned
      PIN_MAJOR=$(echo "$TYPESCRIPT_PINNED" | sed 's/\^//' | cut -d. -f1-2)
      TS_MAJOR=$(echo "$TS_VERSION" | sed 's/\^//' | cut -d. -f1-2)
      if [[ "$TS_MAJOR" == "$PIN_MAJOR" ]]; then
        echo "  OK: $app_name/typescript $TS_VERSION (pinned: $TYPESCRIPT_PINNED)"
      else
        echo "  DRIFT: $app_name/typescript $TS_VERSION (pinned: $TYPESCRIPT_PINNED)"
        DRIFT=1
      fi
    fi
  fi
done

# ── Check Biome (ai-gateway only) ──────────────────────────────────────────────

echo "Checking Biome..."
BIOME_ACTUAL=$(python3 -c "import json; d=json.load(open('apps/ai-gateway/package.json')); print(d.get('devDependencies',{}).get('biome','NOT_INSTALLED'))" 2>/dev/null || echo "NOT_INSTALLED")
if [[ "$BIOME_ACTUAL" == "NOT_INSTALLED" ]] && [[ "$BIOME_PINNED" != "N/A" ]]; then
  echo "  DRIFT: biome NOT_INSTALLED (pinned: $BIOME_PINNED)"
  DRIFT=1
elif [[ "$BIOME_ACTUAL" != "NOT_INSTALLED" ]]; then
  PIN_MAJOR=$(echo "$BIOME_PINNED" | sed 's/\^//' | cut -d. -f1-2)
  ACTUAL_MAJOR=$(echo "$BIOME_ACTUAL" | sed 's/\^//' | cut -d. -f1-2)
  if [[ "$ACTUAL_MAJOR" == "$PIN_MAJOR" ]]; then
    echo "  OK: biome $BIOME_ACTUAL (pinned: $BIOME_PINNED)"
  else
    echo "  DRIFT: biome $BIOME_ACTUAL (pinned: $BIOME_PINNED)"
    DRIFT=1
  fi
else
  echo "  OK: biome NOT_INSTALLED (not in lock)"
fi

# ── Check Kokoro container ──────────────────────────────────────────────────────

echo "Checking Kokoro FastAPI..."
KOKORO_ACTUAL=$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep "kokoro-fastapi-gpu" | head -1 || echo "NOT_INSTALLED")
if [[ "$KOKORO_ACTUAL" == "NOT_INSTALLED" ]]; then
  echo "  DRIFT: kokoro NOT_INSTALLED (pinned: $KOKORO_PINNED)"
  DRIFT=1
elif [[ "$KOKORO_ACTUAL" == *"$KOKORO_PINNED"* ]]; then
  echo "  OK: kokoro-fastapi-gpu:$KOKORO_PINNED"
else
  echo "  DRIFT: kokoro-fastapi-gpu $KOKORO_ACTUAL (pinned: $KOKORO_PINNED)"
  DRIFT=1
fi

# ── Summary ────────────────────────────────────────────────────────────────────

echo ""
if [[ $DRIFT -eq 0 ]]; then
  echo "✅ No drift detected — all versions match VERSION-LOCK.md"
  exit 0
else
  echo "❌ Drift detected — run scripts/versions-update.sh to reconcile"
  exit 1
fi
