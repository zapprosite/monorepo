#!/bin/bash
# Start MCPO proxy for OpenWebUI
# MCPO (MCP OpenAPI proxy) allows connecting stdio-based MCP servers to OpenWebUI's native MCP support.

set -e

# Check if port 8090 is available
if ss -tuln | grep -q 8090; then
    echo "ERROR: Port 8090 is already in use"
    exit 1
fi

echo "Port 8090 is free, starting mcpo-proxy..."

# Start the MCPO container
docker run -d \
  --name openwebui-mcpo \
  -p 127.0.0.1:8090:8080 \
  --restart unless-stopped \
  ghcr.io/open-webui/mcpo:latest \
  --port 8080 \
  --host 0.0.0.0

echo "MCPO proxy started on 127.0.0.1:8090"
