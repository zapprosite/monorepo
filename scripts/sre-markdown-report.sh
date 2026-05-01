#!/usr/bin/env bash
# Generate a read-only SRE Markdown report for local review and future
# Hermes/Telegram delivery. This script never prints secret values.
set -euo pipefail

ROOT="${ROOT:-/srv/monorepo}"
MODE="${1:---dry-run}"

if [[ "$MODE" != "--dry-run" && "$MODE" != "--send" ]]; then
  printf 'Usage: %s [--dry-run|--send]\n' "$0" >&2
  exit 2
fi

if [[ "$MODE" == "--send" ]]; then
  printf '%s\n' "--send is not enabled in this governance pass; use --dry-run." >&2
  exit 2
fi

status_for_env() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    printf 'configured'
  else
    printf 'missing'
  fi
}

run_gate() {
  local label="$1"
  shift
  if "$@" >/tmp/sre-report-gate.out 2>/tmp/sre-report-gate.err; then
    printf -- '- %s: OK\n' "$label"
  else
    printf -- '- %s: FAIL\n' "$label"
  fi
  rm -f /tmp/sre-report-gate.out /tmp/sre-report-gate.err
}

git_summary() {
  local count
  count="$(git -C "$ROOT" status --short | wc -l | tr -d ' ')"
  if [[ "$count" == "0" ]]; then
    printf 'clean'
  else
    printf '%s changed entries' "$count"
  fi
}

ignored_status() {
  local path="$1"
  if git -C "$ROOT" check-ignore -q "$path"; then
    printf 'ignored'
  elif [[ -e "$ROOT/$path" ]]; then
    printf 'present-not-ignored'
  else
    printf 'absent'
  fi
}

open_risks() {
  awk -F '|' '
    /^\| RISK-/ {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $3)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $8)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $9)
      if ($9 != "Mitigated") {
        printf "- %s: %s [%s]\n", $2, $3, $9
      }
    }
  ' "$ROOT/docs/GOVERNANCE/RISK_REGISTER.md"
}

cat <<REPORT
# SRE Markdown Report

Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Repository: $ROOT
Mode: dry-run
Overall: WARN

## Quality Gates

$(run_gate "quality gates" bash "$ROOT/scripts/quality-gates.sh")
$(run_gate "quality gates enforced" env PLACEHOLDER_DEBT_ENFORCE=1 bash "$ROOT/scripts/quality-gates.sh")

## Git

- Working tree: $(git_summary)
- Local .claude-events: $(ignored_status ".claude-events")
- Local opencode.json: $(ignored_status "opencode.json")
- Local orchestrator compose: $(ignored_status "services/docker-compose.orchestrator.yml")

## Telegram/Hermes Readiness

- Bot: CEO_REFRIMIX_bot
- TELEGRAM_BOT_TOKEN: $(status_for_env TELEGRAM_BOT_TOKEN)
- TELEGRAM_CHAT_ID: $(status_for_env TELEGRAM_CHAT_ID)
- Delivery: disabled in this governance pass

## Governance Pointers

- Service catalog: docs/GOVERNANCE/SERVICE_CATALOG.md
- Risk register: docs/GOVERNANCE/RISK_REGISTER.md
- Observability reports: docs/GOVERNANCE/OBSERVABILITY-REPORTS.md
- Governance index: docs/GOVERNANCE/INDEX.md

## Open Risks

$(open_risks)

## Notes

- This report is read-only.
- Secret values are never printed.
- Live Telegram delivery requires a future approved SPEC.
REPORT
