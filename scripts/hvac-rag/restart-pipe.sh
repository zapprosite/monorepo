#!/bin/bash
# Restart HVAC RAG Pipe with env vars from .env
set -e

PIPE_PID=$(pgrep -f 'hvac_rag_pipe.py' || true)
if [ -n "$PIPE_PID" ]; then
    echo "Stopping pipe (PID $PIPE_PID)..."
    kill $PIPE_PID 2>/dev/null || true
    sleep 2
fi

echo "Loading env from /srv/monorepo/.env..."
cd /srv/monorepo
# Parse only KEY=value lines (skip comments and malformed lines)
while IFS= read -r line; do
    # Skip empty lines and comment-only lines
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    # Must match KEY=value
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*=.* ]] || continue
    export "$line"
done < /srv/monorepo/.env

echo "Starting pipe..."
exec /srv/data/hvac-rag/.venv/bin/python3 scripts/hvac-rag/hvac_rag_pipe.py \
    >> /tmp/hvac-pipe.log 2>&1 &
echo "Pipe started (PID $!)"
sleep 3
curl -s http://127.0.0.1:4017/v1/models
