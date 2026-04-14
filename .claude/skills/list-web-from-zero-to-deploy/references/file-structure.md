# File Structure — list-web-from-zero-to-deploy

Templates para todos os arquivos de uma web app estatica com OAuth.

## Estrutura de Arquivos

```
app-name/
├── index.html          # HTML principal com OAuth Google
├── auth-callback.html   # Callback handler (armazena session)
├── nginx.conf          # nginx config com rota /auth/callback
├── Dockerfile          # Build nginx:alpine nao-root
├── docker-compose.yml  # Compose com healthcheck
└── build.sh            # Script de build (opcional)
```

---

## index.html

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TITULO — SUBDOMAIN.zappro.site</title>
  <style>/* CSS customizado para a app */</style>
</head>
<body>
  <!-- Header com logout -->
  <!-- Main com tools grid / conteudo -->
  <!-- Footer -->

  <script>
    // ================================================================
    // CONFIGURATION
    // GOOGLE_CLIENT_ID injetado via Infisical no deploy
    // ================================================================
    const CONFIG = {
      googleClientId: window.__ENV__?.GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID.apps.googleusercontent.com',
      redirectUri: 'https://SUBDOMAIN.zappro.site/auth/callback',
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      scope: 'email profile',
      sessionKey: 'app_session',
    };

    // Session management
    function getSession() {
      try {
        const raw = localStorage.getItem(CONFIG.sessionKey);
        if (!raw) return null;
        const session = JSON.parse(raw);
        if (session.exp && Date.now() / 1000 > session.exp) {
          localStorage.removeItem(CONFIG.sessionKey);
          return null;
        }
        return session;
      } catch { return null; }
    }

    function setSession(userinfo) {
      const session = {
        ...userinfo,
        exp: userinfo.exp || (Date.now() / 1000 + 3600 * 24 * 7),
      };
      localStorage.setItem(CONFIG.sessionKey, JSON.stringify(session));
    }

    function clearSession() {
      localStorage.removeItem(CONFIG.sessionKey);
    }

    // OAuth URL builder
    function buildOAuthUrl() {
      const params = new URLSearchParams({
        client_id: CONFIG.googleClientId,
        redirect_uri: CONFIG.redirectUri,
        response_type: 'code',
        scope: CONFIG.scope,
        access_type: 'online',
        prompt: 'select_account',
      });
      return CONFIG.authEndpoint + '?' + params.toString();
    }

    // Auth UI render
    function renderAuthUI() {
      const app = document.getElementById('app');
      app.innerHTML = `
        <section class="auth-section">
          <button class="google-btn" id="login-btn">Entrar com Google</button>
        </section>
      `;
      document.getElementById('login-btn').addEventListener('click', () => {
        window.location.href = buildOAuthUrl();
      });
    }

    // Main app render (substituir com conteudo real)
    function renderApp() {
      const app = document.getElementById('app');
      app.innerHTML = '<h1>App carregada</h1>';
      // Renderizar tools/grid/conteudo aqui
    }

    // Bootstrap
    (function bootstrap() {
      if (window.location.pathname.startsWith('/auth/')) {
        // handleOAuthCallback() no auth-callback.html
        return;
      }
      const session = getSession();
      if (!session) { renderAuthUI(); return; }
      renderApp();
    })();
  </script>
</body>
</html>
```

---

## auth-callback.html (OBRIGATORIO — token exchange real)

⚠️ **CRÍTICO:** O auth-callback.html DEVE fazer token exchange com Google OAuth.
O `client_secret` é **OBRIGATÓRIO** no POST body para web apps.

O padrão correto (igual ao obsidian-web em produção):

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auth Callback</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eaeaea;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .container { text-align: center; padding: 2rem; }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #0f3460;
      border-top-color: #e94560;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #status { margin-top: 1rem; font-size: 1.1rem; }
    .error { color: #ff4757; }
    .success { color: #00d26a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p id="status">Processando...</p>
  </div>

  <!-- Carregar env.js injetado pelo container entrypoint -->
  <script src="/env.js"></script>
  <script>
    (async function() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const codeVerifier = sessionStorage.getItem('code_verifier');

      if (error) {
        document.getElementById('status').textContent = 'Erro: ' + error;
        document.getElementById('status').className = 'error';
        return;
      }

      if (!code) {
        document.getElementById('status').textContent = 'Codigo nao encontrado';
        document.getElementById('status').className = 'error';
        return;
      }

      document.getElementById('status').textContent = 'Autenticando...';

      try {
        // Ler client_secret de window.__ENV__ (injetado via env.js)
        const clientId = window.__ENV__?.GOOGLE_CLIENT_ID || '';
        const clientSecret = window.__ENV__?.GOOGLE_CLIENT_SECRET || '';
        const redirectUri = window.location.origin + '/auth/callback';

        // Token exchange POST body — SEMPRE com client_secret
        // Sem client_secret → invalid_client ou client_secret is missing
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,  // ← OBRIGATORIO
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier || ''
          })
        });

        if (!tokenResponse.ok) {
          const errData = await tokenResponse.json().catch(() => ({}));
          throw new Error(errData.error_description || errData.error || 'Token exchange failed');
        }

        const tokens = await tokenResponse.json();

        // Buscar userinfo com o access_token
        const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { 'Authorization': 'Bearer ' + tokens.access_token }
        });

        if (!userinfoResponse.ok) {
          throw new Error('Failed to fetch userinfo');
        }

        const userinfo = await userinfoResponse.json();

        // Guardar session com tokens
        const session = {
          name: userinfo.name,
          email: userinfo.email,
          picture: userinfo.picture,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          exp: Date.now() / 1000 + (tokens.expires_in || 3600)
        };
        localStorage.setItem('app_session', JSON.stringify(session));
        sessionStorage.removeItem('code_verifier');

        document.getElementById('status').textContent = 'Login OK!';
        document.getElementById('status').className = 'success';

        // Redirect para index.html
        window.location.href = '/';
      } catch (err) {
        document.getElementById('status').textContent = 'Erro: ' + err.message;
        document.getElementById('status').className = 'error';
      }
    })();
  </script>
</body>
</html>
```

**SEM `client_secret` → `invalid_client` ou `client_secret is missing`**

---

## nginx.conf

```nginx
server {
    listen       80;
    listen  [::]:80;
    server_name  localhost;

    root   /usr/share/nginx/html;
    index  index.html index.htm;

    # OAuth callback route
    location = /auth/callback {
        try_files /auth-callback.html =404;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
```

---

## Dockerfile

```dockerfile
FROM nginx:alpine

# Create non-root user
RUN addgroup -g 1001 -S nginxapp && \
    adduser -S nginxapp -u 1001 -G nginxapp

# Create nginx cache directories (needed by worker process)
RUN mkdir -p /var/cache/nginx/client_temp && \
    chown -R nginxapp:nginxapp /var/cache/nginx

# Copy static files
COPY --chown=nginxapp:nginxapp . /usr/share/nginx/html/

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=5s \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

USER nginxapp

CMD ["nginx", "-g", "daemon off;"]
```

---

## docker-compose.yml

```yaml
services:
  app-name:
    container_name: app-name
    restart: unless-stopped
    build:
      context: .
      dockerfile: Dockerfile
    user: root
    ports:
      - "127.0.0.1:PORT:80"
    volumes:
      - app-name-cache:/var/cache/nginx
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s

volumes:
  app-name-cache:
```

---

## build.sh (opcional)

```bash
#!/bin/bash
set -e

APP_NAME="${1:-app-name}"
PORT="${2:-4080}"

echo "Building $APP_NAME on port $PORT..."

docker compose build
echo "Build complete. Run 'docker compose up -d' to start."
```
