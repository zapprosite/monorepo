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

# ── Pattern-based analysis ──────────────────────────────────────
analyze_pattern() {
  echo "=== Pattern Analysis ===" >> "$RESEARCH_OUTPUT"
  echo "" >> "$RESEARCH_OUTPUT"
  echo "Topic: $TOPIC" >> "$RESEARCH_OUTPUT"
  echo "" >> "$RESEARCH_OUTPUT"

  # pnpm version mismatch
  if echo "$TOPIC" | grep -qi "pnpm.*version\|corepack\|pnpm.*9\.0"; then
    cat >> "$RESEARCH_OUTPUT" << 'EOF'
## pnpm Version Mismatch

**Cause:** The project requires pnpm v9.0.0 but a different version is installed.

**Solutions:**
1. Set env: `COREPACK_ENABLE_STRICT=0`
2. Or use: `pnpm dlx corepack enable && pnpm use 9.0.0`
3. Or in package.json: `"packageManager": "pnpm@9.0.0"`

**Verify:** `pnpm --version`
EOF
    echo "" >> "$RESEARCH_OUTPUT"
    return 0
  fi

  # Peer dependency error
  if echo "$TOPIC" | grep -qi "peer.*dependency\|peerDep\|EPACKAGEJSON"; then
    cat >> "$RESEARCH_OUTPUT" << 'EOF'
## Peer Dependency Error

**Cause:** A package requires a peer dependency that's not installed or has version conflict.

**Solutions:**
1. Run: `pnpm install`
2. Check for version mismatches in package.json
3. Try: `pnpm install --legacy-peer-deps`

**Verify:** `pnpm list --depth=0 | grep peer`
EOF
    echo "" >> "$RESEARCH_OUTPUT"
    return 0
  fi

  # TypeScript error
  if echo "$TOPIC" | grep -qi "typescript\|type.*error\|tsc\|TS\d+"; then
    cat >> "$RESEARCH_OUTPUT" << 'EOF'
## TypeScript Error

**Cause:** Type errors in the codebase.

**Solutions:**
1. Run: `pnpm check-types`
2. Check the specific type errors in the output
3. Update types or fix type annotations

**Verify:** `pnpm turbo typecheck 2>&1 | grep "error TS"`
EOF
    echo "" >> "$RESEARCH_OUTPUT"
    return 0
  fi

  # Lint error
  if echo "$TOPIC" | grep -qi "lint\|biome\|ESLint"; then
    cat >> "$RESEARCH_OUTPUT" << 'EOF'
## Lint Error

**Cause:** Code style violations detected by Biome.

**Solutions:**
1. Run: `pnpm turbo lint -- --fix` (auto-fix)
2. Manually fix remaining issues
3. Check biome config in `biome.json`

**Verify:** `pnpm turbo lint`
EOF
    echo "" >> "$RESEARCH_OUTPUT"
    return 0
  fi

  # Build error
  if echo "$TOPIC" | grep -qi "build\|turbo.*build\|ERR_"; then
    cat >> "$RESEARCH_OUTPUT" << 'EOF'
## Build Error

**Cause:** Build failed due to compilation or dependency issues.

**Solutions:**
1. Clean: `pnpm turbo clean`
2. Rebuild: `pnpm turbo build`
3. Check for TypeScript errors first

**Verify:** `pnpm turbo build 2>&1 | tail -50`
EOF
    echo "" >> "$RESEARCH_OUTPUT"
    return 0
  fi

  # Git error
  if echo "$TOPIC" | grep -qi "git.*conflict\|merge.*conflict\|CONFLICT"; then
    cat >> "$RESEARCH_OUTPUT" << 'EOF'
## Git Merge Conflict

**Cause:** Merge conflict in one or more files.

**Solutions:**
1. List conflicts: `git diff --name-only --diff-filter=U`
2. Resolve each file manually
3. `git add <resolved-files>` and `git commit`

**Verify:** `git status | grep conflicted`
EOF
    echo "" >> "$RESEARCH_OUTPUT"
    return 0
  fi

  # Test failure
  if echo "$TOPIC" | grep -qi "test\|vitest\|assertion\|FAIL"; then
    cat >> "$RESEARCH_OUTPUT" << 'EOF'
## Test Failure

**Cause:** One or more tests are failing.

**Solutions:**
1. Run: `pnpm test` to see full output
2. Check test file and fix assertion
3. Update snapshot if needed: `pnpm test -- -u`

**Verify:** `pnpm turbo test 2>&1 | grep -A5 "FAIL\|AssertionError"`
EOF
    echo "" >> "$RESEARCH_OUTPUT"
    return 0
  fi

  # Secret missing
  if echo "$TOPIC" | grep -qi "secret\|API.*KEY\|ENV.*missing"; then
    cat >> "$RESEARCH_OUTPUT" << 'EOF'
## Secret Missing

**Cause:** Required environment variable or secret is not set.

**Solutions:**
1. Check .env file exists: `cp .env.example .env`
2. Fill in required values
3. For CI secrets: add to Gitea/GitHub secrets

**Verify:** `bash scripts/bootstrap-check.sh`
EOF
    echo "" >> "$RESEARCH_OUTPUT"
    return 0
  fi

  # No match
  echo "## General Topic" >> "$RESEARCH_OUTPUT"
  echo "" >> "$RESEARCH_OUTPUT"
  echo "No specific pattern matched. General investigation steps:" >> "$RESEARCH_OUTPUT"
  echo "" >> "$RESEARCH_OUTPUT"
}

# ── MiniMax LLM research ────────────────────────────────────────
research_minimax() {
  echo "=== MiniMax LLM Research ===" >> "$RESEARCH_OUTPUT"
  echo "" >> "$RESEARCH_OUTPUT"

  if [[ -f "scripts/cursor-loop-research-minimax.sh" ]]; then
    bash scripts/cursor-loop-research-minimax.sh "$TOPIC" >> "$RESEARCH_OUTPUT" 2>&1
    echo "✅ MiniMax research complete" >> "$RESEARCH_OUTPUT"
    return 0
  else
    echo "⚠️  cursor-loop-research-minimax.sh not found, skipping LLM research" >> "$RESEARCH_OUTPUT"
    return 1
  fi
}

# ── Investigation commands ──────────────────────────────────────
add_investigation() {
  echo "=== Investigation Commands ===" >> "$RESEARCH_OUTPUT"
  echo "" >> "$RESEARCH_OUTPUT"
  cat >> "$RESEARCH_OUTPUT" << EOF
Run these commands to investigate:

\`\`\`bash
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
\`\`\`
EOF
  echo "" >> "$RESEARCH_OUTPUT"
}

# ── Main ──────────────────────────────────────────────────────
main() {
  {
    echo "# Research Report: $TOPIC"
    echo ""
    echo "Generated: $(date)"
    echo ""

    # Pattern analysis (always runs)
    analyze_pattern

    # Try MiniMax LLM research
    research_minimax || true

    # Add investigation commands
    add_investigation

    echo "=== Summary ===" >> "$RESEARCH_OUTPUT"
    echo "" >> "$RESEARCH_OUTPUT"
    echo "Research completed at: $(date)" >> "$RESEARCH_OUTPUT"

  } > "$RESEARCH_OUTPUT"

  echo "✅ Research complete: $RESEARCH_OUTPUT"
  echo ""

  # If output file specified, also write there
  if [[ -n "$OUTPUT_FILE" ]]; then
    cp "$RESEARCH_OUTPUT" "$OUTPUT_FILE"
    echo "📄 Also saved to: $OUTPUT_FILE"
  fi

  cat "$RESEARCH_OUTPUT"
}

main
