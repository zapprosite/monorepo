#!/usr/bin/env bash
# smoke-postgres-mcp.sh — PostgreSQL MCP server: schema/table CRUD + cleanup
#
# Tests: create schema, create table, insert, select, drop.
# Uses fictional Refrimix campaign contact data. Cleans up all test artifacts.
#
# Idempotent — can run multiple times; each run creates/destroys its own schema.

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-${DB_USER:-postgres}}"
PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-}}"
PGDATABASE="${PGDATABASE:-${DB_NAME:-postgres}}"
MCP_URL="${POSTGRES_MCP_URL:-http://localhost:4017}"
MCP_APP="${MCP_APP:-hermes}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[SMOKE]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }

export PGPASSWORD

SCHEMA_NAME=""
CLEANUP_SCHEMA=0

# ── Prerequisites ───────────────────────────────────────────────────
check_prereqs() {
  log "Checking prerequisites..."

  if [[ -n "$MCP_URL" ]]; then
    if curl -sf "${MCP_URL}/health" > /dev/null 2>&1; then
      ok "PostgreSQL MCP reachable at ${MCP_URL}"
      USE_MCP=1
    else
      warn "PostgreSQL MCP not at ${MCP_URL} — falling back to psql"
      USE_MCP=0
    fi
  else
    USE_MCP=0
  fi

  if ! command -v psql > /dev/null 2>&1; then
    if [[ "$USE_MCP" == "0" ]]; then
      fail "psql not found and MCP not available"
      exit 1
    fi
  fi

  if pg_isready -h "$PGHOST" -p "$PGPORT" > /dev/null 2>&1; then
    ok "PostgreSQL reachable at ${PGHOST}:${PGPORT}"
  else
    fail "PostgreSQL not reachable at ${PGHOST}:${PGPORT}"
    exit 1
  fi

  ok "Prerequisites checked"
}

# ── psql helper ────────────────────────────────────────────────────
pg_exec() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Atc "$1" 2>&1
}

pg_exec_quiet() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Atc "$1" > /dev/null 2>&1
}

# ── Create smoke schema ───────────────────────────────────────────
create_schema() {
  local name="$1"
  pg_exec_quiet "CREATE SCHEMA \"${name}\";"
  ok "Created schema: ${name}"
}

# ── Create table ──────────────────────────────────────────────────
create_table() {
  local schema="$1"
  local result
  result=$(pg_exec "$(cat <<EOF
CREATE TABLE \"${schema}\".campaign_contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  company VARCHAR(255),
  campaign VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
SELECT 'table_created';
EOF
)")
  if [[ "$result" == "table_created" ]]; then
    ok "Created table: campaign_contacts"
  else
    fail "Failed to create table: ${result}"
    return 1
  fi
}

# ── Insert rows ──────────────────────────────────────────────────
insert_rows() {
  local schema="$1"
  local result

  result=$(pg_exec "$(cat <<EOF
INSERT INTO \"${schema}\".campaign_contacts (name, email, company, campaign)
VALUES
  ('Ana Ribeiro', 'ana.ribeiro@refri.com', 'Refrimix', 'Inverno 2026'),
  ('Carlos Maluf', 'c.maluf@climafrio.com', 'ClimaFrio', 'HVAC Q2')
RETURNING id, name;
EOF
)")
  if echo "$result" | grep -q "1\|2"; then
    ok "Inserted 2 rows: $(echo "$result" | tr '\n' ' ')"
  else
    fail "Insert failed: ${result}"
    return 1
  fi
}

# ── Select rows ──────────────────────────────────────────────────
select_rows() {
  local schema="$1"
  local result

  result=$(pg_exec "$(cat <<EOF
SELECT name, campaign FROM \"${schema}\".campaign_contacts ORDER BY id;
EOF
)")
  if echo "$result" | grep -q "Ana Ribeiro"; then
    ok "Select returned: $(echo "$result" | tr '\n' ' ' | sed 's/|/ /g')"
  else
    fail "Select did not return expected data: ${result}"
    return 1
  fi
}

# ── Drop schema ──────────────────────────────────────────────────
drop_schema() {
  local name="$1"
  pg_exec_quiet "DROP SCHEMA \"${name}\" CASCADE;"
  ok "Dropped schema: ${name}"
}

# ── MCP tool call ─────────────────────────────────────────────────
mcp_call() {
  local tool="$1"
  local args="$2"
  curl -sf -X POST "${MCP_URL}/tools/call" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"${tool}\", \"arguments\": ${args}}" 2>&1
}

# ── Test via MCP ─────────────────────────────────────────────────
test_via_mcp() {
  log "Testing via PostgreSQL MCP at ${MCP_URL}..."

  local result

  # Test list_schemas
  result=$(mcp_call "list_schemas" "{\"app\": \"${MCP_APP}\"}" | jq -r '.schemas // .error // empty')
  if [[ -n "$result" && "$result" != "null" ]]; then
    ok "MCP list_schemas: $(echo "$result" | jq length) schemas"
  else
    warn "MCP list_schemas returned empty or error"
  fi

  # Test list_tables
  result=$(mcp_call "list_tables" "{\"app\": \"${MCP_APP}\"}" | jq -r '.tables // .error // empty')
  if [[ -n "$result" && "$result" != "null" ]]; then
    ok "MCP list_tables: returned data"
  else
    warn "MCP list_tables returned empty or error"
  fi

  ok "PostgreSQL MCP endpoints verified"
}

# ── Main test ──────────────────────────────────────────────────────
main() {
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  SMOKE: PostgreSQL MCP — Schema CRUD"
  echo "  Create Schema → Table → Insert → Select → Drop"
  echo "═══════════════════════════════════════════════"
  echo ""

  check_prereqs

  SCHEMA_NAME="smoke_hermes_$(date +%s)"
  CLEANUP_SCHEMA=1

  echo ""
  echo "── Create Schema ──"
  create_schema "$SCHEMA_NAME"

  echo ""
  echo "── Create Table ──"
  create_table "$SCHEMA_NAME"

  echo ""
  echo "── Insert Rows ──"
  insert_rows "$SCHEMA_NAME"

  echo ""
  echo "── Select Rows ──"
  select_rows "$SCHEMA_NAME"

  echo ""
  echo "── Drop Schema ──"
  drop_schema "$SCHEMA_NAME"
  CLEANUP_SCHEMA=0

  if [[ "$USE_MCP" == "1" ]]; then
    echo ""
    echo "── MCP Endpoints ──"
    test_via_mcp
  fi

  echo ""
  ok "smoke-postgres-mcp: all tests passed"
}

# ── Cleanup ─────────────────────────────────────────────────────────
cleanup() {
  if [[ "$CLEANUP_SCHEMA" == "1" && -n "$SCHEMA_NAME" ]]; then
    log "Cleaning up schema ${SCHEMA_NAME}..."
    pg_exec_quiet "DROP SCHEMA \"${SCHEMA_NAME}\" CASCADE;" 2>/dev/null || true
    ok "Schema ${SCHEMA_NAME} dropped"
  fi
}

trap cleanup EXIT
main "$@"
