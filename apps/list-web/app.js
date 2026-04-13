/**
 * list.zappro.site — Tool List App
 * Static HTML/JS app with Google OAuth + tool grid
 * Dark theme: #1a1a2e primary, #e94560 accent
 */

(function () {
  'use strict';

  // ─── Configuration ─────────────────────────────────────────────────────────

  var CONFIG = {
    client_id: '__GOOGLE_CLIENT_ID__',
    redirect_uri: 'https://list.zappro.site/auth/callback',
    scope: 'email profile',
    auth_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    userinfo_endpoint: 'https://www.googleapis.com/oauth2/v2/userinfo'
  };

  // ─── JWT Decode (minimal, no external deps) ────────────────────────────────

  function jwtDecode(token) {
    try {
      var base64Url = token.split('.')[1];
      var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  // ─── Storage Keys ──────────────────────────────────────────────────────────

  var STORAGE = {
    TOKEN: 'oauth_token',
    USER: 'oauth_user'
  };

  // ─── Session Management ────────────────────────────────────────────────────

  function getStoredToken() {
    return sessionStorage.getItem(STORAGE.TOKEN);
  }

  function getStoredUser() {
    var raw = sessionStorage.getItem(STORAGE.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function storeSession(token, user) {
    sessionStorage.setItem(STORAGE.TOKEN, token);
    sessionStorage.setItem(STORAGE.USER, JSON.stringify(user));
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE.TOKEN);
    sessionStorage.removeItem(STORAGE.USER);
  }

  function isTokenValid(token) {
    if (!token) return false;
    var payload = jwtDecode(token);
    if (!payload) return false;
    var now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  }

  function getTokenExpiry(token) {
    var payload = jwtDecode(token);
    if (!payload || !payload.exp) return null;
    return new Date(payload.exp * 1000);
  }

  // ─── Tools Data ────────────────────────────────────────────────────────────

  var TOOLS = [
    {
      name: 'OpenWebUI',
      url: 'https://chat.zappro.site',
      description: 'Chat AI interface',
      icon: '💬',
      category: 'ai'
    },
    {
      name: 'Grafana',
      url: 'https://monitor.zappro.site',
      description: 'Monitoring dashboards',
      icon: '📊',
      category: 'monitoring'
    },
    {
      name: 'Prometheus',
      url: 'http://localhost:9090',
      description: 'Metrics collection',
      icon: '🎯',
      category: 'monitoring'
    },
    {
      name: 'OpenClaw',
      url: 'https://openclaw.zappro.site',
      description: 'Voice AI bot',
      icon: '🎙️',
      category: 'ai'
    },
    {
      name: 'Coolify',
      url: 'https://coolify.zappro.site',
      description: 'PaaS dashboard',
      icon: '☁️',
      category: 'infra'
    },
    {
      name: 'Gitea',
      url: 'https://git.zappro.site',
      description: 'Git repositories',
      icon: '📦',
      category: 'dev'
    },
    {
      name: 'Infisical',
      url: 'https://infisical.zappro.site',
      description: 'Secrets manager',
      icon: '🔐',
      category: 'infra'
    },
    {
      name: 'Kokoro TTS',
      url: 'http://localhost:8013',
      description: 'Text-to-Speech',
      icon: '🔊',
      category: 'ai'
    }
  ];

  // ─── OAuth Flow ───────────────────────────────────────────────────────────

  function buildAuthUrl() {
    var params =
      'client_id=' +
      encodeURIComponent(CONFIG.client_id) +
      '&redirect_uri=' +
      encodeURIComponent(CONFIG.redirect_uri) +
      '&response_type=token' +
      '&scope=' +
      encodeURIComponent(CONFIG.scope) +
      '&include_granted_scopes=true' +
      '&state=' +
      encodeURIComponent(crypto.randomUUID());
    return CONFIG.auth_endpoint + '?' + params;
  }

  function parseOAuthFragment() {
    var hash = window.location.hash;
    if (!hash || !hash.startsWith('#access_token=')) return null;
    var pairs = hash.substring(1).split('&');
    var data = {};
    for (var i = 0; i < pairs.length; i++) {
      var idx = pairs[i].indexOf('=');
      if (idx === -1) continue;
      var key = pairs[i].substring(0, idx);
      var val = pairs[i].substring(idx + 1);
      data[decodeURIComponent(key)] = decodeURIComponent(val);
    }
    var token = data['access_token'];
    if (!token) return null;
    return { token: token, state: data['state'] };
  }

  async function fetchUserInfo(token) {
    var resp = await fetch(CONFIG.userinfo_endpoint, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('userinfo failed');
    return resp.json();
  }

  // ─── Tool Status Check ────────────────────────────────────────────────────

  var _toolStatusCache = {};

  async function checkToolStatus(tool) {
    if (_toolStatusCache[tool.url] !== undefined) {
      return _toolStatusCache[tool.url];
    }
    try {
      var controller = new AbortController();
      var timer = setTimeout(function () {
        controller.abort();
      }, 3000);
      try {
        await fetch(tool.url, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal
        });
        clearTimeout(timer);
        _toolStatusCache[tool.url] = 'up';
      } catch (e) {
        clearTimeout(timer);
        _toolStatusCache[tool.url] = 'down';
      }
    } catch (e) {
      _toolStatusCache[tool.url] = 'unknown';
    }
    return _toolStatusCache[tool.url];
  }

  async function checkAllToolStatuses(tools) {
    return Promise.all(tools.map(function (tool) {
      return checkToolStatus(tool);
    }));
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function isOnline() {
    return navigator.onLine;
  }

  // ─── UI Builders ──────────────────────────────────────────────────────────

  function createHeader(user) {
    var header = document.createElement('header');
    header.className = 'app-header';

    var brand = document.createElement('div');
    brand.className = 'header-brand';
    brand.innerHTML =
      '<span class="logo">🛠️</span><span class="title">list.zappro.site</span>';

    var userArea = document.createElement('div');
    userArea.className = 'header-user';

    if (user && user.email) {
      var emailEl = document.createElement('span');
      emailEl.className = 'user-email';
      emailEl.textContent = user.email;
      userArea.appendChild(emailEl);
    }

    var logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn-logout';
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = handleLogout;

    userArea.appendChild(logoutBtn);
    header.appendChild(brand);
    header.appendChild(userArea);
    return header;
  }

  function createStatusBadge(status) {
    var badge = document.createElement('span');
    badge.className = 'status-badge';
    switch (status) {
      case 'up':
        badge.classList.add('status-up');
        badge.textContent = '🟢 UP';
        break;
      case 'down':
        badge.classList.add('status-down');
        badge.textContent = '🔴 DOWN';
        break;
      case 'degraded':
        badge.classList.add('status-degraded');
        badge.textContent = '🟡 DEGRADED';
        break;
      default:
        badge.classList.add('status-unknown');
        badge.textContent = '❓ UNKNOWN';
    }
    return badge;
  }

  function createToolCard(tool, status) {
    var card = document.createElement('a');
    card.className = 'tool-card';
    card.href = tool.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    var iconEl = document.createElement('div');
    iconEl.className = 'tool-icon';
    iconEl.textContent = tool.icon;

    var nameEl = document.createElement('h3');
    nameEl.className = 'tool-name';
    nameEl.textContent = tool.name;

    var descEl = document.createElement('p');
    descEl.className = 'tool-description';
    descEl.textContent = tool.description;

    var categoryEl = document.createElement('span');
    categoryEl.className = 'tool-category';
    categoryEl.textContent = tool.category;

    var badgeEl = createStatusBadge(status);

    card.appendChild(iconEl);
    card.appendChild(nameEl);
    card.appendChild(descEl);
    card.appendChild(categoryEl);
    card.appendChild(badgeEl);

    return card;
  }

  function createToolsGrid(tools, statuses) {
    var grid = document.createElement('div');
    grid.className = 'tools-grid';
    for (var i = 0; i < tools.length; i++) {
      grid.appendChild(createToolCard(tools[i], statuses[i] || 'unknown'));
    }
    return grid;
  }

  function createLoadingView() {
    var container = document.createElement('div');
    container.className = 'loading-container';
    var spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.textContent = '⏳';
    var text = document.createElement('p');
    text.textContent = 'Loading tools...';
    container.appendChild(spinner);
    container.appendChild(text);
    return container;
  }

  function createErrorView(message, retryFn) {
    var container = document.createElement('div');
    container.className = 'error-container';

    var card = document.createElement('div');
    card.className = 'error-card';

    var icon = document.createElement('div');
    icon.className = 'error-icon';
    icon.textContent = '⚠️';

    var title = document.createElement('h2');
    title.textContent = 'Authentication Failed';

    var msg = document.createElement('p');
    msg.className = 'error-message';
    msg.textContent = message;

    var retryBtn = document.createElement('button');
    retryBtn.className = 'btn-primary';
    retryBtn.textContent = 'Try Again';
    retryBtn.onclick = retryFn || redirectToAuth;

    var offlineMsg = document.createElement('p');
    offlineMsg.className = 'offline-message';
    offlineMsg.textContent =
      'If you are offline, please check your connection and try again.';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(msg);
    card.appendChild(retryBtn);
    card.appendChild(offlineMsg);
    container.appendChild(card);
    return container;
  }

  function createOfflineView() {
    var container = document.createElement('div');
    container.className = 'offline-container';

    var card = document.createElement('div');
    card.className = 'offline-card';

    var icon = document.createElement('div');
    icon.className = 'offline-icon';
    icon.textContent = '📡';

    var title = document.createElement('h2');
    title.textContent = 'You are offline';

    var msg = document.createElement('p');
    msg.textContent =
      'Cannot reach the server. Please check your internet connection.';

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(msg);
    container.appendChild(card);
    return container;
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  function showAuthView() {
    var root = document.getElementById('app');
    root.innerHTML = '';

    var container = document.createElement('div');
    container.className = 'auth-view';

    var card = document.createElement('div');
    card.className = 'auth-card';

    var icon = document.createElement('div');
    icon.className = 'auth-icon';
    icon.textContent = '🛠️';

    var title = document.createElement('h1');
    title.textContent = 'Homelab Tools';

    var subtitle = document.createElement('p');
    subtitle.textContent = 'Sign in to access your internal tools';

    var loginBtn = document.createElement('button');
    loginBtn.className = 'btn-primary btn-google';
    loginBtn.innerHTML = '<span>🔐</span> Sign in with Google';
    loginBtn.onclick = redirectToAuth;

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(loginBtn);
    container.appendChild(card);
    root.appendChild(container);
  }

  function showCallbackError(message) {
    var root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(createErrorView(message, redirectToAuth));
  }

  function showMainView(user, tools) {
    var root = document.getElementById('app');
    root.innerHTML = '';

    root.appendChild(createHeader(user));

    var main = document.createElement('main');
    main.className = 'main-content';

    var section = document.createElement('section');
    section.className = 'tools-section';

    var loadingEl = createLoadingView();
    section.appendChild(loadingEl);
    main.appendChild(section);
    root.appendChild(main);

    // Fetch statuses then render grid
    checkAllToolStatuses(tools).then(function (statuses) {
      section.innerHTML = '';
      section.appendChild(createToolsGrid(tools, statuses));
    }).catch(function () {
      section.innerHTML = '';
      section.appendChild(
        createToolsGrid(tools, tools.map(function () { return 'unknown'; }))
      );
    });

    // Schedule auto-logout near token expiry
    var token = getStoredToken();
    if (token) {
      var expiry = getTokenExpiry(token);
      if (expiry) {
        var msUntilExpiry = expiry.getTime() - Date.now();
        if (msUntilExpiry > 0 && msUntilExpiry < 15 * 60 * 1000) {
          setTimeout(function () {
            if (confirm('Your session will expire in 15 minutes. Log in again?')) {
              handleLogout();
            }
          }, msUntilExpiry);
        }
        if (msUntilExpiry > 0) {
          setTimeout(function () {
            if (isTokenValid(getStoredToken())) {
              clearSession();
              showAuthView();
            }
          }, msUntilExpiry);
        }
      }
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  function redirectToAuth() {
    window.location.href = buildAuthUrl();
  }

  function handleLogout() {
    clearSession();
    showAuthView();
    setTimeout(redirectToAuth, 500);
  }

  // ─── Auth Callback Handler ───────────────────────────────────────────────

  async function handleAuthCallback() {
    // 1. Check for pending token (redirect flow)
    var pendingToken = sessionStorage.getItem('pending_token');
    if (pendingToken) {
      sessionStorage.removeItem('pending_token');
      if (isTokenValid(pendingToken)) {
        try {
          var user = await fetchUserInfo(pendingToken);
          storeSession(pendingToken, user);
          window.history.replaceState(null, '', window.location.pathname);
          showMainView(user, TOOLS);
        } catch (e) {
          showCallbackError('Failed to fetch user info. Please try again.');
        }
      } else {
        showCallbackError('Session expired. Please sign in again.');
      }
      return;
    }

    // 2. Check for token in URL hash (direct OAuth callback)
    var hashData = parseOAuthFragment();
    if (hashData) {
      if (isTokenValid(hashData.token)) {
        try {
          var user2 = await fetchUserInfo(hashData.token);
          storeSession(hashData.token, user2);
          window.history.replaceState(null, '', window.location.pathname);
          showMainView(user2, TOOLS);
        } catch (e) {
          showCallbackError('Failed to fetch user info. Please try again.');
        }
      } else {
        showCallbackError('Session expired. Please sign in again.');
      }
      return;
    }

    // 3. No token found — redirect to auth
    showCallbackError('No authentication token received.');
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  async function init() {
    // Online / offline handling
    window.addEventListener('online', function () {
      var root = document.getElementById('app');
      if (root && root.querySelector('.offline-container')) {
        var token = getStoredToken();
        var user = getStoredUser();
        if (token && isTokenValid(token) && user) {
          showMainView(user, TOOLS);
        }
      }
    });

    window.addEventListener('offline', function () {
      var root = document.getElementById('app');
      if (root) {
        var token = getStoredToken();
        if (token && isTokenValid(token)) {
          showOfflineView();
        }
      }
    });

    // Detect callback path
    if (window.location.pathname === '/auth/callback') {
      await handleAuthCallback();
      return;
    }

    // Offline check first
    if (!isOnline()) {
      showOfflineView();
      return;
    }

    // Normal session check
    var token = getStoredToken();
    var user = getStoredUser();

    if (!token || !isTokenValid(token)) {
      if (token) clearSession(); // expired token
      showAuthView();
      return;
    }

    if (!user) {
      // Token ok, no user — refetch
      try {
        var freshUser = await fetchUserInfo(token);
        storeSession(token, freshUser);
        showMainView(freshUser, TOOLS);
      } catch (e) {
        clearSession();
        showAuthView();
      }
      return;
    }

    showMainView(user, TOOLS);
  }

  // ─── Offline View (shortcut) ─────────────────────────────────────────────

  function showOfflineView() {
    var root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(createHeader(getStoredUser()));
    root.appendChild(createOfflineView());
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
