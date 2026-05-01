#!/usr/bin/env bash
# Report docs that need freshness review. This is advisory and does not read
# runtime state, secrets, logs, data stores, or linked service repositories.
set -euo pipefail

ROOT="${ROOT:-/srv/monorepo}"
MAX_DAYS="${MAX_DAYS:-90}"
NOW_EPOCH="${NOW_EPOCH:-$(date +%s)}"
WARNED=0

is_allowed_doc() {
  local file="$1"
  [[ "$file" == docs/GOVERNANCE/* || "$file" == docs/SPECS/* || "$file" == docs/README.md ]]
}

doc_date() {
  local file="$1"
  sed -n '1,40p' "$ROOT/$file" | awk '
    /^(Updated|lastUpdated|Accepted|Created):[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2}/ {
      print $2
      exit
    }
    /\*\*Version:\*\*.*\*\*Updated:\*\*[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2}/ {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/) {
          print $i
          exit
        }
      }
    }
  '
}

while IFS= read -r file; do
  is_allowed_doc "$file" || continue

  date_value="$(doc_date "$file")"
  if [[ -z "$date_value" ]]; then
    printf 'DOCS-FRESHNESS: missing review date: %s\n' "$file" >&2
    WARNED=1
    continue
  fi

  date_epoch="$(date -d "$date_value" +%s 2>/dev/null || true)"
  if [[ -z "$date_epoch" ]]; then
    printf 'DOCS-FRESHNESS: invalid review date %s: %s\n' "$date_value" "$file" >&2
    WARNED=1
    continue
  fi

  age_days="$(( (NOW_EPOCH - date_epoch) / 86400 ))"
  if (( age_days > MAX_DAYS )); then
    printf 'DOCS-FRESHNESS: %sd old: %s\n' "$age_days" "$file" >&2
    WARNED=1
  fi
done < <(
  cd "$ROOT"
  rg --files docs/GOVERNANCE docs/SPECS docs/README.md \
    -g '*.md' \
    -g '!**/secrets/**' \
    -g '!**/data/**' \
    -g '!**/logs/**' \
    -g '!**/qdrant_storage/**' | sort
)

if [[ "$WARNED" -ne 0 ]]; then
  printf 'docs freshness review has warnings\n' >&2
else
  echo "docs freshness review passed"
fi
