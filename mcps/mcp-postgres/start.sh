#!/bin/bash
# MCP PostgreSQL Server Startup Script
# Usage: ./start.sh [port]
#
# Environment variables:
#   MCP_POSTGRES_HOST      - PostgreSQL host (default: localhost)
#   MCP_POSTGRES_DB_PORT   - PostgreSQL database port (default: 5432)
#   MCP_POSTGRES_USER      - PostgreSQL user (default: postgres)
#   MCP_POSTGRES_PASSWORD  - PostgreSQL password
#   MCP_POSTGRES_DB        - PostgreSQL database name (default: postgres)
#
# Note: MCP_POSTGRES_DB_PORT is for the database connection
#       The HTTP server port defaults to 4017 unless overridden

set -e

PORT=${1:-4017}
DB_HOST=${MCP_POSTGRES_HOST:-10.0.2.2}
DB_PORT=${MCP_POSTGRES_DB_PORT:-5432}
DB_USER=${MCP_POSTGRES_USER:-litellm}
DB_PASS=${MCP_POSTGRES_PASSWORD:-litellm_pass_2026}
DB_NAME=${MCP_POSTGRES_DB:-connected_repo_db}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[mcp-postgres] Starting on port $PORT"
echo "[mcp-postgres] Database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

exec python3 server.py &
SERVER_PID=$!

sleep 2

# Check if server is responding
if curl -sf http://localhost:$PORT/health > /dev/null 2>&1; then
    echo "[mcp-postgres] Server is ready on port $PORT"
else
    echo "[mcp-postgres] Warning: Server may not be responding on port $PORT"
fi

wait $SERVER_PID
