#!/bin/bash
set -eo pipefail
BRANCH="$1"
WORKDIR="${2:-.}"
ERRORS_LOG=".merge-work/errors.log"
> "$ERRORS_LOG"

cd "$WORKDIR"

NEW_FILES=$(git diff main.."$BRANCH" --name-only 2>/dev/null | grep -v '^$' | while read f; do
  if ! git show main:"$f" >/dev/null 2>&1; then echo "$f"; fi
done || true)

COPIED=0
SKIPPERM=0
for f in $NEW_FILES; do
  [ -z "$f" ] && continue
  DIR=$(dirname "$f")
  mkdir -p "$DIR" 2>/dev/null || true
  if git show "$BRANCH":"$f" > "$f" 2>/dev/null; then
    COPIED=$((COPIED+1))
  else
    SKIPPERM=$((SKIPPERM+1))
    echo "SKIP(perm): $f" >> "$ERRORS_LOG"
  fi
done

echo "Copied $COPIED files from $BRANCH (skipped: $SKIPPERM)"
