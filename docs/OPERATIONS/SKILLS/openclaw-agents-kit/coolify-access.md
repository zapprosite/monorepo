# Coolify API Access Patterns

**Data:** 2026-04-09

## Authentication

**Bearer Token** in `Authorization` header:

```bash
export COOLIFY_ACCESS_TOKEN="your-api-token"
export COOLIFY_BASE_URL="http://127.0.0.1:8000"
export COOLIFY_API_VERSION="v1"

HEADERS='-H "Authorization: Bearer $COOLIFY_ACCESS_TOKEN" -H "Content-Type: application/json"'
```

## Token Scopes

| Scope | Access |
|-------|--------|
| `read-only` | Read data only |
| `read:sensitive` | Read including sensitive info |
| `view:sensitive` | View passwords, API keys (normally redacted) |
| `*` | Full access |

## Core Endpoints

```bash
# Enable API
GET /api/v1/enable

# List applications
GET /api/v1/applications

# List services
GET /api/v1/services

# Get current team
GET /api/v1/teams/current

# Get team members
GET /api/v1/teams/current/members

# Create service
POST /api/v1/services

# Update service
PATCH /api/v1/services/{uuid}

# Delete service
DELETE /api/v1/services/{uuid}
```

## Python Client

```python
import os
import requests
from typing import Optional, Dict, Any, List

class CoolifyClient:
    """Python client for Coolify API."""

    def __init__(self, token: Optional[str] = None, base_url: Optional[str] = None):
        self.token = token or os.environ.get("COOLIFY_ACCESS_TOKEN")
        self.base_url = base_url or os.environ.get("COOLIFY_BASE_URL", "http://127.0.0.1:8000")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def list_applications(self) -> List[Dict[str, Any]]:
        """List all applications."""
        resp = requests.get(f"{self.base_url}/api/v1/applications", headers=self.headers)
        resp.raise_for_status()
        return resp.json().get("data", [])

    def list_services(self) -> List[Dict[str, Any]]:
        """List all services."""
        resp = requests.get(f"{self.base_url}/api/v1/services", headers=self.headers)
        resp.raise_for_status()
        return resp.json().get("data", [])

    def get_service(self, uuid: str) -> Dict[str, Any]:
        """Get service by UUID."""
        resp = requests.get(f"{self.base_url}/api/v1/services/{uuid}", headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def update_service(self, uuid: str, docker_compose_raw: str) -> Dict[str, Any]:
        """Update service docker compose."""
        resp = requests.patch(
            f"{self.base_url}/api/v1/services/{uuid}",
            headers=self.headers,
            json={"docker_compose_raw": docker_compose_raw}
        )
        resp.raise_for_status()
        return resp.json()

    def get_service_logs(self, uuid: str) -> str:
        """Get service logs."""
        resp = requests.get(f"{self.base_url}/api/v1/services/{uuid}/logs", headers=self.headers)
        resp.raise_for_status()
        return resp.text

    def restart_service(self, uuid: str) -> Dict[str, Any]:
        """Restart a service."""
        resp = requests.post(f"{self.base_url}/api/v1/services/{uuid}/restart", headers=self.headers)
        resp.raise_for_status()
        return resp.json()
```

## Usage Example

```python
from coolify_client import CoolifyClient

client = CoolifyClient(
    token=os.environ.get("COOLIFY_ACCESS_TOKEN"),
    base_url="http://127.0.0.1:8000"
)

# List all services
services = client.list_services()
for svc in services:
    print(f"{svc['name']} - {svc['status']}")

# Find OpenClaw service
openclaw = next((s for s in services if "openclaw" in s.get("name", "").lower()), None)
if openclaw:
    print(f"Found: {openclaw['uuid']}")

    # Get full details
    details = client.get_service(openclaw["uuid"])
    print(f"Image: {details.get('image')}")

    # Restart
    client.restart_service(openclaw["uuid"])
```

## Docker Compose Update Pattern

```python
def update_openclaw_config(client, uuid, new_config_yaml):
    """Update OpenClaw docker-compose config via Coolify."""
    compose = f"""
services:
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    volumes:
      - ./openclaw.json:/data/.openclaw/openclaw.json
    environment:
      - OPENCLAW_CONFIG=/data/.openclaw/openclaw.json
    networks:
      - qgtzrmi6771lt8l7x8rqx72f

networks:
  qgtzrmi6771lt8l7x8rqx72f:
    external: true
"""
    return client.update_service(uuid, docker_compose_raw=compose)
```

## MCP Server Alternative

Use `@masonator/coolify-mcp` for Claude Code integration:

```json
{
  "mcpServers": {
    "coolify": {
      "command": "npx",
      "args": ["-y", "@masonator/coolify-mcp"],
      "env": {
        "COOLIFY_ACCESS_TOKEN": "your-token",
        "COOLIFY_BASE_URL": "http://localhost:8000"
      }
    }
  }
}
```

MCP tools available: 38 tools for service management, applications, databases, etc.

---

**Data:** 2026-04-09
**Source:** Coolify MCP Server docs, Coolify API reference