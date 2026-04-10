---
name: coolify-access
description: Coolify API integration for Claude Code — deploy services, manage docker-compose, restart services, fetch logs via Coolify API.
---

# Coolify Access Skill

## Configuração

### 1. Obter Token Coolify

**Opção A — Bearer Token (para API):**
1. Abrir https://cloud.zappro.site/settings/tokens
2. Criar novo token com scopes: `read`, `write`
3. Guardar em Infisical: `coolify-access-token`

**Opção B — API Key (alternativa):**
- Available em `COOLIFY_API_KEY` no Infisical
- Usar com header `Authorization: Bearer <token>`

### 2. Guardar Token em Infisical

```bash
# Project ID: e42657ef-98b2-4b9c-9a04-46c093bd6d37
# Environment: dev
# Secret path: /
infisical secrets set coolify-access-token --value="your-token-here"
```

### 3. Configurar no Claude Code

Adicionar ao `settings.json`:

```json
{
  "mcpServers": {
    "coolify": {
      "command": "npx",
      "args": ["-y", "@masonator/coolify-mcp"],
      "env": {
        "COOLIFY_ACCESS_TOKEN": "${COOLIFY_ACCESS_TOKEN}",
        "COOLIFY_BASE_URL": "http://127.0.0.1:8000"
      }
    }
  }
}
```

**Nota:** O Bearer token funciona quando o IP está no Coolify AllowList. Se falhar com "Unauthenticated", a API nginx exige sessão autenticada — ver Troubleshooting.

---

## Componentes Coolify

### AllowList (IP-based auth)

Se Coolify retornar 401/403 com Bearer token:
- O IP da sessão pode não estar na AllowList
- Adicionar IP em https://cloud.zappro.site/settings/allowlist

### Docker Networks

| Network Name | Service | Purpose |
|--------------|---------|---------|
| `qgtzrmi6771lt8l7x8rqx72f` | OpenClaw Bot | OpenClaw network |
| `wbmqefxhd7vdn2dme3i6s9an` | OpenWebUI | OpenWebUI network |

### Existing Services

| Service | UUID | Tipo |
|---------|------|------|
| openclaw | — | Docker Compose |
| openwebui | — | Docker Compose |
| bridge-stack | — | Docker Compose (SPEC-020) |

---

## API Endpoints (v1)

### Core Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/applications` | Lista aplicações |
| GET | `/api/v1/services` | Lista serviços |
| GET | `/api/v1/services/{uuid}` | Detalhes de um serviço |
| PATCH | `/api/v1/services/{uuid}` | Atualiza docker-compose |
| POST | `/api/v1/services/{uuid}/restart` | Reinicia serviço |
| GET | `/api/v1/services/{uuid}/logs` | Logs do serviço |
| DELETE | `/api/v1/services/{uuid}` | Remove serviço |

### Deploy Pattern

```python
import os
import requests

class CoolifyClient:
    def __init__(self):
        self.token = os.environ.get("COOLIFY_ACCESS_TOKEN")
        self.base_url = os.environ.get("COOLIFY_BASE_URL", "http://127.0.0.1:8000")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def deploy_bridge_stack(self, uuid: str, docker_compose_raw: str):
        """Deploy bridge stack via Coolify API."""
        resp = requests.patch(
            f"{self.base_url}/api/v1/services/{uuid}",
            headers=self.headers,
            json={"docker_compose_raw": docker_compose_raw}
        )
        resp.raise_for_status()
        return resp.json()

    def restart_service(self, uuid: str):
        """Restart a service."""
        resp = requests.post(
            f"{self.base_url}/api/v1/services/{uuid}/restart",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.json()

    def get_logs(self, uuid: str) -> str:
        """Get service logs."""
        resp = requests.get(
            f"{self.base_url}/api/v1/services/{uuid}/logs",
            headers=self.headers
        )
        resp.raise_for_status()
        return resp.text
```

---

## Docker Compose para Bridge Stack

```yaml
version: '3.8'
services:
  openclaw-mcp-wrapper:
    build:
      context: ./docs/OPERATIONS/SKILLS
      dockerfile: Dockerfile.openclaw-mcp-wrapper
    ports:
      - "3457:3457"
    environment:
      - SECRET_KEYS=OPENCLAW_GATEWAY_TOKEN,OPENCLAW_BASE_URL
      - INFISICAL_HOST=http://127.0.0.1:8200
      - OPENCLAW_BASE_URL=http://10.0.19.4:8080
    networks:
      - qgtzrmi6771lt8l7x8rqx72f
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:3457/health')"]
      interval: 30s
      timeout: 5s
      retries: 3

  openwebui-bridge-agent:
    build:
      context: ./docs/OPERATIONS/SKILLS
      dockerfile: Dockerfile.openwebui-bridge-agent
    ports:
      - "3456:3456"
    environment:
      - SECRET_KEYS=OPENCLAW_GATEWAY_TOKEN,OPENCLAW_BASE_URL
      - INFISICAL_HOST=http://127.0.0.1:8200
      - OPENCLAW_BASE_URL=http://10.0.19.4:8080
    networks:
      - qgtzrmi6771lt8l7x8rqx72f
      - wbmqefxhd7vdn2dme3i6s9an
    depends_on:
      openclaw-mcp-wrapper:
        condition: service_healthy

networks:
  qgtzrmi6771lt8l7x8rqx72f:
    external: true
  wbmqefxhd7vdn2dme3i6s9an:
    external: true
```

---

## Tools MCP Disponíveis

O `@masonator/coolify-mcp` disponibiliza ~38 tools:

| Tool | Descrição |
|------|-----------|
| `coolify_list_services` | Lista todos os serviços |
| `coolify_get_service` | Detalhes de um serviço |
| `coolify_update_service` | Atualiza docker-compose |
| `coolify_restart_service` | Reinicia serviço |
| `coolify_get_logs` | Busca logs |
| `coolify_deploy` | Deploy aplicação |

---

## Troubleshooting

### "Unauthenticated" com Bearer Token

**Causa:** nginx do Coolify intercepta e exige sessão autenticada.

**Soluções:**
1. **AllowList IP:** Adicionar IP da sessão em https://cloud.zappro.site/settings/allowlist
2. **Proxy local:** Criar proxy que faz login e persiste cookie
3. **API Key:** Tentar COOLIFY_API_KEY em vez de access token

### Service Not Found

- Verificar UUID correto com `coolify_list_services`
- Service pode ter sido removido no dashboard

### Docker Network Errors

- Networks `qgtzrmi6771lt8l7x8rqx72f` e `wbmqefxhd7vdn2dme3i6s9an` devem existir
- Criar networks primeiro se não existirem

---

## Integração com Cursor-Loop

O cursor-loop usa Coolify para:
1. Deploy da bridge stack (openclaw-mcp-wrapper + openwebui-bridge-agent)
2. Restart de serviços após update
3. Fetch de logs para debugging

**Fluxo:**
```
[1] Leader: Infisical Check
[2] Gitea: Push branch
[3] Gitea CI: Test pipeline
[4] Coolify: Deploy bridge stack
         └─→ coolify-mcp: update_service with docker-compose
[5] Cloudflare: Update DNS (se novo subdomain)
[6] Verify: smoke test
```

---

## Referências

- [Coolify API Docs](https://coolify.io/docs/api)
- [Coolify MCP Server](https://github.com/masonator/coolify-mcp)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
