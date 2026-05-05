#!/usr/bin/env bash
# =============================================================================
# drift-check.sh — Compare actual Docker state with declared compose files
# =============================================================================
# SPEC-210 Phase 4: Detect configuration drift between running containers
# and the compose files that should define them.
#
# Usage:
#   bash drift-check.sh [--report]
#
# Exit codes:
#   0 = clean (no drift)
#   1 = drift detected
#
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
BLUE='\033[0;34m'

DRIFT=0

echo -e "${BLUE}━━━ Drift Check ━━━${NC}"
echo "Comparing running containers vs declared compose files"
echo ""

# ── 1. Running containers vs compose file containers ────────────────────
COMPOSE_DIRS=(
  "/srv/monorepo/deployments"
  "/srv/ops/gitea"
  "/srv/ops/stacks/autoheal"
  "/srv/ops/stacks/guardrail"
  "/srv/edge-tts"
  "/srv/monorepo/services"
)

echo "1. Service validation by compose dir"
echo "────────────────────────────────────"

for dir in "${COMPOSE_DIRS[@]}"; do
  for compose_file in "$dir"/docker-compose*.yml "$dir"/docker-compose*.yaml; do
    [[ -f "$compose_file" ]] || continue

    PROJECT=$(basename "$dir")
    compose_name=$(basename "$compose_file" .yml | sed 's/docker-compose\.//')

    # Check if any containers from this compose are running
    running=$(docker compose -f "$compose_file" ps --format '{{.Name}} {{.Status}}' 2>/dev/null | wc -l)

    if [[ $running -eq 0 ]]; then
      continue  # Compose not currently active
    fi

    defined_services=$(docker compose -f "$compose_file" config --services 2>/dev/null)
    running_containers=$(docker compose -f "$compose_file" ps --format '{{.Name}}' 2>/dev/null)

    for svc in $defined_services; do
      if echo "$running_containers" | grep -q "$svc"; then
        echo -e "  ${GREEN}✓${NC} $compose_name/$svc — running"
      else
        echo -e "  ${RED}✗${NC} $compose_name/$svc — NOT running (defined in compose)"
        DRIFT=$((DRIFT + 1))
      fi
    done

    for container in $running_containers; do
      if ! echo "$defined_services" | grep -qF "$container"; then
        echo -e "  ${YELLOW}⚠${NC} $container — running but NOT in compose definition"
        DRIFT=$((DRIFT + 1))
      fi
    done
  done
done

# ── 2. Container image drift ────────────────────────────────────────────

echo ""
echo "2. Image version drift"
echo "───────────────────────"

# Check if any running containers use a different image than declared
for dir in "${COMPOSE_DIRS[@]}"; do
  for compose_file in "$dir"/docker-compose*.yml "$dir"/docker-compose*.yaml; do
    [[ -f "$compose_file" ]] || continue

    compose_name=$(basename "$compose_file" .yml)

    # Get declared images from compose
    declare -A declared_images=()
    declared_images_raw=$(docker compose -f "$compose_file" config 2>/dev/null | grep 'image:' | sed 's/.*image: *//' | tr -d '"')

    # Get running images
    running_imgs=$(docker compose -f "$compose_file" ps --format '{{.Image}}' 2>/dev/null)

    for img in $running_imgs; do
      if ! echo "$declared_images_raw" | grep -qF "$img"; then
        echo -e "  ${YELLOW}⚠${NC} Image drift: running=$img not matching compose declaration"
        DRIFT=$((DRIFT + 1))
      fi
    done
    break  # Only check first matching compose per dir
  done
done

# ── 3. Unmanaged containers ─────────────────────────────────────────────

echo ""
echo "3. Unmanaged containers (no compose file)"
echo "───────────────────────────────────────────"

RUNNING_IDS=$(docker ps -q)
UNMANAGED=0

for cid in $RUNNING_IDS; do
  compose_project=$(docker inspect "$cid" --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")
  if [[ -z "$compose_project" ]]; then
    cname=$(docker inspect "$cid" --format '{{.Name}}' | sed 's/^\/\///')
    echo -e "  ${YELLOW}⚠${NC} $cname — no compose project label"
    UNMANAGED=$((UNMANAGED + 1))
    DRIFT=$((DRIFT + 1))
  fi
done

[[ $UNMANAGED -eq 0 ]] && echo -e "  ${GREEN}✓${NC} All containers have compose project labels"

# ── Summary ──────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [[ $DRIFT -eq 0 ]]; then
  echo -e "${GREEN}DRIFT CHECK: CLEAN — 0 differences${NC}"
  exit 0
else
  echo -e "${RED}DRIFT CHECK: $DRIFT difference(s) detected${NC}"
  exit 1
fi
