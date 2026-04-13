#!/usr/bin/env bash
# cursor-loop-research.sh — Research agent using pattern matching + MiniMax LLM
# Usage: bash scripts/cursor-loop-research.sh "<topic or error message>"
#
# Note: Uses MiniMax LLM (cursor-loop-research-minimax.sh) for web research.
# Claude -p is NOT used because it requires interactive terminal.

set -euo pipefail

TOPIC="${1:-}"
OUTPUT_FILE="${2:-}"
LOG_DIR=".cursor-loop/logs"
RESEARCH_OUTPUT="$LOG_DIR/research-$(date +%Y%m%d-%H%M%S).md"

# ── Setup ──────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

if [[ -z "$TOPIC" ]]; then
  echo "Usage: bash scripts/cursor-loop-research.sh \"<topic or error>\" [output_file]"
  exit 1
fi

echo "🔬 Research: $TOPIC"
echo "Output: $RESEARCH_OUTPUT"
echo ""

# ── Pattern definitions ─────────────────────────────────────────
# Each entry maps a regex to its solution content (newlines embedded).
# Note: backslashes in regex alternatives are escaped once (already in single quotes).
declare -A PATTERNS=(
  ["pnpm.*version\|corepack\|pnpm.*9\.0"]='## pnpm Version Mismatch

**Cause:** The project requires pnpm v9.0.0 but a different version is installed.

**Solutions:**
1. Set env: `COREPACK_ENABLE_STRICT=0`
2. Or use: `pnpm dlx corepack enable && pnpm use 9.0.0`
3. Or in package.json: `"packageManager": "pnpm@9.0.0"`

**Verify:** `pnpm --version`'

  ["peer.*dependency\|peerDep\|EPACKAGEJSON"]='## Peer Dependency Error

**Cause:** A package requires a peer dependency that is not installed or has version conflict.

**Solutions:**
1. Run: `pnpm install`
2. Check for version mismatches in package.json
3. Try: `pnpm install --legacy-peer-deps`

**Verify:** `pnpm list --depth=0 | grep peer`'

  ["typescript\|type.*error\|tsc\|TS[0-9]+"]='## TypeScript Error

**Cause:** Type errors in the codebase.

**Solutions:**
1. Run: `pnpm check-types`
2. Check the specific type errors in the output
3. Update types or fix type annotations

**Verify:** `pnpm turbo typecheck 2>&1 | grep "error TS"`'

  ["lint\|biome\|ESLint"]='## Lint Error

**Cause:** Code style violations detected by Biome.

**Solutions:**
1. Run: `pnpm turbo lint -- --fix` (auto-fix)
2. Manually fix remaining issues
3. Check biome config in `biome.json`

**Verify:** `pnpm turbo lint`'

  ["build\|turbo.*build\|ERR_"]='## Build Error

**Cause:** Build failed due to compilation or dependency issues.

**Solutions:**
1. Clean: `pnpm turbo clean`
2. Rebuild: `pnpm turbo build`
3. Check for TypeScript errors first

**Verify:** `pnpm turbo build 2>&1 | tail -50`'

  ["git.*conflict\|merge.*conflict\|CONFLICT"]='## Git Merge Conflict

**Cause:** Merge conflict in one or more files.

**Solutions:**
1. List conflicts: `git diff --name-only --diff-filter=U`
2. Resolve each file manually
3. `git add <resolved-files>` and `git commit`

**Verify:** `git status | grep conflicted`'

  ["test\|vitest\|assertion\|FAIL"]='## Test Failure

**Cause:** One or more tests are failing.

**Solutions:**
1. Run: `pnpm test` to see full output
2. Check test file and fix assertion
3. Update snapshot if needed: `pnpm test -- -u`

**Verify:** `pnpm turbo test 2>&1 | grep -A5 "FAIL\|AssertionError"`'

  ["secret\|API.*KEY\|ENV.*missing"]='## Secret Missing

**Cause:** Required environment variable or secret is not set.

**Solutions:**
1. Check .env file exists: `cp .env.example .env`
2. Fill in required values
3. For CI secrets: add to Gitea/GitHub secrets

**Verify:** `bash scripts/bootstrap-check.sh`'
)

# ── Pattern-based analysis ──────────────────────────────────────
analyze_pattern() {
  {
    echo "=== Pattern Analysis ==="
    echo ""
    echo "Topic: $TOPIC"
    echo ""

    matched=false
    for regex in "${!PATTERNS[@]}"; do
      if echo "$TOPIC" | grep -qi "$regex"; then
        echo -e "${PATTERNS[$regex]}\n"
        matched=true
      fi
    done

    if ! $matched; then
      echo "## General Topic"
      echo ""
      echo "No specific pattern matched. General investigation steps:"
      echo ""
    fi
  } >> "$RESEARCH_OUTPUT"
}

# ── MiniMax LLM research ────────────────────────────────────────
MINIMAX_SCRIPT="scripts/cursor-loop-research-minimax.sh"

research_minimax() {
  {
    echo "=== MiniMax LLM Research ==="
    echo ""
    if [[ -f "$MINIMAX_SCRIPT" ]]; then
      bash "$MINIMAX_SCRIPT" "$TOPIC" 2>&1
      echo "✅ MiniMax research complete"
    else
      echo "⚠️  $MINIMAX_SCRIPT not found, skipping LLM research"
    fi
  } >> "$RESEARCH_OUTPUT"
}

# ── Investigation commands ──────────────────────────────────────
INVESTIGATION_CMDS='```bash
# Full pipeline check
bash scripts/pipeline-state.sh status

# Bootstrap secrets check
bash scripts/bootstrap-check.sh

# Run specific step
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test

# See recent errors
pnpm turbo lint 2>&1 | tail -30
pnpm turbo typecheck 2>&1 | tail -30
```'

add_investigation() {
  {
    echo "=== Investigation Commands ==="
    echo ""
    echo "Run these commands to investigate:"
    echo ""
    echo "$INVESTIGATION_CMDS"
  } >> "$RESEARCH_OUTPUT"
}

# ── Main ──────────────────────────────────────────────────────
main() {
  {
    echo "# Research Report: $TOPIC"
    echo ""
    echo "Generated: $(date)"
    echo ""

    analyze_pattern
    research_minimax
    add_investigation

    echo "=== Summary ==="
    echo ""
    echo "Research completed at: $(date)"
  } > "$RESEARCH_OUTPUT"

  echo "✅ Research complete: $RESEARCH_OUTPUT"
  echo ""

  if [[ -n "$OUTPUT_FILE" ]]; then
    cp "$RESEARCH_OUTPUT" "$OUTPUT_FILE"
    echo "📄 Also saved to: $OUTPUT_FILE"
  fi

  cat "$RESEARCH_OUTPUT"
}

main
