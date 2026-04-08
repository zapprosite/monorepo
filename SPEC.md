# SPEC.md — Perplexity-like Browser Agent

**Versão:** 0.3
**Data:** 2026-04-08
**Status:** Draft
**Stack:** Streamlit + browser-use + OpenRouter (GPT-4o-mini)

---

## 1. Objetivo

Criar um agente de busca e navegação web autônomo (Perplexity-like) que:
- Recebe perguntas em linguagem natural
- Navega na web usando browser com sessão autenticada (Chrome profile)
- Extrai conteúdo relevante
- Responde com fontes e citations
- Usa GPT-4o-mini via OpenRouter (custo-benefício)

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
│   LLM (primary): ChatOpenAI(                                 │
│          model="openai/gpt-4o-mini",                       │
│          base_url="https://openrouter.ai/api/v1",           │
│          api_key=OPENROUTER_API_KEY ← Infisical             │
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
│                    OpenRouter API                              │
│   Model: openai/gpt-4o-mini                                  │
│   Custo: $0.15/1M (prompt) + $0.60/1M (completion)          │
│   Auth: OPENROUTER_API_KEY (Infisical)                       │
└──────────────────────────────────────────────────────────────┘
```
```

---

## 3. Tech Stack

| Componente | Tecnologia | Instalação |
|-----------|------------|------------|
| UI | Streamlit | `uv add streamlit` |
| Agent | browser-use | `uv add browser-use` |
| Browser | Playwright + Chrome | `uvx browser-use install` |
| LLM | ChatOpenAI (OpenRouter GPT-4o-mini) | `uv add langchain-openai` |
| Secrets | Infisical | system-wide |
| Runtime | Python 3.11+ | uv |
| Container | Docker | Dockerfile |

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

# Docker build (local test)
docker build -t perplexity-agent:latest .
docker run -p 4004:4004 \
  -v /srv/data/perplexity-agent/chrome-profile:/srv/data/perplexity-agent/chrome-profile \
  perplexity-agent:latest

# Docker Compose (local test)
docker-compose up -d

# Production (Coolify)
# Build from Dockerfile in apps/perplexity-agent/
# Exposed on web.zappro.site (same domain as OpenClaw web services)
```

---

## 5. Projeto Structure

```
/srv/monorepo/apps/perplexity-agent/
├── Dockerfile              # Coolify deployment
├── docker-compose.yml      # Local dev/test
├── .streamlit/config.toml  # Streamlit headless config
├── app.py                  # Streamlit UI
├── agent/
│   ├── __init__.py
│   ├── browser_agent.py     # browser-use Agent wrapper
│   └── chrome_profile.py   # Chrome profile management
├── config.py               # Settings, env vars
├── pyproject.toml          # uv dependencies
├── uv.lock                 # Locked versions
└── chrome-profile/        # Chrome user data dir (gitignored)
    └── sessions/           # Sessões de sites logados
```

---

## 6. Configuração

### Environment Variables

```bash
OPENROUTER_API_KEY=sk-or-v1-...  # OpenRouter key (Infisical)
CHROME_PROFILE_PATH=/srv/data/perplexity-agent/chrome-profile
STREAMLIT_PORT=4004
```

### Secrets (Infisical)

No Infisical project `zappro-p-tc-k`:
- `OPENROUTER_API_KEY` — OpenRouter API key

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
| 1 | Setup projeto + deps | ✅ DONE |
| 2 | Chrome profile setup | ✅ DONE |
| 3 | Basic Streamlit UI | ✅ DONE |
| 4 | browser-use Agent integration (OpenRouter GPT-4o-mini) | ✅ DONE |
| 5 | Test: busca simples | ✅ DONE |
| 6 | Test: sessão Google autenticada | ✅ DONE |
| 7 | Coolify deployment | ⏳ IN PROGRESS |
| 8 | subdomain web.zappro.site | ✅ DONE (terraform apply) |

---

## 9. Métricas de Sucesso

- [x] Agent responde perguntas de busca com fontes (GPT-4o-mini working)
- [x] Chrome profile persiste sessão entre restarts
- [ ] Budget $50/mês não excedido (monitorar)
- [ ] Deployed on Coolify via terraform
- [x] Subdomain web.zappro.site funcionando (terraform applied)

---

## 10. Não Escopo (Futuro)

- Multiple browser profiles
- Multi-user support
- History persistence
- Screenshot storage
- Custom search engines
