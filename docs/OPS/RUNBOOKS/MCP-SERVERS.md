---
name: mcp-servers-runbook
description: Runbook for MCP servers (ports 4011-4016)
---

# MCP Servers Runbook

## Overview

6 MCP servers running on ports 4011-4016.

## Health Checks

```bash
curl http://localhost:4012/health  # mcp-coolify
curl http://localhost:4013/health  # mcp-ollama
curl http://localhost:4014/health  # mcp-system
curl http://localhost:4015/health  # mcp-cron
curl http://localhost:4016/health  # mcp-memory
```

## Restart All

```bash
docker restart mcp-coolify-mcp-coolify-1 mcp-ollama-mcp-ollama-1 mcp-system-mcp-system-1 mcp-cron-mcp-cron-1
```

## Common Issues

| Issue | Fix |
|-------|-----|
| 404 on /health | Server using FastMCP SSE-only — needs FastAPI layer |
| "Already running asyncio" | Run FastMCP in daemon thread |
| Connection refused | Check container is running: docker ps | grep mcp- |