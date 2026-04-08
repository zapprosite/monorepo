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
- Usa GPT-4o-mini via OpenRouter (custo-benefício) com fallbacks

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
│   Fallback: MiniMax M2.7 → Ollama qwen3:14b                  │
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
| LLM Primary | ChatOpenAI (OpenRouter GPT-4o-mini) | `uv add langchain-openai` |
| LLM Fallback | ChatAnthropic (MiniMax M2.7) + Ollama | `uv add langchain-anthropic langchain-ollama` |
| Secrets | Infisical | system-wide |
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
OPENROUTER_API_KEY=sk-or-v1-...  # OpenRouter key (Infisical)
MINIMAX_TOKEN=sk-cp-uA1oy3...    # MiniMax fallback (Infisical)
CHROME_PROFILE_PATH=/srv/data/perplexity-agent/chrome-profile
STREAMLIT_PORT=4004
```

### Secrets (Infisical)

No Infisical project `zappro-p-tc-k`:
- `OPENROUTER_API_KEY` — OpenRouter API key (primary)
- `MINIMAX_TOKEN` — MiniMax token (fallback)

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
