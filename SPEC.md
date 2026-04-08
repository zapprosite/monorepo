# SPEC.md — Perplexity-like Browser Agent

**Versão:** 0.2
**Data:** 2026-04-08
**Status:** Draft
**Stack:** Streamlit + browser-use + MiniMax Official API

---

## 1. Objetivo

Criar um agente de busca e navegação web autônomo (Perplexity-like) que:
- Recebe perguntas em linguagem natural
- Navega na web usando browser com sessão autenticada (Chrome profile)
- Extrai conteúdo relevante
- Responde com fontes e citations
- Usa MiniMax-M2.7 via API oficial MiniMax (OpenAI-compatible)

**Usuários:** Você (homelab will-zappro)

---

## 2. Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                    Streamlit UI (:4004)                         │
│   - Chat input                                               │
│   - Output: resposta + fontes + citations                   │
│   - Status do browser                                        │
└──────────────────────────┬─────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Agent (browser-use)                           │
│                                                              │
│   Task: "Search for X, navigate to Y, extract Z"           │
│   LLM: ChatOpenAI(                                           │
│          model="MiniMax-Text-01",                          │
│          base_url="https://api.minimax.chat/v1",           │
│          api_key=MINIMAX_TOKEN  ← Infisical                 │
│        )                                                     │
│   Browser: Playwright + Chrome Profile (sessões persistidas) │
└──────────────────────────┬─────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Chrome Profile                               │
│   Sessões logadas: Google, YouTube, sites autenticados       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    MiniMax Official API                      │
│   Endpoint: https://api.minimax.chat/v1                     │
│   Model: MiniMax-Text-01 (ou minimax-m2.7)                  │
│   Auth: MINIMAX_TOKEN (Infisical)                           │
│   Custo: $0.0000003/1M tokens (prompt) + $0.0000012/1M     │
│   Budget: $50/mês — 15k req/dia                             │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Componente | Tecnologia | Instalação |
|-----------|------------|------------|
| UI | Streamlit | `uv add streamlit` |
| Agent | browser-use | `uv add browser-use` |
| Browser | Playwright + Chrome | `uvx browser-use install` |
| LLM | ChatOpenAI (MiniMax official, OpenAI-compatible) | browser-use built-in |
| Runtime | Python 3.11+ | uv |

---

## 4. Funcionalidades

### 4.1 Core Features

- [ ] **Chat Interface** — input de pergunta, output de resposta
- [ ] **Browser Automation** — Playwright controled por agente
- [ ] **Chrome Profile Persistence** — manter sessões de login
- [ ] **Stream de Respostas** — responder em tempo real (opcional)
- [ ] **Citations** — listar fontes URLs usadas
- [ ] **Search Integration** — buscar antes de navegar (DuckDuckGo ou Google)

### 4.2 Browser Sessions

- Chrome profile em `/srv/data/perplexity-agent/chrome-profile/`
- Sessões persistidas entre reinicializações
- Você faz login manual nos sites que precisar (Google, etc.)

### 4.3 Commands

```bash
# Development
cd /srv/monorepo/apps/perplexity-agent
uv sync
uv run streamlit run app.py --port 4004

# Install browser
uvx browser-use install

# Production (Coolify)
# Exposed on web.zappro.site (same domain as OpenClaw web services)
```

---

## 5. Projeto Structure

```
/srv/monorepo/apps/perplexity-agent/
├── app.py                  # Streamlit UI
├── agent/
│   ├── __init__.py
│   ├── browser_agent.py     # browser-use Agent wrapper
│   └── chrome_profile.py   # Chrome profile management
├── config.py               # Settings, env vars
├── requirements.txt        # ou pyproject.toml
└── chrome-profile/        # Chrome user data dir (gitignored)
    └── sessions/           # Sessões de sites logados
```

---

## 6. Configuração

### Environment Variables

```bash
MINIMAX_TOKEN=sk-cp-uA1oy3...  # MiniMax official API key (Infisical)
CHROME_PROFILE_PATH=/srv/data/perplexity-agent/chrome-profile
STREAMLIT_PORT=4004
```

### Secrets (Infisical)

Adicionar ao Infisical project `zappro-p-tc-k`:
- `MINIMAX_TOKEN` — MiniMax official API key

---

## 7. Condições de Borde

### ✅ Sempre fazer
- Manter Chrome profile com sessões de login
- Budget tracking — alertas se $50/mês excedido
- Logs de cada sessão de navegação

### ❌ Nunca fazer
-露天 Expor porta sem Cloudflare Access
-露天 Commitar Chrome profile ou secrets
-露天 Exceder budget de 15k req/dia sem aviso

---

## 8. Etapas de Implementação

| Etapa | Descrição | Status |
|-------|-----------|--------|
| 1 | Setup projeto + deps | PENDING |
| 2 | Chrome profile setup | PENDING |
| 3 | Basic Streamlit UI | PENDING |
| 4 | browser-use Agent integration (ChatOpenAI + MiniMax) | PENDING |
| 5 | Test: busca simples | PENDING |
| 6 | Test: sessão Google autenticada | PENDING |
| 7 | Coolify deployment | PENDING |
| 8 | subdomain web.zappro.site | PENDING |

---

## 9. Métricas de Sucesso

- [ ] Agent responde perguntas de busca com fontes
- [ ] Chrome profile persiste sessão entre restarts
- [ ] Budget $50/mês não excedido
- [ ] Deployed on Coolify via terraform
- [ ] Subdomain web.zappro.site funcionando

---

## 10. Não Escopo (Futuro)

- Multiple browser profiles
- Multi-user support
- History persistence
- Screenshot storage
- Custom search engines
