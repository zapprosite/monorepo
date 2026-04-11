# Coolify API Guide

**Host:** will-zappro homelab
**Data:** 2026-04-11
**API Version:** Coolify v1

---

## Overview

This guide teaches any LLM how to use the Coolify API v1 to deploy applications, manage servers, environments, and trigger deployments programmatically. All examples use Python with the API token fetched from Infisical.

**Coolify Instance:**
- UI: https://coolify.zappro.site (port 8000)
- API Base URL: `http://127.0.0.1:8000/api/v1` (local access)
- AllowList/Settings: https://cloud.zappro.site

---

## Authentication

### Bearer Token

All API requests require a Bearer token in the `Authorization` header:

```python
import os
import requests

COOLIFY_BASE_URL = "http://127.0.0.1:8000"
COOLIFY_API_KEY = os.environ["COOLIFY_API_KEY"]  # from Infisical

headers = {
    "Authorization": f"Bearer {COOLIFY_API_KEY}",
    "Content-Type": "application/json"
}
```

### Token Format & Source

- **Format:** `7|xxx...` (Pipe-separated token)
- **Storage:** Infisical secret `COOLIFY_API_KEY` under project `e42657ef-98b2-4b9c-9a04-46c093bd6d37/dev/`
- **Scopes:**
  - `read-only` - Read data only, no sensitive info
  - `read:sensitive` - Read including sensitive info
  - `view:sensitive` - View passwords, API keys (normally redacted)
  - `*` - Full access to all resources and sensitive data

### Fetching the Token from Infisical

```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

def get_coolify_api_key():
    """Fetch COOLIFY_API_KEY from Infisical."""
    with open('/srv/ops/secrets/infisical.service-token') as f:
        token = f.read().strip()
    client = InfisicalClient(
        settings=ClientSettings(access_token=token, site_url='http://127.0.0.1:8200')
    )
    secret = client.get_secret(GetSecretOptions(
        environment='dev',
        project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
        secret_name='COOLIFY_API_KEY',
        path='/'
    ))
    return secret.secret_value

COOLIFY_API_KEY = get_coolify_api_key()
```

### Health Check (No Auth Required)

```python
def health_check(base_url="http://127.0.0.1:8000"):
    """Check if Coolify API is healthy."""
    resp = requests.get(f"{base_url}/api/health")
    return resp.text  # "OK" if healthy

def get_version(base_url="http://127.0.0.1:8000"):
    """Get Coolify version (no auth required)."""
    resp = requests.get(f"{base_url}/api/v1/version")
    return resp.json()  # {"version": "4.0.0-beta.xxx"}
```

---

## Core Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/applications` | List all applications |
| GET | `/api/v1/applications/{uuid}` | Get application details |
| POST | `/api/v1/applications/public` | Create app from public Git repo |
| POST | `/api/v1/applications/private-github-app` | Create app from private repo |
| GET | `/api/v1/projects` | List all projects |
| GET | `/api/v1/projects/{uuid}` | Get project details |
| GET | `/api/v1/projects/{uuid}/environments` | List project environments |
| GET | `/api/v1/servers` | List all servers |
| GET | `/api/v1/services` | List all services |
| POST | `/api/v1/services` | Create a service |
| PATCH | `/api/v1/services/{uuid}` | Update service |
| DELETE | `/api/v1/services/{uuid}` | Delete service |
| GET | `/api/v1/deployments` | List running deployments |
| GET | `/api/v1/deployments/{uuid}` | Get deployment details |
| GET | `/api/v1/deploy?uuid={uuid}` | Trigger deployment |
| POST | `/api/v1/deployments/{uuid}/cancel` | Cancel deployment |
| GET | `/api/v1/databases/postgresql` | Create PostgreSQL database |
| GET | `/api/v1/databases/redis` | Create Redis database |
| GET | `/api/v1/teams/current` | Get current team |

---

## Python Client Class

```python
import os
import requests
from typing import Optional, Dict, Any, List

class CoolifyClient:
    """Python client for Coolify API v1."""

    def __init__(
        self,
        token: Optional[str] = None,
        base_url: str = "http://127.0.0.1:8000"
    ):
        self.token = token or os.environ.get("COOLIFY_API_KEY")
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    # --- Applications ---

    def list_applications(self, tag: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all applications, optionally filtered by tag."""
        url = f"{self.base_url}/api/v1/applications"
        if tag:
            url += f"?tag={tag}"
        resp = requests.get(url, headers=self.headers)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else data.get("data", [])

    def get_application(self, uuid: str) -> Dict[str, Any]:
        """Get application details by UUID."""
        resp = requests.get(
            f"{self.base_url}/api/v1/applications/{uuid}",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    def find_application_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find application by name. Returns None if not found."""
        apps = self.list_applications()
        for app in apps:
            if app.get("name", "").lower() == name.lower():
                return app
        return None

    # --- Services ---

    def list_services(self) -> List[Dict[str, Any]]:
        """List all services."""
        resp = requests.get(f"{self.base_url}/api/v1/services", headers=self.headers)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else data.get("data", [])

    def get_service(self, uuid: str) -> Dict[str, Any]:
        """Get service details by UUID."""
        resp = requests.get(
            f"{self.base_url}/api/v1/services/{uuid}",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    def update_service(self, uuid: str, docker_compose_raw: str) -> Dict[str, Any]:
        """Update service docker-compose configuration."""
        resp = requests.patch(
            f"{self.base_url}/api/v1/services/{uuid}",
            headers=self.headers,
            json={"docker_compose_raw": docker_compose_raw}
        )
        resp.raise_for_status()
        return resp.json()

    def restart_service(self, uuid: str) -> Dict[str, Any]:
        """Restart a service."""
        resp = requests.post(
            f"{self.base_url}/api/v1/services/{uuid}/restart",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    def delete_service(self, uuid: str) -> Dict[str, Any]:
        """Delete a service."""
        resp = requests.delete(
            f"{self.base_url}/api/v1/services/{uuid}",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    def get_service_logs(self, uuid: str) -> str:
        """Get service logs."""
        resp = requests.get(
            f"{self.base_url}/api/v1/services/{uuid}/logs",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.text

    # --- Projects & Environments ---

    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects."""
        resp = requests.get(f"{self.base_url}/api/v1/projects", headers=self.headers)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else data.get("projects", [])

    def get_project(self, uuid: str) -> Dict[str, Any]:
        """Get project details."""
        resp = requests.get(
            f"{self.base_url}/api/v1/projects/{uuid}",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    def list_environments(self, project_uuid: str) -> List[Dict[str, Any]]:
        """List environments in a project."""
        resp = requests.get(
            f"{self.base_url}/api/v1/projects/{project_uuid}/environments",
            headers=self.headers
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else data.get("environments", [])

    # --- Servers ---

    def list_servers(self) -> List[Dict[str, Any]]:
        """List all servers."""
        resp = requests.get(f"{self.base_url}/api/v1/servers", headers=self.headers)
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else data.get("data", [])

    def validate_server(self, uuid: str) -> Dict[str, Any]:
        """Validate server connection."""
        resp = requests.get(
            f"{self.base_url}/api/v1/servers/{uuid}/validate",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    # --- Deployments ---

    def list_deployments(self) -> List[Dict[str, Any]]:
        """List all running deployments."""
        resp = requests.get(f"{self.base_url}/api/v1/deployments", headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def get_deployment(self, uuid: str) -> Dict[str, Any]:
        """Get deployment details."""
        resp = requests.get(
            f"{self.base_url}/api/v1/deployments/{uuid}",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    def trigger_deploy(
        self,
        uuid: Optional[str] = None,
        uuids: Optional[List[str]] = None,
        tag: Optional[str] = None,
        force: bool = False,
        pr: Optional[int] = None
    ) -> Dict[str, Any]:
        """Trigger deployment by UUID, multiple UUIDs, or tag."""
        params = []
        if uuid:
            params.append(f"uuid={uuid}")
        if uuids:
            params.append(f"uuid={','.join(uuids)}")
        if tag:
            params.append(f"tag={tag}")
        if force:
            params.append("force=true")
        if pr is not None:
            params.append(f"pr={pr}")

        query = "&".join(params) if params else ""
        url = f"{self.base_url}/api/v1/deploy"
        if query:
            url += f"?{query}"

        resp = requests.get(url, headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def cancel_deployment(self, uuid: str) -> Dict[str, Any]:
        """Cancel a running deployment."""
        resp = requests.post(
            f"{self.base_url}/api/v1/deployments/{uuid}/cancel",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    # --- Environment Variables ---

    def list_envs(self, app_uuid: str) -> List[Dict[str, Any]]:
        """List environment variables for an application."""
        resp = requests.get(
            f"{self.base_url}/api/v1/applications/{app_uuid}/envs",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    def set_env(
        self,
        app_uuid: str,
        key: str,
        value: str,
        is_preview: bool = False,
        is_shown_once: bool = False
    ) -> Dict[str, Any]:
        """Create or update an environment variable."""
        resp = requests.post(
            f"{self.base_url}/api/v1/applications/{app_uuid}/envs",
            headers=self.headers,
            json={
                "key": key,
                "value": value,
                "is_preview": is_preview,
                "is_literal": True,
                "is_shown_once": is_shown_once
            }
        )
        resp.raise_for_status()
        return resp.json()

    def bulk_set_envs(self, app_uuid: str, vars: List[Dict[str, str]]) -> Dict[str, Any]:
        """Bulk update environment variables."""
        resp = requests.patch(
            f"{self.base_url}/api/v1/applications/{app_uuid}/envs/bulk",
            headers=self.headers,
            json={"data": vars}
        )
        resp.raise_for_status()
        return resp.json()

    def delete_env(self, app_uuid: str, env_uuid: str) -> Dict[str, Any]:
        """Delete an environment variable."""
        resp = requests.delete(
            f"{self.base_url}/api/v1/applications/{app_uuid}/envs/{env_uuid}",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    # --- Datbases ---

    def create_database(
        self,
        db_type: str,
        server_uuid: str,
        project_uuid: str,
        environment_name: str,
        name: str,
        image: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a managed database (postgresql, mysql, mongodb, redis)."""
        resp = requests.post(
            f"{self.base_url}/api/v1/databases/{db_type}",
            headers=self.headers,
            json={
                "server_uuid": server_uuid,
                "project_uuid": project_uuid,
                "environment_name": environment_name,
                "name": name,
                "image": image,
                "instant_deploy": True,
                **kwargs
            }
        )
        resp.raise_for_status()
        return resp.json()
```

---

## Use Cases

### 1. List All Applications

```python
client = CoolifyClient()

apps = client.list_applications()
for app in apps:
    print(f"{app['name']} - UUID: {app['uuid']} - Status: {app.get('status', 'unknown')}")
```

### 2. Find Application by Name and Deploy

```python
client = CoolifyClient()

# Find app by name
app = client.find_application_by_name("perplexity-agent")
if not app:
    raise ValueError("Application 'perplexity-agent' not found")

app_uuid = app["uuid"]
print(f"Found: {app['name']} ({app_uuid})")

# Trigger deploy on main branch
result = client.trigger_deploy(uuid=app_uuid)
print(f"Deploy triggered: {result}")
```

### 3. Deploy Specific Branch or PR

```python
# Deploy a specific branch
client.trigger_deploy(uuid=app_uuid, force=True)

# Deploy a specific Pull Request
client.trigger_deploy(uuid=app_uuid, pr=42)
```

### 4. Deploy Multiple Apps by Tag

```python
# Deploy all apps with "production" tag
client.trigger_deploy(tag="production")
```

### 5. Monitor Deployment Status

```python
# List running deployments
deployments = client.list_deployments()
for dep in deployments:
    print(f"Deployment: {dep.get('uuid')} - Status: {dep.get('status')}")

# Get specific deployment
details = client.get_deployment("dep-uuid-here")
print(f"Logs: {details.get('logs', 'N/A')}")
```

### 6. Restart a Service

```python
client = CoolifyClient()

# List services to find the target
services = client.list_services()
openclaw = next((s for s in services if "openclaw" in s.get("name", "").lower()), None)

if openclaw:
    print(f"Restarting {openclaw['name']}...")
    client.restart_service(openclaw["uuid"])
    print("Restarted successfully")
```

### 7. Update Service Docker Compose

```python
new_compose = """
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

client.update_service(openclaw["uuid"], docker_compose_raw=new_compose)
```

### 8. Manage Environment Variables

```python
# Set a new env var
client.set_env(app_uuid, "DATABASE_URL", "postgresql://user:pass@host:5432/mydb")

# Bulk update
client.bulk_set_envs(app_uuid, [
    {"key": "NODE_ENV", "value": "production"},
    {"key": "LOG_LEVEL", "value": "info"},
    {"key": "API_KEY", "value": "secret123", "is_shown_once": True}
])

# List envs
envs = client.list_envs(app_uuid)
for env in envs:
    print(f"{env['key']} = {env['value'][:10]}...")
```

### 9. Create a Managed Database

```python
# PostgreSQL
client.create_database(
    db_type="postgresql",
    server_uuid="server-uuid",
    project_uuid="project-uuid",
    environment_name="production",
    name="myapp-db",
    image="postgres:16-alpine",
    postgres_user="appuser",
    postgres_db="myapp",
    limits_memory="1G"
)
```

### 10. Create Application from Public Git Repository

```python
resp = requests.post(
    f"{client.base_url}/api/v1/applications/public",
    headers=client.headers,
    json={
        "project_uuid": "proj-uuid",
        "server_uuid": "server-uuid",
        "environment_name": "production",
        "git_repository": "https://github.com/username/my-nodejs-app",
        "git_branch": "main",
        "build_pack": "nixpacks",
        "ports_exposes": "3000",
        "name": "My Node.js App",
        "is_auto_deploy_enabled": True,
        "instant_deploy": True,
        "health_check_enabled": True,
        "health_check_path": "/health",
        "health_check_interval": 30
    }
)
resp.raise_for_status()
new_app_uuid = resp.json().get("uuid")
print(f"Created app: {new_app_uuid}")
```

---

## Troubleshooting

### Authentication Failures

If the API returns `{"message": "Unauthenticated."}`:

1. **Check IP AllowList:** Your external IP must be in the Coolify AllowList at https://cloud.zappro.site/settings/allowlist

```bash
# Check your external IP
curl -s https://api.ipify.org
```

2. **Verify token is valid:**
```python
client = CoolifyClient()
apps = client.list_applications()  # Will raise if auth fails
```

3. **Check response headers** - If HTML is returned instead of JSON, Cloudflare Access is intercepting the request.

### Diagnostic Script

```python
import requests

def diagnose_coolify(base_url="http://127.0.0.1:8000", token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    print("=== Coolify API Diagnostic ===")

    # Health check (no auth)
    try:
        resp = requests.get(f"{base_url}/api/health", timeout=5)
        print(f"Health: {resp.text} (HTTP {resp.status_code})")
    except Exception as e:
        print(f"Health check failed: {e}")

    if not token:
        print("No token provided - skipping authenticated endpoints")
        return

    # Authenticated test
    try:
        resp = requests.get(f"{base_url}/api/v1/applications", headers=headers, timeout=10)
        print(f"Applications: HTTP {resp.status_code}")
        if resp.status_code == 200:
            print("Auth: OK")
        elif "Unauthenticated" in resp.text:
            print("Auth: FAILED - Unauthenticated")
    except Exception as e:
        print(f"Applications check failed: {e}")

    # Check content type
    resp = requests.head(f"{base_url}/api/v1/applications", headers=headers)
    ctype = resp.headers.get("Content-Type", "")
    print(f"Content-Type: {ctype}")
    if "text/html" in ctype:
        print("WARNING: HTML response - Cloudflare Access may be intercepting")
```

---

## Infisical Integration Pattern

For production scripts, always fetch secrets from Infisical:

```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

def get_infisical_secret(secret_name: str) -> str:
    """Generic Infisical secret fetcher."""
    with open('/srv/ops/secrets/infisical.service-token') as f:
        token = f.read().strip()
    client = InfisicalClient(
        settings=ClientSettings(access_token=token, site_url='http://127.0.0.1:8200')
    )
    secret = client.get_secret(GetSecretOptions(
        environment='dev',
        project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
        secret_name=secret_name,
        path='/'
    ))
    return secret.secret_value

# Usage
api_key = get_infisical_secret("COOLIFY_API_KEY")
client = CoolifyClient(token=api_key)
```

---

## Error Handling

```python
from requests.exceptions import HTTPError, ConnectionError

def safe_deploy(client, app_uuid, branch="main"):
    """Deploy with error handling."""
    try:
        result = client.trigger_deploy(uuid=app_uuid)
        return {"success": True, "result": result}
    except HTTPError as e:
        if e.response.status_code == 401:
            return {"success": False, "error": "Authentication failed - check API token"}
        elif e.response.status_code == 404:
            return {"success": False, "error": f"Application {app_uuid} not found"}
        else:
            return {"success": False, "error": f"HTTP {e.response.status_code}: {e.response.text}"}
    except ConnectionError:
        return {"success": False, "error": "Cannot connect to Coolify - check if it's running"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## Related Skills & Docs

| Resource | Path |
|----------|------|
| Coolify Deploy Trigger Skill | `/home/will/.claude/skills/coolify-deploy-trigger/SKILL.md` |
| Coolify Access (OpenClaw Agents Kit) | `docs/OPERATIONS/SKILLS/openclaw-agents-kit/coolify-access.md` |
| Coolify Auth Diagnostic Guide | `docs/OPERATIONS/SKILLS/coolify-auth-dashboard.md` |
| Operations Skills Index | `docs/OPERATIONS/SKILLS/README.md` |
| Coolify API Docs | https://coolify.io/docs/api |

---

**Last updated:** 2026-04-11
**Maintained by:** will