# OpenWebUI CLI Runbook

Manage OpenWebUI via CLI using the internal API.

## Authentication

```bash
# Get JWT token
JWT=$(docker exec open-webui-wbmqefxhd7vdn2dme3i6s9an python3 -c "
import urllib.request, json
data = json.dumps({'email': 'admin@openwebui.local', 'password': 'AdminPass123!'}).encode()
req = urllib.request.Request('http://localhost:8080/api/v1/auths/signin', data=data, headers={'Content-Type': 'application/json'}, method='POST')
resp = urllib.request.urlopen(req, timeout=5)
print(json.loads(resp.read()).get('token'))
" 2>&1)
```

## Common Commands

```bash
# List models
curl -s -H "Authorization: Bearer $JWT" https://chat.zappro.site/api/v1/models

# Chat
curl -X POST -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  https://chat.zappro.site/api/v1/chat/completions \
  -d '{"model":"llama3-portuguese-tomcat-8b-instruct-q8:latest","messages":[{"role":"user","content":"Hello"}]}'

# Create admin user (if needed)
curl -X POST -H "Content-Type: application/json" \
  http://localhost:8080/api/v1/auths/signup \
  -d '{"email":"admin@openwebui.local","password":"AdminPass123!","name":"Admin"}'
```

## Troubleshooting

- API returns 401: JWT token expired or invalid - re-authenticate
- Connection reset: Check container is healthy
- ENABLE_API_KEYS not set: Currently managed by Coolify UI
