# SPEC-007: OpenClaw OAuth Persistent Login (Multi-Service CLI-First)

**Status:** PROPOSED
**Created:** 2026-04-08
**Updated:** 2026-04-08
**Author:** will

---

## Overview

Configurar login OAuth persistente para OpenClaw (CEO MIX agent) comandar Perplexity Agent em `localhost:4004`. Solução **CLI-first** — nenhum n8n ou webhook intermediary.

---

## Architecture (CLI-Only)

```
┌─────────────────────────────────────────────────────────────┐
│                   CEO MIX (OpenClaw Bot)                    │
│  Browser automation via CDP                                  │
│  Navigate: https://localhost:4004 (OAuth session)          │
│  Executes commands on Perplexity UI                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (CDP direct navigation, no n8n)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Perplexity Agent (Streamlit)                    │
│  🌐 localhost:4004:4004                                    │
│  OAuth UI: persona selector (gemini / perplexity)          │
└─────────────────────────────────────────────────────────────┘
```

**Perplexity Query CLI (alternativa direta, sem browser):**

```bash
# scripts/perplexity-query.sh
PERPLEXITY_API_KEY="$(infisical get PERPLEXITY_API_KEY)" \
curl -s -X POST "https://api.perplexity.ai/chat/completions" \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"sonar\",\"messages\":[{\"role\":\"user\",\"content\":\"$1\"}]}"
```

---

## Goals

### Must Have
- [ ] Chrome profile persistente via host path mount (`/srv/data/openclaw-chrome-profiles/`)
- [ ] Login OAuth funciona em `localhost:4004` (Gemini + Perplexity personas)
- [ ] Sessões persistem após restart do container `browser-*`
- [ ] CEO MIX (OpenClaw) consegue navegar logado via CDP

### Should Have
- [ ] CLI script `perplexity-query.sh` para query direta API
- [ ] Smoke test verificando OAuth ativo

---

## Non-Goals

- n8n ou qualquer webhook intermediary
- Mobile app OAuth
- Real-time token refresh automation

---

## Implementation

### Step 1: Criar diretórios de perfil no host

```bash
mkdir -p /srv/data/openclaw-chrome-profiles/{gemini-profile,perplexity-profile}/Default
chmod -R 777 /srv/data/openclaw-chrome-profiles/
```

### Step 2: Identificar volume mount do browser container

Container `browser-qgtzrmi6771lt8l7x8rqx72f` monta:
- `qgtzrmi6771lt8l7x8rqx72f_browser-data` → `/config`

Chromium guarda perfil em `/config/.config/chromium/Default/`

### Step 3: Estratégia de mount

**Opção A (recomendada):** Recriar container via Coolify com binds:
```yaml
# docker-compose override
volumes:
  - /srv/data/openclaw-chrome-profiles/gemini-profile:/config/.config/chromium/gemini
  - /srv/data/openclaw-chrome-profiles/perplexity-profile:/config/.config/chromium/perplexity
```

**Opção B:** Symlink dentro do container:
```bash
# inside container
ln -sf /host/path/gemini-profile /config/.config/chromium/Default
```

### Step 4: OAuth Login Manual

1. Abrir browser com perfil gemini → navegar para `localhost:4004`
2. Fazer login OAuth com conta Gemini
3. Repetir para perfil perplexity
4. Perfis guardados em `/srv/data/openclaw-chrome-profiles/`

### Step 5: CLI Query Script

```bash
#!/bin/bash
# scripts/perplexity-query.sh
API_KEY="${PERPLEXITY_API_KEY:-$(infisical get PERPLEXITY_API_KEY)}"
curl -s -X POST "https://api.perplexity.ai/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"sonar\",\"messages\":[{\"role\":\"user\",\"content\":\"$1\"}]}"
```

---

## File Structure

```
scripts/
├── perplexity-query.sh                      # CLI query direta
└── oauth-chrome-profiles.sh                 # setup dirs + validation

docs/specflow/
└── SPEC-007-openclaw-oauth-profiles.md     # esta spec

apps/openclaw/
└── n8n-workflows/                          # DELETED - sem n8n
```

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Chrome profile persiste | Restart container → cookies intactos |
| AC-2 | Gemini OAuth funciona | Login persiste após restart |
| AC-3 | Perplexity OAuth funciona | Login persiste após restart |
| AC-4 | CEO MIX navega logado | OpenClaw CDP → localhost:4004 como usuário |
| AC-5 | CLI query funciona | `./perplexity-query.sh "test"` → JSON response |

---

## Dependencies

- OpenClaw deployment via Coolify
- Infisical secrets (PERPLEXITY_API_KEY)
- Browser container com Chromium + CDP exposure

---

**Registrado:** 2026-04-08
**Autor:** will
