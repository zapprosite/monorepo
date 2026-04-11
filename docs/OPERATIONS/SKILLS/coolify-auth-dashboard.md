# Coolify Auth Dashboard — Diagnostic Guide

**Data:** 2026-04-11
**Objetivo:** Diagnosticar e resolver o problema de autenticação do Coolify API

---

## Problema

```
curl http://localhost:8000/api/v1/services
→ {"message":"Unauthenticated."}
```

O Bearer token retorna "Unauthenticated". O API retorna HTML (não JSON) — sugere Cloudflare Access redirect.

---

## Dashboard de Diagnóstico

### 1. Verificar IP Externo

```bash
curl -s https://api.ipify.org
curl -s https://ifconfig.me
```

**Anotar o IP** — precisa estar na Coolify AllowList em https://cloud.zappro.site/settings/allowlist

---

### 2. Testar API com Bearer Token

```bash
# Buscar token do Infisical
python3 -c "
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions
with open('/srv/ops/secrets/infisical.service-token') as f:
    token = f.read().strip()
c = InfisicalClient(settings=ClientSettings(access_token=token, site_url='http://127.0.0.1:8200'))
key = c.getSecret(GetSecretOptions(environment='dev', project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37', secret_name='COOLIFY_API_KEY', path='/'))
print(key.secret_value)
"
```

```bash
# Testar com Bearer token
curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer <COOLIFY_API_KEY>"
```

**Resultado esperado (auth OK):**
```json
[{"uuid":"...","name":"perplexity-agent",...}]
```

**Resultado com problema:**
```json
{"message":"Unauthenticated."}
```

---

### 3. Verificar Headers da Resposta

```bash
curl -s -I http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer <COOLIFY_API_KEY>"
```

**Se retornar HTML** → Cloudflare Access interceptando

```
HTTP/1.1 301 Moved Permanently
Location: https://cloud.zappro.site/...
Content-Type: text/html
```

**Se retornar JSON** → API direta funciona

```
HTTP/1.1 200 OK
Content-Type: application/json
```

---

### 4. IP vs Session Auth

| Método | Funciona? | Solução |
|--------|----------|---------|
| Bearer Token + IP na AllowList | ✅ | Adicionar IP em cloud.zappro.site |
| Bearer Token + IP fora AllowList | ❌ | Adicionar IP ou usar session cookie |
| Session Cookie | ✅ | Fazer login via browser e copiar cookie |
| Coolify UI | ✅ | Deploy manual via interface |

---

### 5. Quick Diagnostic Script

```bash
#!/bin/bash
# coolify-auth-check.sh — Run this to diagnose auth issues

TOKEN=$(python3 -c "
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions
with open('/srv/ops/secrets/infisical.service-token') as f:
    token = f.read().strip()
c = InfisicalClient(settings=ClientSettings(access_token=token, site_url='http://127.0.0.1:8200'))
key = c.getSecret(GetSecretOptions(environment='dev', project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37', secret_name='COOLIFY_API_KEY', path='/'))
print(key.secret_value)
" 2>/dev/null)

echo "=== Coolify API Auth Diagnostic ==="
echo "Timestamp: $(date -Iseconds)"
echo "Token found: $([ -n "$TOKEN" ] && echo 'YES' || echo 'NO')"
echo ""

echo "--- Testing /api/v1/applications ---"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer $TOKEN" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo "HTTP Code: $HTTP_CODE"
echo "Content-Type: $(curl -s -I http://localhost:8000/api/v1/applications -H "Authorization: Bearer $TOKEN" 2>/dev/null | grep -i content-type | tr -d '\r')"

if echo "$BODY" | grep -q "Unauthenticated"; then
  echo "❌ Status: Unauthenticated"
  echo ""
  echo "Possible causes:"
  echo "  1. IP not in Coolify AllowList"
  echo "  2. Bearer token invalid/expired"
  echo "  3. Coolify API requires session cookie"
elif echo "$BODY" | grep -q "\["; then
  echo "✅ Status: Auth OK — API returned JSON array"
else
  echo "❓ Status: Unexpected response"
  echo "$BODY" | head -5
fi
```

---

### 6. Soluções Conhecidas

#### Opção A: Adicionar IP à AllowList (RECOMENDADO)

1. Acessar https://cloud.zappro.site/settings/allowlist
2. Adicionar IP retornado em "Verificar IP Externo"
3. Aguardar 1-2 min
4. Retestar

#### Opção B: Usar Session Cookie

```bash
# Via browser DevTools:
# 1. Login em https://cloud.zappro.site
# 2. DevTools → Application → Cookies → copiar valor de "coolify_session"
# 3. Usar o cookie:

curl -s http://localhost:8000/api/v1/applications \
  -H "Cookie: coolify_session=<session_cookie>"
```

#### Opção C: Deploy Manual via UI

Fallback enquanto auth não funciona:
1. Acessar https://cloud.zappro.site
2. Navigate to application
3. Click "Deploy" manually

---

## Status Tracker

| Data | IP Externo | Auth Method | Status | Solução |
|------|------------|-------------|--------|---------|
| 2026-04-11 | ? | Bearer | ❌ Unauthenticated | Investigando |

---

## Referências

- Coolify API Docs: https://coolify.io/docs/api
- AllowList: https://cloud.zappro.site/settings/allowlist
- Infisical Secret: `COOLIFY_API_KEY` em `e42657ef-98b2-4b9c-9a04-46c093bd6d37/dev/`
