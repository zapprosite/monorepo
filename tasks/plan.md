# Plan: Perplexity-like Browser Agent

**Host:** will-zappro
**Date:** 2026-04-08
**Context:** SPEC.md criado para agente de busca com Streamlit + browser-use + MiniMax-M2.7 via API oficial (não OpenRouter).

---

## Executive Summary

Criar um agente autônomo de busca e navegação web que usa MiniMax-M2.7 via API oficial (OpenAI-compatible endpoint `https://api.minimax.chat/v1`) com browser-use + Playwright para automação de browser com Chrome profile persistente.

---

## Key Findings — MiniMax M2.7 API

### Dois Endpoints (não misturar!)

| Tipo | Base URL | Auth Env Var | SDK |
|------|----------|--------------|-----|
| **OpenAI-compatible** | `https://api.minimax.chat/v1` | `MINIMAX_TOKEN` | `ChatOpenAI` |
| **Anthropic-compatible** | `https://api.minimax.io/anthropic` | `ANTHROPIC_API_KEY` | `ChatAnthropic` |

**Decisão:** Usar **OpenAI-compatible** (`MINIMAX_TOKEN` do Infisical) + `ChatOpenAI`

### Model Name
- **Model:** `MiniMax-M2.7` (não `minimax/minimax-m2.7` que é formato OpenRouter)
- **Context window:** 204,800 tokens
- **Speed:** ~60 tps

### browser-use Integration
browser-use suporta `ChatOpenAI` (built-in) — compatível com MiniMax.

---

## Dependency Graph

```
[1. Setup Projeto + Deps]
        │
        ▼
[2. Chrome Profile Setup]
        │
        ▼
[3. Basic Streamlit UI] ───────────────────────────────────┐
        │                                                   │
        ▼                                                   │
[4. browser-use Agent (ChatOpenAI + MiniMax)]               │
        │                                                   │
        ▼                                                   │
[5. Test: Busca Simples]                                    │
        │                                                   │
        ▼                                                   │
[6. Test: Sessão Google Autenticada]                        │
        │                                                   │
        ▼                                                   │
[7. Coolify Deployment] ─────────────────────────────────────┤
        │                                                   │
        ▼                                                   │
[8. Subdomain + Cloudflare Tunnel] ◄────────────────────────┘
```

---

## Vertical Slices

### Slice 1: Setup Projeto + Deps

**Objetivo:** Criar estrutura do projeto com uv e dependências.

**Files to create:**
```
/srv/monorepo/apps/perplexity-agent/
├── pyproject.toml
├── app.py                  # Streamlit UI (placeholder)
├── agent/
│   ├── __init__.py
│   ├── browser_agent.py     # placeholder
│   └── chrome_profile.py    # placeholder
├── config.py               # env vars
└── chrome-profile/        # gitignored
```

**Commands:**
```bash
cd /srv/monorepo/apps
mkdir -p perplexity-agent/agent perplexity-agent/chrome-profile
cd perplexity-agent
uv init --name perplexity-agent
uv add streamlit browser-use
uv add playwright  # se nãoInstalled
uvx browser-use install
```

**Verification:**
```bash
cd /srv/monorepo/apps/perplexity-agent
uv run python -c "import streamlit; import browser_use; print('OK')"
```

---

### Slice 2: Chrome Profile Setup

**Objetivo:** Criar diretório de Chrome profile e script de inicialização.

**Files to create:**
- `/srv/monorepo/apps/perplexity-agent/agent/chrome_profile.py`
- Chrome profile path: `/srv/data/perplexity-agent/chrome-profile/`

**Logic:**
- Verificar se Chrome está instalado
- Criar diretório de profile se não existir
- Documentar como fazer login manual nos sites

**Verification:**
```bash
ls -la /srv/data/perplexity-agent/chrome-profile/
# Deve existir mas estar vazio (login é manual)
```

---

### Slice 3: Basic Streamlit UI

**Objetivo:** UI minimal para testar Chat interface.

**Files to modify:**
- `/srv/monorepo/apps/perplexity-agent/app.py`

**Features:**
- `st.title("Perplexity Agent")`
- Chat input (`st.chat_input`)
- Display chat history
- Placeholder para resposta do agent
- Status do browser (sidebar)

**Verification:**
```bash
cd /srv/monorepo/apps/perplexity-agent
uv run streamlit run app.py --port 4004 --server.headless true
# Abrir http://localhost:4004
```

---

### Slice 4: browser-use Agent Integration

**Objetivo:** Integrar browser-use Agent com ChatOpenAI + MiniMax.

**Files to modify:**
- `/srv/monorepo/apps/perplexity-agent/agent/browser_agent.py`
- `/srv/monorepo/apps/perplexity-agent/config.py`

**Key implementation:**
```python
# config.py
import os
from infisical_sdk import InfisicalSDKClient

def get_minimax_token():
    client = InfisicalSDKClient(
        host='http://127.0.0.1:8200',
        token=os.environ.get('INFISICAL_TOKEN') or open('/srv/ops/secrets/infisical.service-token').read().strip()
    )
    secrets = client.secrets.list_secrets(
        project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
        environment_slug='dev',
        secret_path='/'
    )
    for s in secrets.secrets:
        if s.secret_key == 'MINIMAX_TOKEN':
            return s.secret_value
    raise ValueError("MINIMAX_TOKEN not found in Infisical")

# browser_agent.py
from browser_use import Agent
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="MiniMax-M2.7",
    base_url="https://api.minimax.chat/v1",
    api_key=get_minimax_token(),
)
```

**Verification:**
```bash
cd /srv/monorepo/apps/perplexity-agent
uv run python -c "
from agent.browser_agent import get_agent
print('Agent initialized OK')
"
```

---

### Slice 5: Test — Busca Simples

**Objetivo:** Testar agent fazendo uma busca no DuckDuckGo.

**Test:**
```python
agent = get_agent()
result = agent.run("Search for 'what is Claude AI' on DuckDuckGo and tell me the first result")
print(result)
```

**Verification:**
- Agent retorna resposta com fonte
- Nenhum erro de API
- Browser abre e fecha corretamente

---

### Slice 6: Test — Sessão Google Autenticada

**Objetivo:** Testar com Chrome profile que tem sessão Google.

**Prerequisite:** Login manual no Google via Chrome.

**Test:**
```python
agent = get_agent(chrome_profile_path="/srv/data/perplexity-agent/chrome-profile")
result = agent.run("Go to Google and search for my emails - just check if you're logged in")
```

**Verification:**
- Agent detecta que está logado
- Não pede login
- Retorna informação personalizada

---

### Slice 7: Coolify Deployment

**Objetivo:** Deploy no Coolify via terraform.

**Files to modify:**
- `/srv/ops/terraform/cloudflare/variables.tf` — adicionar `perplexity` service
- `/srv/ops/terraform/cloudflare/main.tf` — adicionar `cloudflare_zero_trust_tunnel_cloudflared_config` para perplexity

**Commands:**
```bash
cd /srv/ops/terraform/cloudflare
terraform plan -out=perplexity.tfplan
terraform apply perplexity.tfplan
```

**Coolify:**
- Build Docker image do projeto
- Expor porta 4004 internamente
- Configurar health check

**Verification:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4004/health
# Esperado: 200
```

---

### Slice 8: Subdomain + Cloudflare Tunnel

**Objetivo:** Expor web.zappro.site via Cloudflare Access.

**Files to modify:**
- `/srv/ops/terraform/cloudflare/variables.tf` — adicionar perplexity aos services
- `/srv/ops/terraform/cloudflare/main.tf` — configurar ingress_rule

**Verification:**
```bash
curl -s -o /dev/null -w "%{http_code}" https://web.zappro.site
# Esperado: 200 (via Cloudflare Access)
```

---

## Checkpoints

1. **After Slice 1:** `uv run python -c "import streamlit; import browser_use"` OK
2. **After Slice 2:** Chrome profile directory existe em `/srv/data/perplexity-agent/chrome-profile/`
3. **After Slice 3:** Streamlit UI acessível em `:4004`
4. **After Slice 4:** Agent inicializa com MiniMax API OK
5. **After Slice 5:** Busca simples retorna resultado com fonte
6. **After Slice 6:** Sessão Google persiste entre restarts
7. **After Slice 7:** Container no Coolify rodando
8. **After Slice 8:** web.zappro.site responde 200

---

## Condições de Borde

### Sempre fazer
- `MINIMAX_TOKEN` do Infisical (nunca hardcoded)
- Chrome profile gitignored
- Budget tracking ($50/mês)

### Nunca fazer
-露天 Expor sem Cloudflare Access
-露天 Commitar Chrome profile ou secrets
-露天 Exceder 15k req/dia

---

## O Que NÃO Fazer (Futuro)

- Multiple browser profiles (escopo atual é 1)
- Multi-user support (escopo atual é 1 usuário)
- History persistence (escopo atual é stateless)
- Screenshot storage (escopo atual é memory only)

---

## Last Updated

2026-04-08 — após análise docs MiniMax M2.7 API
