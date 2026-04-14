# HTML OAuth Implementation Template

## Complete Working Implementation

### index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My OAuth App</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 { color: #1a73e8; }
    button {
      background: #1a73e8;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover { background: #1557b0; }
  </style>
</head>
<body>
  <div class="container">
    <div id="app">
      <p>Loading...</p>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

### app.js

```javascript
// Configuration
const GOOGLE_CLIENT_ID = '{{GOOGLE_CLIENT_ID}}';
const REDIRECT_URI = window.location.origin + '/auth/callback';

const SCOPES = [
  'openid',
  'email',
  'profile'
].join(' ');

// Crypto utilities for PKCE
function generateRandomString(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// PKCE pair generation
async function generatePKCE() {
  const verifier = generateRandomString(64);
  const challenge = await sha256(verifier);
  sessionStorage.setItem('pkce_verifier', verifier);
  return { verifier, challenge };
}

// Initiate OAuth flow
async function initiateOAuth() {
  const { verifier, challenge } = await generatePKCE();
  const state = generateRandomString(16);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Check if user is authenticated
function checkAuth() {
  const token = sessionStorage.getItem('access_token');
  if (token) {
    renderApp();
  } else {
    initiateOAuth();
  }
}

// Render authenticated app content
function renderApp() {
  const token = sessionStorage.getItem('access_token');
  const idToken = sessionStorage.getItem('id_token');

  document.getElementById('app').innerHTML = `
    <h1>Welcome!</h1>
    <p>You are authenticated with Google OAuth.</p>
    <p><strong>Access Token:</strong> <code>${token.substring(0, 20)}...</code></p>
    <button onclick="logout()">Logout</button>
  `;

  // Optionally fetch user info
  fetchUserInfo(token);
}

// Fetch user info from Google
async function fetchUserInfo(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const userInfo = await response.json();
    console.log('User info:', userInfo);
  } catch (err) {
    console.error('Failed to fetch user info:', err);
  }
}

// Logout function
function logout() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('id_token');
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('oauth_state');
  window.location.reload();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', checkAuth);
```

### auth-callback.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authenticating...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #1a73e8;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Completing authentication...</p>
    <p id="status">Please wait</p>
  </div>
  <script src="callback.js"></script>
</body>
</html>
```

### callback.js

```javascript
const GOOGLE_CLIENT_ID = '{{GOOGLE_CLIENT_ID}}';
const REDIRECT_URI = window.location.origin + '/auth/callback';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

async function exchangeCodeForToken(code) {
  const verifier = sessionStorage.getItem('pkce_verifier');
  const state = sessionStorage.getItem('oauth_state');

  // Validate state to prevent CSRF
  const urlParams = new URLSearchParams(window.location.search);
  const returnedState = urlParams.get('state');

  if (state !== returnedState) {
    throw new Error('State mismatch — possible CSRF attack');
  }

  if (!verifier) {
    throw new Error('PKCE verifier not found — did you start auth from the main page?');
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: '{{GOOGLE_CLIENT_SECRET}}',
    code,
    grant_type: 'authorization_code',
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error);
  }

  return response.json();
}

async function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description');

  if (error) {
    document.getElementById('status').textContent =
      `Auth error: ${error} — ${errorDescription || 'No description'}`;
    return;
  }

  if (!code) {
    document.getElementById('status').textContent = 'No authorization code received.';
    return;
  }

  try {
    document.getElementById('status').textContent = 'Exchanging code for tokens...';

    const tokens = await exchangeCodeForToken(code);

    // Store tokens in sessionStorage
    sessionStorage.setItem('access_token', tokens.access_token);
    sessionStorage.setItem('id_token', tokens.id_token);
    sessionStorage.setItem('token_type', tokens.token_type);

    // Clean up PKCE artifacts
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('oauth_state');

    document.getElementById('status').textContent = 'Success! Redirecting...';

    // Redirect to main app
    setTimeout(() => {
      window.location.href = window.location.origin + '/';
    }, 500);

  } catch (err) {
    document.getElementById('status').textContent = `Token exchange failed: ${err.message}`;
    console.error('OAuth callback error:', err);
  }
}

document.addEventListener('DOMContentLoaded', handleCallback);
```

### build.sh

```bash
#!/bin/bash
set -e

# Verify required env vars
if [ -z "$GOOGLE_CLIENT_ID" ]; then
  echo "ERROR: GOOGLE_CLIENT_ID not set"
  exit 1
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
  echo "ERROR: GOOGLE_CLIENT_SECRET not set"
  exit 1
fi

# Create dist directory
mkdir -p dist

# Substitute placeholders in index.html
sed "s/{{GOOGLE_CLIENT_ID}}/${GOOGLE_CLIENT_ID}/g" index.html > dist/index.html

# Substitute placeholders in auth-callback.html
sed -e "s/{{GOOGLE_CLIENT_ID}}/${GOOGLE_CLIENT_ID}/g" \
    -e "s/{{GOOGLE_CLIENT_SECRET}}/${GOOGLE_CLIENT_SECRET}/g" \
    auth-callback.html > dist/auth-callback.html

# Copy static assets
cp nginx.conf dist/nginx.conf
cp docker-compose.yml dist/docker-compose.yml
cp Dockerfile dist/Dockerfile

# Make build.sh executable
chmod +x dist/build.sh

echo "Build complete. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET injected."
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name app.zappro.site;
    root /usr/share/nginx/html;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ =404;
    }

    # OAuth callback route - serves callback HTML
    location /auth/callback {
        alias /usr/share/nginx/html/auth-callback.html;
        default_type text/html;
    }

    # Healthcheck endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Dockerfile

```dockerfile
FROM nginx:alpine

# Create non-root user for security
RUN addgroup -g 101 -S appgroup && \
    adduser -u 101 -S appuser -G appgroup

# Copy built files
COPY --chown=appuser:appgroup dist/ /usr/share/nginx/html/

# Set ownership
RUN chown -R appuser:appgroup /usr/share/nginx/html/ && \
    chmod -R 755 /usr/share/nginx/html/

USER appuser

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:${PORT:-8080}:80"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```
