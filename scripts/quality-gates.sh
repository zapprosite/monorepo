#!/usr/bin/env bash
# Non-destructive governance checks for secrets placeholders and compose healthchecks.
set -euo pipefail

ROOT="${ROOT:-/srv/monorepo}"
WAIVERS_FILE="${WAIVERS_FILE:-$ROOT/docs/GOVERNANCE/quality-gate-waivers.txt}"
FAILED=0

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  FAILED=1
}

is_waived() {
  local kind="$1" file="$2" service="$3"
  [[ -f "$WAIVERS_FILE" ]] || return 1
  awk -v kind="$kind" -v file="$file" -v service="$service" '
    $1 == kind && $2 == file && $3 == service { found = 1 }
    END { exit(found ? 0 : 1) }
  ' "$WAIVERS_FILE"
}

check_env_example() {
  local file="$ROOT/.env.example"
  [[ -f "$file" ]] || { fail ".env.example missing"; return; }

  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *"="* ]] || continue

    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key//[[:space:]]/}"
    value="${value%%#*}"
    value="${value//[[:space:]]/}"

    if [[ "$key" =~ (_KEY|_TOKEN|_SECRET|_PASSWORD|DATABASE_URL|REDIS_URL)$ ]]; then
      if [[ -n "$value" && "$value" != "\${$key}" ]]; then
        fail ".env.example has non-placeholder value for $key"
      fi
    fi
  done < "$file"
}

check_compose_secrets() {
  local file line key value
  while IFS= read -r file; do
    while IFS= read -r line; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ (_KEY|_TOKEN|_SECRET|_PASSWORD|DATABASE_URL|REDIS_URL) ]] || continue
      [[ "$line" =~ SECRET_KEYS ]] && continue

      key="$line"
      key="${key#*- }"
      key="${key%%[:=]*}"
      key="${key//[[:space:]\"\'-]/}"
      [[ "$key" == "INFISICAL_SECRET_PATH" ]] && continue
      value="${line#*[:=]}"
      value="${value%%#*}"

      if [[ "$value" != *'${'* ]]; then
        fail "$file has hardcoded secret-like value for ${key:-unknown}"
      fi
      if [[ "$value" =~ \$\{[A-Za-z0-9_]+:-[^}]+ ]]; then
        fail "$file has non-empty default for secret-like value ${key:-unknown}"
      fi
    done < "$file"
  done < <(find "$ROOT" -maxdepth 5 \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' \) \
    -not -path '*/secrets/*' -not -path '*/data/*' -not -path '*/logs/*' -not -path '*/qdrant_storage/*' | sort)
}

check_compose_healthchecks() {
  local file rel
  while IFS= read -r file; do
    rel="${file#$ROOT/}"
    awk -v file="$rel" '
      /^services:[[:space:]]*$/ { in_services = 1; next }
      in_services && /^[^[:space:]][^:]*:/ { in_services = 0 }
      in_services && /^  [A-Za-z0-9_.-]+:[[:space:]]*$/ {
        if (service && !has_health) print file, service
        service = $1
        sub(":", "", service)
        has_health = 0
        next
      }
      in_services && service && /^    healthcheck:[[:space:]]*$/ { has_health = 1 }
      END {
        if (service && !has_health) print file, service
      }
    ' "$file" | while read -r compose_path service; do
      if ! is_waived compose-healthcheck "$compose_path" "$service"; then
        fail "$compose_path service $service has no healthcheck"
      fi
    done
  done < <(find "$ROOT/services" -maxdepth 1 \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' \) | sort)
}

check_env_example
check_compose_secrets
check_compose_healthchecks

if [[ "$FAILED" -ne 0 ]]; then
  exit 1
fi

echo "quality gates passed"
