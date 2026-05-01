/**
 * md.zappro.site — Obsidian Vault File Browser
 * Browse and view markdown files from the vault
 * PARA method folder structure
 *
 * OAuth: Authorization Code + PKCE (Google deprecated implicit flow)
 */

(function () {
  'use strict';

  // ─── Configuration ─────────────────────────────────────────────────────────

  var CONFIG = {
    client_id: window.__ENV__?.GOOGLE_CLIENT_ID || '',
    client_secret: window.__ENV__?.GOOGLE_CLIENT_SECRET || '',
    redirect_uri: 'https://md.zappro.site/auth/callback',
    scope: 'email profile',
    auth_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    userinfo_endpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
    sessionKey: 'obsidian_vault_session'
  };

  // ─── Vault Structure (PARA Method) ────────────────────────────────────────

  var VAULT_STRUCTURE = {
    name: 'Vault Principal',
    path: '/',
    folders: [
      {
        name: '00-Inbox',
        path: '/00-Inbox',
        icon: '\u{1F4E5}',
        description: 'Captura rapida de ideias e tarefas'
      },
      {
        name: '01-Projects',
        path: '/01-Projects',
        icon: '\u{1F4C1}',
        description: 'Projetos ativos e em andamento'
      },
      {
        name: '02-Areas',
        path: '/02-Areas',
        icon: '\u{1F4CB}',
        description: 'Areas de responsabilidade'
      },
      {
        name: '03-Resources',
        path: '/03-Resources',
        icon: '\u{1F4DA}',
        description: 'Recursos e referencias'
      },
      {
        name: '04-Archive',
        path: '/04-Archive',
        icon: '\u{1F4E4}',
        description: 'Arquivo de itens concluidos'
      },
      {
        name: 'docs',
        path: '/docs',
        icon: '\u{1F4C4}',
        description: 'Documentacao do sistema'
      }
    ]
  };

  // Mock file system for demo (in production, this would fetch from vault API)
  var FILE_SYSTEM = {
    '/': [
      { name: 'README.md', type: 'md', icon: '\u{1F4DD}', size: '2.1 KB', modified: '2026-04-10' },
      { name: 'INDEX.md', type: 'md', icon: '\u{1F4D1}', size: '4.5 KB', modified: '2026-04-12' }
    ],
    '/00-Inbox': [
      { name: 'ideias.md', type: 'md', icon: '\u{1F4A1}', size: '1.2 KB', modified: '2026-04-13' },
      { name: 'tarefas-rapidas.md', type: 'md', icon: '\u{1F4AC}', size: '0.8 KB', modified: '2026-04-12' }
    ],
    '/01-Projects': [
      { name: 'projeto-alpha.md', type: 'md', icon: '\u{1F680}', size: '8.3 KB', modified: '2026-04-11' },
      { name: 'voice-pipeline.md', type: 'md', icon: '\u{1F3A4}', size: '12.1 KB', modified: '2026-04-13' }
    ],
    '/02-Areas': [
      { name: 'homelab.md', type: 'md', icon: '\u{1F3E0}', size: '15.2 KB', modified: '2026-04-10' },
      { name: 'desenvolvimento.md', type: 'md', icon: '\u{1F4BB}', size: '6.7 KB', modified: '2026-04-09' }
    ],
    '/03-Resources': [
      { name: 'bookmarks.md', type: 'md', icon: '\u{1F517}', size: '3.4 KB', modified: '2026-04-08' },
      { name: 'links-uteis.md', type: 'md', icon: '\u{1F310}', size: '2.9 KB', modified: '2026-04-07' }
    ],
    '/04-Archive': [
      { name: 'projetos-concluidos.md', type: 'md', icon: '\u2705}', size: '22.1 KB', modified: '2026-04-01' }
    ],
    '/docs': [
      { name: 'SPEC-001.md', type: 'md', icon: '\u{1F4D0}', size: '5.6 KB', modified: '2026-04-12' },
      { name: 'ARCHITECTURE.md', type: 'md', icon: '\u{1F4D0}', size: '18.3 KB', modified: '2026-04-11' }
    ]
  };

  // Sample markdown content
  var MARKDOWN_CONTENT = {
    'README.md': '# Bem-vindo ao Vault\n\nEste e o vault pessoal de notas e projetos.\n\n## Estrutura (PARA)\n\n- **00-Inbox** — Captura rapida\n- **01-Projects** — Projetos ativos\n- **02-Areas** — Areas de responsabilidade\n- **03-Resources** — Recursos e referencias\n- **04-Archive** — Arquivo\n\n## Uso\n\nNavegue pelas pastas na barra lateral ou use a busca para encontrar arquivos.\n',
    'INDEX.md': '# Indice do Vault\n\n## Tarefas Recentes\n\n- [ ] Configurar novo projeto\n- [ ] Revisar documentacao\n- [ ] Atualizar vault\n\n## Projetos Ativos\n\n1. Voice Pipeline\n2. Homelab Monitor\n3. Claude Code Integration\n',
    'ideias.md': '# Ideias\n\n## Novas Ideias\n\n- Integrar com API de lembretes\n- Adicionar sistema de tags\n- Criar visualizacao de grafos\n',
    'homelab.md': '# Homelab\n\n## Servicos\n\n| Servico | URL | Status |\n|---------|-----|--------|\n| OpenWebUI | chat.zappro.site | UP |\n| Grafana | monitor.zappro.site | UP |\n| Hermes Agent | bot.zappro.site | UP |\n\n## Configuracao\n\n- ZFS Pool: 2x NVMe Gen5\n- RAM: 128GB ECC\n- GPU: RTX 4090\n'
  };

  // ─── State ─────────────────────────────────────────────────────────────────

  var currentPath = '/';
  var currentFile = null;

  // ─── Storage Keys ──────────────────────────────────────────────────────────

  var STORAGE = {
    TOKEN: 'oauth_token',
    USER: 'oauth_user',
    PKCE_VERIFIER: 'pkce_code_verifier',
    OAuth_STATE: 'oauth_state',
    OAUTH_CLIENT_ID: 'oauth_client_id',
    OAUTH_REDIRECT_URI: 'oauth_redirect_uri'
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
    sessionStorage.removeItem(STORAGE.PKCE_VERIFIER);
    sessionStorage.removeItem(STORAGE.OAuth_STATE);
    sessionStorage.removeItem(STORAGE.OAUTH_CLIENT_ID);
    sessionStorage.removeItem(STORAGE.OAUTH_REDIRECT_URI);
    localStorage.removeItem(CONFIG.sessionKey);
  }

  function isTokenValid(token) {
    if (!token) return false;
    try {
      var parts = token.split('.');
      if (parts.length !== 3) return false;
      var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      var now = Math.floor(Date.now() / 1000);
      return payload.exp > now;
    } catch (e) {
      return false;
    }
  }

  // ─── PKCE Helpers ─────────────────────────────────────────────────────────

  /**
   * Generate a random code_verifier (43-128 chars, unreserved URI chars)
   */
  function generateCodeVerifier() {
    var array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * SHA-256 hash then base64url encode — the code_challenge
   */
  async function generateCodeChallenge(verifier) {
    var encoder = new TextEncoder();
    var data = encoder.encode(verifier);
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = new Uint8Array(hashBuffer);
    return base64UrlEncode(hashArray)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  function base64UrlEncode(array) {
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/=+$/, '');
  }

  // ─── OAuth Flow (Authorization Code + PKCE) ────────────────────────────────

  /**
   * Build the authorization URL with PKCE code_challenge.
   * Stores code_verifier and state in sessionStorage for the token exchange.
   */
  async function buildAuthUrl() {
    var verifier = generateCodeVerifier();
    var challenge = await generateCodeChallenge(verifier);
    var state = crypto.randomUUID();

    // Persist for the callback phase
    sessionStorage.setItem(STORAGE.PKCE_VERIFIER, verifier);
    sessionStorage.setItem(STORAGE.OAuth_STATE, state);
    sessionStorage.setItem(STORAGE.OAUTH_CLIENT_ID, CONFIG.client_id);
    sessionStorage.setItem(STORAGE.OAUTH_REDIRECT_URI, CONFIG.redirect_uri);

    var params =
      'client_id=' + encodeURIComponent(CONFIG.client_id) +
      '&redirect_uri=' + encodeURIComponent(CONFIG.redirect_uri) +
      '&response_type=code' +
      '&scope=' + encodeURIComponent(CONFIG.scope) +
      '&access_type=offline' +
      '&prompt=select_account' +
      '&state=' + encodeURIComponent(state) +
      '&code_challenge=' + encodeURIComponent(challenge) +
      '&code_challenge_method=S256';

    return CONFIG.auth_endpoint + '?' + params;
  }

  /**
   * Exchange authorization code for tokens using the PKCE code_verifier.
   */
  async function exchangeCodeForToken(code) {
    var verifier = sessionStorage.getItem(STORAGE.PKCE_VERIFIER);
    if (!verifier) {
      throw new Error('No PKCE verifier found in session');
    }

    var resp = await fetch(CONFIG.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CONFIG.client_id,
        client_secret: CONFIG.client_secret,
        code: code,
        code_verifier: verifier,
        redirect_uri: CONFIG.redirect_uri,
        grant_type: 'authorization_code'
      })
    });

    if (!resp.ok) {
      var err = await resp.text();
      throw new Error('Token exchange failed: ' + err);
    }

    return resp.json(); // { access_token, expires_in, ... }
  }

  async function fetchUserInfo(token) {
    var resp = await fetch(CONFIG.userinfo_endpoint, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('userinfo failed');
    return resp.json();
  }

  // ─── UI Builders ──────────────────────────────────────────────────────────

  function createHeader(user) {
    var header = document.createElement('header');
    header.className = 'header';

    var inner = document.createElement('div');
    inner.className = 'header-inner';

    // Logo
    var logo = document.createElement('div');
    logo.className = 'header-logo';
    logo.innerHTML = '<span class="header-logo-icon">\u{1F4D0}</span><span>Obsidian Vault</span><span> — md.zappro.site</span>';
    inner.appendChild(logo);

    // Search
    var searchWrapper = document.createElement('div');
    searchWrapper.className = 'header-search';
    searchWrapper.innerHTML = '<div class="search-wrapper"><span class="search-icon">\u{1F50D}</span><input type="text" class="search-input" placeholder="Buscar arquivos..." id="search-input"></div>';
    inner.appendChild(searchWrapper);

    // User area
    var userArea = document.createElement('div');
    userArea.className = 'header-user';

    if (user && user.picture) {
      var avatar = document.createElement('img');
      avatar.src = user.picture;
      avatar.className = 'user-avatar';
      avatar.alt = '';
      userArea.appendChild(avatar);
    } else {
      var avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.textContent = '\u{1F464}';
      userArea.appendChild(avatar);
    }

    if (user && user.name) {
      var name = document.createElement('span');
      name.className = 'user-name';
      name.textContent = user.name;
      userArea.appendChild(name);
    }

    var logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.textContent = 'Sair';
    logoutBtn.onclick = handleLogout;
    userArea.appendChild(logoutBtn);

    inner.appendChild(userArea);
    header.appendChild(inner);

    return header;
  }

  function createSidebar(activePath) {
    var sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';

    // Root section
    var rootSection = document.createElement('div');
    rootSection.className = 'sidebar-section';

    var rootTitle = document.createElement('div');
    rootTitle.className = 'sidebar-title';
    rootTitle.textContent = 'Raiz';
    rootSection.appendChild(rootTitle);

    var rootTree = document.createElement('div');
    rootTree.className = 'folder-tree';

    var rootItem = document.createElement('div');
    rootItem.className = 'folder-item' + (activePath === '/' ? ' active' : '');
    rootItem.innerHTML = '<span class="folder-icon">\u{1F4C1}</span><span class="folder-name">Vault</span>';
    rootItem.onclick = function() { navigateToPath('/'); };
    rootTree.appendChild(rootItem);

    rootSection.appendChild(rootTree);
    sidebar.appendChild(rootSection);

    // PARA folders
    var paraSection = document.createElement('div');
    paraSection.className = 'sidebar-section';

    var paraTitle = document.createElement('div');
    paraTitle.className = 'sidebar-title';
    paraTitle.textContent = 'PARA';
    paraSection.appendChild(paraTitle);

    var paraTree = document.createElement('div');
    paraTree.className = 'folder-tree';

    for (var i = 0; i < VAULT_STRUCTURE.folders.length; i++) {
      var folder = VAULT_STRUCTURE.folders[i];
      var item = document.createElement('div');
      item.className = 'folder-item' + (activePath === folder.path ? ' active' : '');
      item.innerHTML = '<span class="folder-icon">' + folder.icon + '</span><span class="folder-name">' + folder.name + '</span>';
      item.onclick = (function(path) { return function() { navigateToPath(path); }; })(folder.path);
      paraTree.appendChild(item);
    }

    paraSection.appendChild(paraTree);
    sidebar.appendChild(paraSection);

    return sidebar;
  }

  function createFileGrid(files, path) {
    var grid = document.createElement('div');
    grid.className = 'file-grid';

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var card = document.createElement('div');
      card.className = 'file-card ' + file.type;

      var icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.textContent = file.icon;

      var name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = file.name;

      var meta = document.createElement('div');
      meta.className = 'file-meta';
      meta.textContent = file.modified;

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(meta);

      card.onclick = (function(f, p) { return function() { openFile(f, p); }; })(file, path);

      grid.appendChild(card);
    }

    return grid;
  }

  function createMarkdownViewer(content, fileName) {
    var viewer = document.createElement('div');
    viewer.className = 'markdown-viewer';
    viewer.innerHTML = simpleMarkdownParse(content);
    return viewer;
  }

  function simpleMarkdownParse(md) {
    if (!md) return '<p>Nenhum conteudo disponivel.</p>';

    // Escape HTML first
    var escaped = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Parse markdown
    var html = escaped
      // Headers
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Blockquotes
      .replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr>')
      // Unordered lists
      .replace(/^- (.*)$/gm, '<li>$1</li>')
      // Ordered lists
      .replace(/^\d+\. (.*)$/gm, '<li>$1</li>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      // Paragraphs (lines that don't match other patterns)
      .replace(/^(?!<[huplob]|$)(.*)$/gm, '<p>$1</p>')
      // Clean up empty paragraphs
      .replace(/<p><\/p>/g, '');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    // Remove duplicate ul tags
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    return html;
  }

  function createContentHeader(path, isFile) {
    var header = document.createElement('div');
    header.className = 'content-header';

    if (isFile) {
      var title = document.createElement('h1');
      title.className = 'content-title';
      title.textContent = currentFile ? currentFile.name : 'Arquivo';
      header.appendChild(title);
    } else {
      var folderName = path === '/' ? 'Vault' : path.split('/').pop();
      var title = document.createElement('h1');
      title.className = 'content-title';
      title.textContent = folderName;
      header.appendChild(title);
    }

    var pathDiv = document.createElement('div');
    pathDiv.className = 'content-path';

    // Build breadcrumb
    var parts = path.split('/').filter(Boolean);
    var crumbs = [];
    crumbs.push('<a href="#" onclick="navigateToPath(\'/\'); return false;">Vault</a>');

    var currentCrumb = '';
    for (var i = 0; i < parts.length; i++) {
      currentCrumb += '/' + parts[i];
      if (i === parts.length - 1 && !isFile) {
        crumbs.push('<span>' + parts[i] + '</span>');
      } else {
        crumbs.push('<a href="#" onclick="navigateToPath(\'' + currentCrumb + '\'); return false;">' + parts[i] + '</a>');
      }
    }

    pathDiv.innerHTML = crumbs.join(' <span>/</span> ');
    header.appendChild(pathDiv);

    return header;
  }

  function createBackButton() {
    var btn = document.createElement('button');
    btn.className = 'back-btn';
    btn.style.cssText = 'margin-bottom: 1rem; padding: 0.5rem 1rem; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); cursor: pointer;';
    btn.innerHTML = '\u2190 Voltar para lista';
    btn.onclick = function() { navigateToPath(currentPath); };
    return btn;
  }

  // ─── Views ───────────────────────────────────────────────────────────────

  function showAuthView() {
    var root = document.getElementById('app');
    root.innerHTML = '';

    var container = document.createElement('div');
    container.className = 'auth-section';

    var icon = document.createElement('div');
    icon.className = 'auth-icon';
    icon.textContent = '\u{1F4D0}';

    var title = document.createElement('h1');
    title.className = 'auth-title';
    title.textContent = 'Acesso ao Vault';

    var subtitle = document.createElement('p');
    subtitle.className = 'auth-subtitle';
    subtitle.textContent = 'Faca login com sua conta Google para acessar o vault Obsidian.';

    var loginBtn = document.createElement('button');
    loginBtn.className = 'google-btn';
    loginBtn.innerHTML = '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Entrar com Google';
    loginBtn.onclick = function() {
      buildAuthUrl().then(function(url) {
        window.location.href = url;
      }).catch(function(err) {
        console.error('Failed to build auth URL:', err);
      });
    };

    container.appendChild(icon);
    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(loginBtn);
    root.appendChild(container);
  }

  function showMainView(user, path) {
    var root = document.getElementById('app');
    root.innerHTML = '';

    // Header
    root.appendChild(createHeader(user));

    // Layout
    var layout = document.createElement('div');
    layout.className = 'app-layout';

    // Sidebar
    layout.appendChild(createSidebar(path));

    // Main content
    var main = document.createElement('main');
    main.className = 'main-content';

    // Content header
    main.appendChild(createContentHeader(path, false));

    // File grid
    var files = FILE_SYSTEM[path] || FILE_SYSTEM['/'];
    main.appendChild(createFileGrid(files, path));

    layout.appendChild(main);
    root.appendChild(layout);
  }

  function showFileView(user, file, path) {
    var root = document.getElementById('app');
    root.innerHTML = '';

    // Header
    root.appendChild(createHeader(user));

    // Layout
    var layout = document.createElement('div');
    layout.className = 'app-layout';

    // Sidebar
    layout.appendChild(createSidebar(path));

    // Main content
    var main = document.createElement('main');
    main.className = 'main-content';

    // Back button
    main.appendChild(createBackButton());

    // Content header
    main.appendChild(createContentHeader(path, true));

    // Markdown content
    var content = MARKDOWN_CONTENT[file.name] || '# Conteudo nao disponivel\n\nEste arquivo ainda nao tem conteudo carregado.';
    main.appendChild(createMarkdownViewer(content, file.name));

    layout.appendChild(main);
    root.appendChild(layout);
  }

  // ─── Navigation ─────────────────────────────────────────────────────────

  window.navigateToPath = function(path) {
    currentPath = path;
    currentFile = null;
    var token = getStoredToken();
    var user = getStoredUser();
    if (token && user) {
      showMainView(user, path);
    } else {
      showAuthView();
    }
  };

  window.openFile = function(file, path) {
    currentPath = path;
    currentFile = file;
    var token = getStoredToken();
    var user = getStoredUser();
    if (token && user) {
      showFileView(user, file, path);
    } else {
      showAuthView();
    }
  };

  function handleLogout() {
    clearSession();
    showAuthView();
    setTimeout(function() {
      buildAuthUrl().then(function(url) {
        window.location.href = url;
      });
    }, 500);
  }

  // ─── Auth Callback Handler ───────────────────────────────────────────────

  async function handleAuthCallback() {
    var params = new URLSearchParams(window.location.search);
    var code = params.get('code');
    var state = params.get('state');
    var error = params.get('error');

    // OAuth error from Google
    if (error) {
      showAuthView();
      return;
    }

    // Must have authorization code
    if (!code) {
      showAuthView();
      return;
    }

    // Validate state parameter (CSRF protection)
    var savedState = sessionStorage.getItem(STORAGE.OAuth_STATE);
    if (!state || state !== savedState) {
      showAuthView();
      return;
    }

    // Exchange code for tokens using PKCE verifier
    try {
      var tokens = await exchangeCodeForToken(code);

      if (!tokens.access_token) {
        throw new Error('No access token in response');
      }

      // Clean up PKCE artifacts
      sessionStorage.removeItem(STORAGE.PKCE_VERIFIER);
      sessionStorage.removeItem(STORAGE.OAuth_STATE);

      var user = await fetchUserInfo(tokens.access_token);
      storeSession(tokens.access_token, user);

      // Also set localStorage for consistency
      var session = {
        name: user.name || 'Usuario',
        email: user.email || '',
        picture: user.picture || null,
        exp: Date.now() / 1000 + (24 * 60 * 60)
      };
      localStorage.setItem(CONFIG.sessionKey, JSON.stringify(session));

      // Remove query params from URL
      window.history.replaceState(null, '', window.location.pathname);
      showMainView(user, '/');
    } catch (e) {
      showAuthView();
    }
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  function handleSearch(query) {
    if (!query || query.length < 2) return;

    // Simple search across file names
    var results = [];
    for (var path in FILE_SYSTEM) {
      var files = FILE_SYSTEM[path];
      for (var i = 0; i < files.length; i++) {
        if (files[i].name.toLowerCase().includes(query.toLowerCase())) {
          results.push({ file: files[i], path: path });
        }
      }
    }

    // For now, just navigate to first result or show message
    if (results.length > 0) {
      openFile(results[0].file, results[0].path);
    }
  }

  // ─── Init ───────────────────────────────────────────────────────────────

  function init() {
    // Detect callback path
    if (window.location.pathname === '/auth/callback') {
      handleAuthCallback();
      return;
    }

    // Check session
    var token = getStoredToken();
    var user = getStoredUser();

    if (!token || !isTokenValid(token)) {
      // Check localStorage for session from callback (auth code flow)
      var localSession = localStorage.getItem(CONFIG.sessionKey);
      if (localSession) {
        try {
          var sess = JSON.parse(localSession);
          if (sess.exp > Date.now() / 1000) {
            // Restore session: store in sessionStorage for consistency
            var storedUser = sess.user || {
              name: sess.name || 'Usuario',
              email: sess.email || '',
              picture: sess.picture || null
            };
            var storedToken = sess.access_token || sess.token || null;
            if (storedToken) {
              storeSession(storedToken, storedUser);
              token = storedToken;
              user = storedUser;
            } else {
              // No token in localStorage session - need to re-auth
              showAuthView();
              return;
            }
          } else {
            // Session expired
            showAuthView();
            return;
          }
        } catch (e) {
          showAuthView();
          return;
        }
      } else {
        showAuthView();
        return;
      }
    }

    if (!user) {
      // Token valid but no user - refetch userinfo
      showAuthView();
      return;
    }

    showMainView(user, '/');
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
