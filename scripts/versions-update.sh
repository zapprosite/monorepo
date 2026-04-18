#!/usr/bin/env bash
# versions-update.sh — Update pinned versions in VERSION-LOCK.md to match actual installed versions
# Part of: SPEC-071-V1 (VERSION LOCK ENTERPRISE)
# Usage: bash scripts/versions-update.sh [--dry-run]

set -euo pipefail

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="1"
fi

LOCK_FILE="VERSION-LOCK.md"

if [[ ! -f "$LOCK_FILE" ]]; then
  echo "ERROR: $LOCK_FILE not found"
  exit 1
fi

echo "=== Version Update ==="
[[ -n "$DRY_RUN" ]] && echo "DRY RUN MODE (no changes written)"

# ── Get actual versions ─────────────────────────────────────────────────────────

TURBO_ACTUAL=$(pnpm exec turbo --version 2>/dev/null | awk '{print $1}' || echo "UNKNOWN")
PNPM_ACTUAL=$(pnpm --version 2>/dev/null || echo "UNKNOWN")
CLAUDE_ACTUAL=$(claude --version 2>/dev/null | awk '{print $1}' || echo "UNKNOWN")

# TypeScript per app (pick first non-N/A)
TS_ACTUAL="N/A"
for app_dir in apps/*/; do
  PKG_FILE="$app_dir/package.json"
  if [[ -f "$PKG_FILE" ]]; then
    TS_VER=$(python3 -c "import json; d=json.load(open('$PKG_FILE')); print(d.get('devDependencies',{}).get('typescript','N/A'))" 2>/dev/null || echo "N/A")
    if [[ "$TS_VER" != "N/A" ]]; then
      TS_ACTUAL="$TS_VER"
      break
    fi
  fi
done

# Biome
BIOME_ACTUAL=$(python3 -c "import json; d=json.load(open('apps/ai-gateway/package.json')); print(d.get('devDependencies',{}).get('biome','N/A'))" 2>/dev/null || echo "N/A")

# Kokoro
KOKORO_ACTUAL=$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep "kokoro-fastapi-gpu" | head -1 | sed 's|.*:||' || echo "UNKNOWN")

echo "Actual versions detected:"
echo "  turbo: $TURBO_ACTUAL"
echo "  pnpm: $PNPM_ACTUAL"
echo "  claude: $CLAUDE_ACTUAL"
echo "  typescript: $TS_ACTUAL"
echo "  biome: $BIOME_ACTUAL"
echo "  kokoro: $KOKORO_ACTUAL"
echo ""

# ── Update VERSION-LOCK.md using Python (inline values) ────────────────────────

python3 << PYEOF
import re

lock_file = "$LOCK_FILE"
dry_run = "$DRY_RUN"

with open(lock_file) as f:
    content = f.read()

turbo_actual    = "$TURBO_ACTUAL"
pnpm_actual    = "$PNPM_ACTUAL"
claude_actual  = "$CLAUDE_ACTUAL"
ts_actual      = "$TS_ACTUAL"
biome_actual   = "$BIOME_ACTUAL"
kokoro_actual  = "$KOKORO_ACTUAL"

updates = []

def replace_line(label, new_val):
    global content
    pattern = rf"(\| {label}\s+\|\s+)[^\s|]+(\s+\|)"
    if re.search(pattern, content):
        content = re.sub(pattern, rf"\g<1>{new_val}\2", content)
        updates.append(f"  Updated: {label} -> {new_val}")
    else:
        updates.append(f"  No match for: {label}")

replace_line("Turbo",           turbo_actual)
replace_line("pnpm",           pnpm_actual)
replace_line("Claude Code CLI", claude_actual)
replace_line("TypeScript",      ts_actual)
replace_line("Biome",           biome_actual)
replace_line("Kokoro FastAPI",  kokoro_actual)

# Update date
from datetime import date
today = date.today().isoformat()
content = re.sub(r"^# Version Lock — \d{4}-\d{2}-\d{2}", f"# Version Lock — {today}", content, flags=re.MULTILINE)
updates.append(f"  Updated date to {today}")

for u in updates:
    print(u)

if not dry_run:
    with open(lock_file, "w") as f:
        f.write(content)
    print("\n[VERSION-LOCK.md written]")
else:
    print("\n[Dry run — no changes written]")
PYEOF

if [[ -z "$DRY_RUN" ]]; then
  echo ""
  echo "✅ VERSION-LOCK.md updated. Review changes and commit."
fi
