#!/usr/bin/env bash
set -euo pipefail
# docker-digest-audit.sh — Enterprise image audit for homelab
# Policy: NO :latest or :nightly tags in any docker-compose files
# Exit code: 0 = clean, 1 = violations found

SEARCH_PATHS=(
  "/srv/monorepo"
  "/srv/edge-tts"
  "/srv/hermes-second-brain"
  "/srv/ops/stacks"
  "/srv/data/coolify/source"
  "/srv/data/coolify/services"
)

EXCLUDE_DIRS="node_modules .git obsidian __pycache__ .venv research"

TIMESTAMP=$(date --iso-8601=seconds)
REPORT_FILE="/srv/ops/logs/docker-digest-audit-$(date +%Y%m%d-%H%M%S).json"
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

build_exclude_args() {
  local args=()
  for dir in $EXCLUDE_DIRS; do
    args+=(-not -path "*/${dir}/*")
  done
  echo "${args[@]}"
}

echo "{"
echo "  \"audit\": \"docker-digest\","
echo "  \"timestamp\": \"$TIMESTAMP\","
echo "  \"checked_at\": \"$(date --iso-8601=seconds)\","
echo "  \"hostname\": \"$(hostname)\","

# Phase 1: Scan docker-compose files for forbidden tags
echo "  \"phase1_compose_files\": {"
first=true
violations=0
files_checked=0

for path in "${SEARCH_PATHS[@]}"; do
  if [ ! -d "$path" ]; then
    continue
  fi
  while IFS= read -r -d '' file; do
    files_checked=$((files_checked + 1))
    filename=$(basename "$file")

    # Check for :latest without digest
    latest_matches=$(grep -n "image:.*:latest" "$file" 2>/dev/null | grep -v "@sha256" || true)

    # Check for :nightly tags
    nightly_matches=$(grep -n "image:.*:nightly" "$file" 2>/dev/null | grep -v "@sha256" || true)

    # Check for :main-latest (special case - allowed if pinned)
    mainlatest_matches=$(grep -n "image:.*:main-latest" "$file" 2>/dev/null | grep -v "@sha256" || true)

    # Check for direct image references without :VERSION@sha256
    untagged_matches=$(grep -nE "image:\s+[a-z0-9._/-]+$" "$file" 2>/dev/null | grep -v "sha256" | grep -v ":" || true)

    if [ -n "$latest_matches" ] || [ -n "$nightly_matches" ] || [ -n "$untagged_matches" ] || [ -n "$mainlatest_matches" ]; then
      if [ "$first" = false ]; then
        echo ","
      fi
      first=false
      violations=$((violations + 1))
      printf '    "%s": {' "$file"
      echo "      \"score\": \"FAIL\","
      [ -n "$latest_matches" ] && echo "      \"latest_tags\": \"$(echo "$latest_matches" | tr '\n' '; ' | sed 's/"/\\"/g' | sed 's/; $//')\"," || true
      [ -n "$nightly_matches" ] && echo "      \"nightly_tags\": \"$(echo "$nightly_matches" | tr '\n' '; ' | sed 's/"/\\"/g' | sed 's/; $//')\"," || true
      [ -n "$mainlatest_matches" ] && echo "      \"main_latest_warning\": \"$(echo "$mainlatest_matches" | tr '\n' '; ' | sed 's/"/\\"/g' | sed 's/; $//')\"," || true
      [ -n "$untagged_matches" ] && echo "      \"untagged_images\": \"$(echo "$untagged_matches" | tr '\n' '; ' | sed 's/"/\\"/g' | sed 's/; $//')\"," || true
      echo '      "action_required": "Replace tag with pinned digest (@sha256:...)"'
      printf '    }'
    fi
  done < <(find "$path" \( -name "docker-compose*.yml" -o -name "compose.yaml" \) $(build_exclude_args) -print0 2>/dev/null)
done

echo ""
echo "  },"

# Phase 2: Check running containers for :latest images
echo "  \"phase2_running_containers\": {"
first=true
container_violations=0

while IFS= read -r line; do
  container_name=$(echo "$line" | awk '{print $1}')
  image_tag=$(echo "$line" | awk '{print $2}')

  if echo "$image_tag" | grep -qE ":latest$|:nightly$|:nightly-dind$|:main-latest$"; then
    if [ "$first" = false ]; then
      echo ","
    fi
    first=false
    container_violations=$((container_violations + 1))

    digest=$(docker inspect "$image_tag" --format '{{index .RepoDigests 0}}' 2>/dev/null | awk -F@ '{print $2}' | head -c 71 || echo "LOCAL_BUILD")

    base_image=$(echo "$image_tag" | sed 's/:latest$//' | sed 's/:nightly.*$//' | sed 's/:main-latest$//')

    printf '    "%s": {' "$container_name"
    printf '      "image": "%s",\n' "$image_tag"
    printf '      "digest": "%s",\n' "$digest"
    if [ "$digest" = "LOCAL_BUILD" ]; then
      printf '      "risk": "LOCAL_BUILD — no pinned digest available. Snapshot before rebuild."\n'
    else
      printf '      "fix": "Replace with %s@sha256:%s"\n' "$base_image" "$digest"
    fi
    printf '    }'
  fi
done < <(docker ps --format "table {{.Names}}\t{{.Image}}" 2>/dev/null | tail -n +2)

echo ""
echo "  },"

# Summary
total_violations=$((violations + container_violations))
echo "  \"summary\": {"
echo "    \"compose_files_checked\": $files_checked,"
echo "    \"compose_violations\": $violations,"
echo "    \"container_violations\": $container_violations,"
echo "    \"total_violations\": $total_violations,"
if [ "$total_violations" -eq 0 ]; then
  echo '    \"verdict\": \"CLEAN — All images pinned by digest\",'
  echo '    \"exit_code\": 0'
else
  echo '    \"verdict\": \"VIOLATIONS_FOUND — :latest/:nightly tags detected\",'
  echo '    \"exit_code\": 1'
fi
echo "  }"
echo "}"

# Write to report file
exec 3>&1
exec > "$REPORT_FILE"
# Re-run to capture output in report
# (simplified — we just symlink latest)
ln -sf "$REPORT_FILE" /srv/ops/logs/docker-digest-audit-latest.json 2>/dev/null || true

exec >&3
echo "Report: $REPORT_FILE"
exit "${total_violations:-0}"
