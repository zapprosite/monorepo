# OAuth Flow — list-web-from-zero-to-deploy

Passos para configurar Google OAuth 2.0 para a web app.

## Google Cloud Console Setup

### 1. Criar Projeto (ou usar existente)

```
https://console.cloud.google.com/
→ APIs e servicos → Credenciais → Criar Credenciais
```

### 2. Criar OAuth 2.0 Client ID

```
Tipo: Web application
Nome: list-web (ou nome da app)
```

### 3. Adicionar URIs de redirect autorizados

```
https://SUBDOMAIN.zappro.site/auth/callback
https://localhost:3000/auth/callback   (dev only)
```

### 4. Copiar Client ID

```
Client ID: XXXXXXXX-XXXXXXXX.apps.googleusercontent.com
```

**Guardar no Infisical IMMEDIATAMENTE** — nao hardcodar no codigo.

## Secrets Pattern (.env canonical)

### Buscar secret via env.js injection (web app)

```javascript
// window.__ENV__ e injetado via env.js no container
const clientId = window.__ENV__?.GOOGLE_CLIENT_ID;
const clientSecret = window.__ENV__?.GOOGLE_CLIENT_SECRET;
```

### Via environment no docker-compose

```yaml
services:
  app-name:
    environment:
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    # Secrets syncados do Infisical para .env
```

## Fluxo OAuth Completo

```
1. Usuario clica "Entrar com Google"
2. Redirecionado para Google OAuth URL:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=XXXXXXXX.apps.googleusercontent.com&
     redirect_uri=https://SUBDOMAIN.zappro.site/auth/callback&
     response_type=code&
     scope=email%20profile&
     access_type=online&
     prompt=select_account

3. Usuario faz login no Google

4. Google redirect para:
   https://SUBDOMAIN.zappro.site/auth/callback?code=XXXXX

5. auth-callback.html recebe o code:
   - Em producao: enviar code para backend trocar por tokens
   - Em demo: criar session mock localStorage

6. Session criada → index.html renderiza app
```

## Redirect URI Checklist

- [ ] `https://SUBDOMAIN.zappro.site/auth/callback` adicionado no Google Console
- [ ] URI exata (sem espacos, barras extras)
- [ ] Protocolo https (nao http)

## Erros Comuns

### redirect_uri_mismatch
- Verificar se URI no Google Console bate exatamente com a app
- Nao usar localhost em producao

### popup_closed_by_user
- Normal — usuario fechou o popup
- App deve mostrar botao "Tentar novamente"

### access_denied
- Usuario recusou permissao
- Mostrar mensagem amigavel

## Modo Dev (localhost)

Para testar localmente:

1. Adicionar redirect URI no Google Console:
   ```
   http://localhost:3000/auth/callback
   ```

2. Usar client ID de dev no index.html:
   ```javascript
   const CONFIG = {
     googleClientId: 'dev-client-id.apps.googleusercontent.com',
     redirectUri: 'http://localhost:3000/auth/callback',
     // ...
   };
   ```

3. O auth-callback.html em dev funciona igual production
