/**
 * Google OAuth for list.zappro.site
 * Handles authentication flow for the list application
 */

const OAUTH_CONFIG = {
  client_id: 'GET_FROM_INFISICAL',
  redirect_uri: 'https://list.zappro.site/auth/callback',
  auth_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
  scopes: 'email profile openid'
};

// Simple in-memory session (replace with proper session management)
let session = {
  access_token: null,
  id_token: null,
  expires_at: null,
  user: null
};

/**
 * Parse JWT without external library
 * @param {string} token - JWT token
 * @returns {object} Decoded payload
 */
function parseJWT(token) {
  const base64 = token.split('.')[1];
  return JSON.parse(atob(base64));
}

/**
 * Generate random state for CSRF protection
 * @returns {string} Random state string
 */
function generateState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store state in sessionStorage for CSRF validation
 */
function storeState(state) {
  sessionStorage.setItem('oauth_state', state);
}

/**
 * Retrieve and validate state
 * @param {string} state - State from callback
 * @returns {boolean} Whether state is valid
 */
function validateState(state) {
  const stored = sessionStorage.getItem('oauth_state');
  sessionStorage.removeItem('oauth_state');
  return stored === state;
}

/**
 * Build Google OAuth URL
 * @returns {string} Authorization URL
 */
function buildAuthUrl() {
  const state = generateState();
  storeState(state);

  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.client_id,
    redirect_uri: OAUTH_CONFIG.redirect_uri,
    response_type: 'code',
    scope: OAUTH_CONFIG.scopes,
    state: state,
    access_type: 'offline',
    prompt: 'consent'
  });

  return `${OAUTH_CONFIG.auth_endpoint}?${params.toString()}`;
}

/**
 * Init OAuth - redirect to Google
 * @returns {void}
 */
function initOAuth() {
  const url = buildAuthUrl();
  window.location.href = url;
}

/**
 * Handle OAuth callback - exchange code for tokens
 * @param {string} [codeArg] - Optional authorization code (falls back to URL parsing)
 * @returns {Promise<object>} User info
 */
async function handleCallback(codeArg) {
  const params = new URLSearchParams(window.location.search);
  const code = codeArg || params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }

  if (!code) {
    throw new Error('No authorization code received');
  }

  if (!validateState(state)) {
    throw new Error('Invalid state parameter - CSRF protection failed');
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(OAUTH_CONFIG.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      code: code,
      client_id: OAUTH_CONFIG.client_id,
      redirect_uri: OAUTH_CONFIG.redirect_uri,
      grant_type: 'authorization_code'
    })
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange code for tokens');
  }

  const tokens = await tokenResponse.json();

  session.access_token = tokens.access_token;
  session.id_token = tokens.id_token;
  session.expires_at = Date.now() + (tokens.expires_in * 1000);

  // Store tokens securely
  sessionStorage.setItem('access_token', tokens.access_token);
  sessionStorage.setItem('id_token', tokens.id_token);
  sessionStorage.setItem('expires_at', session.expires_at.toString());

  // Clear URL params
  window.history.replaceState({}, '', '/auth/callback');

  // Fetch user info
  return await getUserInfo();
}

/**
 * Validate token expiry
 * @returns {boolean} Whether token is valid
 */
function validateToken() {
  if (!session.access_token && !sessionStorage.getItem('access_token')) {
    return false;
  }

  const expiresAt = session.expires_at || parseInt(sessionStorage.getItem('expires_at'));

  if (!expiresAt) {
    return false;
  }

  // Check if expired (with 60s buffer)
  if (Date.now() >= expiresAt - 60000) {
    return false;
  }

  return true;
}

/**
 * Get user info from Google
 * @returns {Promise<object>} User info (email, name, etc)
 */
async function getUserInfo() {
  const token = session.access_token || sessionStorage.getItem('access_token');

  if (!token) {
    throw new Error('No access token available');
  }

  const response = await fetch(OAUTH_CONFIG.userinfo_endpoint, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const userInfo = await response.json();

  session.user = {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    id: userInfo.id
  };

  return session.user;
}

/**
 * Logout - clear session
 * @returns {void}
 */
function logout() {
  session = {
    access_token: null,
    id_token: null,
    expires_at: null,
    user: null
  };

  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('id_token');
  sessionStorage.removeItem('expires_at');
  sessionStorage.removeItem('oauth_state');
}

/**
 * Check if user is authenticated
 * @returns {boolean} Whether user has valid session
 */
function isAuthenticated() {
  return validateToken() && session.user !== null;
}

/**
 * Get current user
 * @returns {object|null} User info or null
 */
function getCurrentUser() {
  return session.user;
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.OAuth = {
    initOAuth,
    handleCallback,
    validateToken,
    getUserInfo,
    logout,
    isAuthenticated,
    getCurrentUser,
    parseJWT
  };
}

// Node.js export (if used server-side)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initOAuth,
    handleCallback,
    validateToken,
    getUserInfo,
    logout,
    isAuthenticated,
    getCurrentUser,
    parseJWT,
    OAUTH_CONFIG
  };
}
