---
name: INCIDENT-2026-04-13-md-zappro-site-oauth
description: Debug OAuth invalid_client error — client_secret missing from token exchange
resolved: true
date: 2026-04-13
severity: P2 — Production OAuth broken
services_affected: [md.zappro.site]
---

# INCIDENT-2026-04-13: md.zappro.site OAuth — "invalid_client" + "client_secret is missing"

## Timeline

| Hora | Evento |
|------|--------|
| 14:19 | Container deployado com `GOOGLE_CLIENT_ID` hardcoded |
| 14:38 | Screenshot mostra `invalid_client` error |
| 14:54 | Imagem do browser mostra `client_secret is missing` no token exchange |
| 14:55 | Fix aplicado: `client_secret` adicionado ao POST body |
| 15:05 | OAuth funciona — login com Google OK |

## Symptom

```
Token exchange failed: invalid_request
client_secret is missing
```

O erro aparecia DEPOIS do login Google (quando o callback tentava trocar o `code` por `tokens`).

## Root Cause

O `app.js` e `auth-callback.html` faziam POST para `https://oauth2.googleapis.com/token` com:

```javascript
body: new URLSearchParams({
  client_id: CONFIG.client_id,
  code: code,
  code_verifier: verifier,
  redirect_uri: CONFIG.redirect_uri,
  grant_type: 'authorization_code'
})
```

**Falta:** `client_secret` no POST body.

Google OAuth requer `client_secret` no token exchange para web apps client-side (mesmo com PKCE).

## Fix Applied

```javascript
body: new URLSearchParams({
  client_id: CONFIG.client_id,
  client_secret: '<GOOGLE_CLIENT_SECRET from Infisical>',  // ← ADICIONADO
  code: code,
  code_verifier: verifier,
  redirect_uri: CONFIG.redirect_uri,
  grant_type: 'authorization_code'
})
```

## Files Changed

| File | Change |
|------|--------|
| `apps/obsidian-web/app.js` | Adicionado `client_secret` em `exchangeCodeForToken()` |
| `apps/obsidian-web/auth-callback.html` | Adicionado `client_secret` no token exchange |
| `apps/obsidian-web/docker-compose.yml` | Hardcoded ambas credenciais |
| `apps/obsidian-web/index.html` | `app.js?v=6` (version busting) |

## Why 10 Agents Found the Wrong Problem

Os agents focaram em:
- OAuth flow type (implicit vs PKCE) — problema antigo, já corrigido
- `client_id` mismatch — o client_id estava CORRETO
- Cloudflare Access blocking — excluído corretamente
- Container env injection — OK

**Nenhum agent identificou que `client_secret` estava em falta no token exchange POST body.**

## Lesson Learned

Para OAuth Authorization Code + PKCE em web apps client-side:
1. `client_id` vai no auth URL e no token POST
2. `client_secret` vai **sempre** no token POST (não no auth URL)
3. Sem `client_secret` → `invalid_client` ou `client_secret is missing`

## Credentials Used

```
GOOGLE_CLIENT_ID=→ Infisical: GOOGLE_CLIENT_ID (project: obsidian-web)
GOOGLE_CLIENT_SECRET=→ Infisical: GOOGLE_CLIENT_SECRET (project: obsidian-web)
```

**NUNCA hardcodar no código. Consultar INCIDENT-2026-04-09 para histórico de credenciais legacy.**

## Prevention

Adicionar checklist no OAuth implementation:

```markdown
### Token Exchange POST Body (OBRIGATÓRIO)
- grant_type: authorization_code
- client_id: ✓
- client_secret: ✓  ← CRÍTICO
- code: ✓
- code_verifier: ✓  (PKCE)
- redirect_uri: ✓
```

## Related

- INCIDENT-2026-04-09: Legacy OAuth credentials cleanup (mesmo client_id)
- SPEC-037: obsidian-web deployment