#!/bin/bash
# Seed first field case from willrefrimix
# Daikin VRV U4-01 VEE diagnostic technique
#
# Usage (from host with Docker access):
#   docker run --rm \
#     --network zappro-lite_default \
#     -e POSTGRES_HOST=zappro-litellm-db \
#     -e POSTGRES_PORT=5432 \
#     -e POSTGRES_DB=hvac_kb \
#     -e POSTGRES_USER=litellm \
#     -e POSTGRES_PASSWORD=litellm_pass_2026 \
#     -e QDRANT_URL=http://hermes-second-brain-qdrant-1:6333 \
#     -e QDRANT_API_KEY=<key> \
#     -v /srv/monorepo/scripts/hvac-rag:/scripts \
#     python:3.12-slim bash -c "pip install psycopg2-binary qdrant-client -q && cd /scripts && python3 seed-willrefrimix-daikin-vrv-u4-vee.py"
#
# Or run via Docker exec on a container in zappro-lite_default network.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== HVAC Field Expertise Memory - Seed Case ==="
echo "Author: willrefrimix"
echo "Brand: Daikin"
echo "Alarm: U4-01"
echo "Component: VEE"
echo ""
echo "Note: This script requires Docker network access to Postgres and Qdrant."
echo "Use the Docker command above or run from a container in zappro-lite_default network."
