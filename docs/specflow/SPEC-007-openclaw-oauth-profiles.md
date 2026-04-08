# SPEC-007: OpenClaw OAuth Persistent Login (Multi-Account)

**Status:** PROPOSED
**Created:** 2026-04-08
**Author:** will

---

## Overview

Configurar perfis Chrome persistentes no OpenClaw para login OAuth de dois serviços distintos (Gemini + Perplexity) com sessões persistidas entre reinicializações do container.

---

## Goals

### Must Have
- [ ] Perfil Chrome persistente via host path mount (`/srv/data/openclaw-chrome-profiles/`)
- [ ] Login OAuth funcional em `web.zappro.site` com credenciais Gemini
- [ ] Login OAuth funcional em `web.zappro.site` com credenciais Perplexity
- [ ] Sessões persistem após restart do container `browser-*`
- [ ] Múltiplos perfis Chrome (1 por serviço) gerenciados pelo OpenClaw

### Should Have
- [ ] Script de automation via CDP para pre-login (evitar setup manual)
- [ ] Health check verificando sessões OAuth ativas
- [ ] Credenciais separadas no Infisical (GEMINI_OAUTH_SESSION, PERPLEXITY_OAUTH_SESSION)

---

## Non-Goals

- Autenticação simultânea de ambos no mesmo perfil (dois contextos distintos)
- Gerenciamento de tokens de refresh (escopo do OAuth provider)
- Mobile app OAuth (web only)

---

## Architecture

```
/srv/data/openclaw-chrome-profiles/
├── gemini-profile/     → Chromium profile para Gemini
│   └── Default/
└── perplexity-profile/  → Chromium profile para Perplexity
    └── Default/
```

**Stack:**
- OpenClaw bot container (`openclaw-*`)
- Browser container (`browser-*`) com Chromium
- Chrome profiles montados do host → container via volume
- CDP (Chrome DevTools Protocol) para automation
- Infisical para credenciais

---

## Implementation

### Step 1: Criar diretórios de perfil no host

```bash
mkdir -p /srv/data/openclaw-chrome-profiles/{gemini-profile,perplexity-profile}/Default
chmod -R 777 /srv/data/openclaw-chrome-profiles/
```

### Step 2: Identificar como o browser container monta volumes

O container `browser-qgtzrmi6771lt8l7x8rqx72f` monta:
- `qgtzrmi6771lt8l7x8rqx72f_browser-data` → `/config`

O Chromium guarda perfil em `/config/.config/chromium/Default/`

### Step 3: Estratégia de mount

**Opção A:** Substituir `/config/.config/chromium` por symlink para host path
**Opção B:** Recriar container via Coolify com binds de volume customizados
**Opção C:** Usar `chrome-profile-path` no openclaw.json se suportado

### Step 4: Automation OAuth via CDP

Script Node.js/Playwright que:
1. Conecta ao CDP do browser (`http://browser:9223`)
2. Cria novo contexto (profile gemini ou perplexity)
3. Navega para `web.zappro.site`
4. Executa login OAuth com credenciais do Infisical
5. Persiste cookies e localStorage no perfil

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Gemini OAuth funciona em `web.zappro.site` | Login persiste após restart do container |
| AC-2 | Perplexity OAuth funciona em `web.zappro.site` | Login persiste após restart do container |
| AC-3 | Perfis são separados (cookies distintos) | Sem sangria de sessão entre contas |
| AC-4 | OpenClaw consegue usar cada perfil | Bot pode browse logado como cada serviço |

---

## Risks

- **Coolify pode sobrescrever volumes** na próxima deploy → precisa de annotation ou bind permanente
- **OAuth tokens expiram** → requer re-auth periódica ou token refresh
- **Docker volume permissions** → usuário `abc` no container vs `will` no host

---

## Dependencies

- OpenClaw deployment via Coolify
- Infisical secrets para credenciais
- Browser container com Chromium + CDP exposure

---

## File Structure

```
docs/specflow/SPEC-007-openclaw-oauth-profiles.md  ← esta spec
skills/openclaw-chrome-profiles/
├── setup-profiles.sh                               ← cria dirs no host
├── oauth-login.js                                  ← automation via CDP
└── README.md
```
