#!/bin/bash
# prune-docs.sh — Prune dead/archived SPECs from monorepo docs/
# SPEC-091: Ongoing maintenance script (dry-run by default)
# Usage: ./prune-docs.sh [--execute]
#   --execute: actually move files (default is dry-run)

set -euo pipefail

DRY_RUN=true
if [[ "${1:-}" == "--execute" ]]; then
    DRY_RUN=false
    echo "MODE: EXECUTE (files will be moved)"
else
    echo "MODE: DRY-RUN (no files will be moved)"
fi

ARCHIVE_SPECS="/srv/monorepo/docs/archive/SPECS-dead"
ARCHIVE_GOVERNANCE="/srv/monorepo/docs/archive/GOVERNANCE-migrated"
ARCHIVE_RUNBOOKS="/srv/monorepo/docs/archive/OPS-RUNBOOKS-archived"

# Create archive directories if missing
mkdir -p "$ARCHIVE_SPECS" "$ARCHIVE_GOVERNANCE" "$ARCHIVE_RUNBOOKS"

# SPECs to archive (from SPEC-091)
SPECS_TO_ARCHIVE=(
    "SPEC-053"
    "SPEC-058"
    "SPEC-059"
    "SPEC-060"
    "SPEC-063"
    "SPEC-064"
    "SPEC-065"
    "SPEC-066"
    "SPEC-067"
    "SPEC-069"
    "SPEC-070"
    "SPEC-071"
    "SPEC-072"
    "SPEC-073"
    "SPEC-075"
    "SPEC-076"
    "SPEC-077"
    "SPEC-088"
    "SPEC-089"
)

# GOVERNANCE files to archive
GOVERNANCE_TO_ARCHIVE=(
    "CONTRACT.md"
    "GUARDRAILS.md"
    "CHANGE_POLICY.md"
    "EXCEPTIONS.md"
    "IMMUTABLE-SERVICES.md"
    "MASTER-PASSWORD-PROCEDURE.md"
    "PINNED-SERVICES.md"
    "SECRETS-MANDATE.md"
)

# OPS/RUNBOOKS to archive (keep ORCHESTRATOR-FAILURE.md)
RUNBOOKS_TO_ARCHIVE=(
    "P1-SERVICE-DOWN.md"
    "P2-SERVICE-DEGRADED.md"
    "P3-NON-CRITICAL.md"
    "P4-INFORMATIONAL.md"
    "PIPELINE-ROLLBACK.md"
    "README.md"
)

echo ""
echo "=== SPECs to Archive ==="
for spec in "${SPECS_TO_ARCHIVE[@]}"; do
    file="/srv/monorepo/docs/SPECS/${spec}.md"
    if [[ -f "$file" ]]; then
        echo "  WOULD ARCHIVE: $file"
        if [[ "$DRY_RUN" == "false" ]]; then
            mv "$file" "$ARCHIVE_SPECS/"
        fi
    else
        echo "  ALREADY ARCHIVED or NOT EXISTS: $file"
    fi
done

echo ""
echo "=== GOVERNANCE to Archive ==="
for file in "${GOVERNANCE_TO_ARCHIVE[@]}"; do
    src="/srv/monorepo/docs/GOVERNANCE/$file"
    if [[ -f "$src" ]]; then
        echo "  WOULD ARCHIVE: $src"
        if [[ "$DRY_RUN" == "false" ]]; then
            mv "$src" "$ARCHIVE_GOVERNANCE/"
        fi
    else
        echo "  NOT FOUND: $src"
    fi
done

echo ""
echo "=== OPS/RUNBOOKS to Archive ==="
for file in "${RUNBOOKS_TO_ARCHIVE[@]}"; do
    src="/srv/monorepo/docs/OPS/RUNBOOKS/$file"
    if [[ -f "$src" ]]; then
        echo "  WOULD ARCHIVE: $src"
        if [[ "$DRY_RUN" == "false" ]]; then
            mv "$src" "$ARCHIVE_RUNBOOKS/"
        fi
    else
        echo "  NOT FOUND: $src"
    fi
done

if [[ "$DRY_RUN" == "true" ]]; then
    echo ""
    echo "Run with --execute to actually move the files"
fi
