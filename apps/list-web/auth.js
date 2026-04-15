/**
 * Google OAuth Configuration
 * Uses window.__ENV__ for secrets (injected at build time)
 */

const GOOGLE_OAUTH = {
  client_id: window.__ENV__?.GOOGLE_CLIENT_ID || '',
  redirect_uri: 'https://list.zappro.site/auth/callback',
  scope: 'email profile',
  auth_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://www.googleapis.com/oauth2/v2/userinfo'
};

const SESSION_KEY = 'list_web_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Initialize OAuth - load from window.__ENV__ then check session
 */
async function initOAuth() {
  try {
    // Load client_id from window.__ENV__ (injected at build time)
    GOOGLE_OAUTH.client_id = window.__ENV__?.GOOGLE_CLIENT_ID || '';

    if (!GOOGLE_OAUTH.client_id) {
      throw new Error('GOOGLE_CLIENT_ID not configured');
    }

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
      await handleOAuthCallback(urlParams.get('code'));
      return;
    }

    // Check existing session
    const session = getSession();
    if (session && session.expires > Date.now()) {
      setAuthUI(session.user);
    } else {
      redirectToOAuth();
    }
  } catch (error) {
    console.error('OAuth init failed:', error);
    showError('Erro ao inicializar autenticação: ' + error.message);
  }
}

/**
 * Redirect to Google OAuth
 */
function redirectToOAuth() {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH.client_id,
    redirect_uri: GOOGLE_OAUTH.redirect_uri,
    response_type: 'code',
    scope: GOOGLE_OAUTH.scope,
    access_type: 'offline',
    prompt: 'select_account'
  });

  window.location.href = `${GOOGLE_OAUTH.auth_endpoint}?${params}`;
}

/**
 * Handle OAuth callback
 */
async function handleOAuthCallback(code) {
  try {
    // Exchange code for tokens
    const response = await fetch(GOOGLE_OAUTH.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_OAUTH.client_id,
        client_secret: window.__ENV__?.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: GOOGLE_OAUTH.redirect_uri,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) throw new Error('Token exchange failed');

    const tokens = await response.json();

    // Get user info
    const userResponse = await fetch(GOOGLE_OAUTH.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    if (!userResponse.ok) throw new Error('User info fetch failed');
    const user = await userResponse.json();

    // Store session
    const session = {
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      access_token: tokens.access_token,
      expires: Date.now() + SESSION_DURATION
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Clean URL and render
    window.history.replaceState({}, '', window.location.pathname);
    setAuthUI(session.user);
  } catch (error) {
    console.error('OAuth callback failed:', error);
    showError('Erro no login OAuth: ' + error.message);
  }
}

/**
 * Get session from localStorage
 */
function getSession() {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Set authenticated UI state
 */
function setAuthUI(user) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('tools-grid').classList.remove('hidden');

  // Optionally show user info in header
  if (user?.picture) {
    const header = document.querySelector('.header-content');
    const img = document.createElement('img');
    img.src = user.picture;
    img.alt = user.name;
    img.style.cssText = 'width:36px;height:36px;border-radius:50%;';
    header.appendChild(img);
  }
}

/**
 * Show error message
 */
function showError(message) {
  document.getElementById('loading').classList.add('hidden');
  const errorEl = document.getElementById('error');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}
