# Arquitetura — Hermes LLM Gateway via LiteLLM (Padronização)

**Data:** 2026-05-04
**Status:** Padrão — seguir em todos os serviços

---

## Regra Principal

> **LiteLLM é o gateway único.** Todos os serviços chamam `localhost:4018/v1` com aliases `hermes-*`. OpenRouter é um provider interno do LiteLLM, nunca chamado diretamente.

| | LiteLLM Proxy (Gateway) | OpenRouter (Provider Interno) |
|--|--|--|
| **Tipo** | Proxy/gateway OpenAI-compat | Provedor cloud (escalada) |
| **Endpoint** | `http://127.0.0.1:4018/v1` | `https://openrouter.ai/api/v1` (via LiteLLM) |
| **Auth** | `LITELLM_MASTER_KEY` | `OPENROUTER_API_KEY` (config do LiteLLM) |
| **Models expostos** | `hermes-*` (aliases unificados) | `deepseek-v4-*`, `kimi-k2.6` (mapeados pelos aliases) |
| **Uso direto por agents** | ✅ SEMPRE | ❌ NUNCA (somente LiteLLM consome) |

---

## Aliases Hermes (Modelos Expostos)

| Alias | Backend | Uso |
|-------|---------|-----|
| `hermes-auto` | Ollama `qwen2.5-coder:14b-q6k` | Padrão — local primeiro, fallback cloud |
| `hermes-local-code` | Ollama `qwen2.5-coder:14b-q6k` | Code/texto local determinístico |
| `hermes-vision` | Ollama `qwen2.5vl:3b` | Visão/multimodal local |
| `hermes-embed` | Ollama `nomic-embed-text:pinned-20260503` | Embedding local |
| `hermes-cloud-cheap` | OpenRouter `deepseek/deepseek-v4-flash` | Fallback barato cloud |
| `hermes-cloud-pro` | OpenRouter `deepseek/deepseek-v4-pro` | Escalada qualidade |
| `hermes-cloud-ui` | OpenRouter `moonshotai/kimi-k2.6` | UI/multimodal cloud |
| `hermes-brain` | OpenRouter `deepseek/deepseek-v4-pro` | Alias forte para tarefas difíceis |

---

## Como Chamar (Python)

```python
import os, requests

base_url = os.environ.get("OPENAI_BASE_URL", "http://127.0.0.1:4018/v1")
key = os.environ["LITELLM_MASTER_KEY"]

# Chat
response = requests.post(
    f"{base_url}/chat/completions",
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    json={"model": "hermes-auto", "messages": [{"role": "user", "content": "..."}]}
)

# Embedding
response = requests.post(
    f"{base_url}/embeddings",
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    json={"model": "hermes-embed", "input": "..."}
)
```

**Env vars obrigatórias:**
- `OPENAI_BASE_URL=http://127.0.0.1:4018/v1`
- `LITELLM_MASTER_KEY`
- `OPENROUTER_API_KEY` (só o LiteLLM consome — não exponha a agents)

---

## Arquitetura de Rede

```
              Agente / App / OpenWebUI / MCP
                           │
                           │ OPENAI_BASE_URL
                           │ http://127.0.0.1:4018/v1
                           │ Authorization: Bearer LITELLM_MASTER_KEY
                           ▼
              ┌────────────────────────────┐
              │     LiteLLM Proxy          │
              │     :4018/v1               │
              │  (OpenAI-compatible)       │
              └────────────┬───────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │   Ollama   │  │  OpenRouter│  │  OpenRouter│
    │  :11434    │  │ (escalada) │  │ (escalada) │
    │  (local)   │  │ cheap/pro  │  │    ui      │
    └────────────┘  └────────────┘  └────────────┘
```

---

## Env Vars (`.env`)

```
OPENAI_BASE_URL=http://127.0.0.1:4018/v1
LITELLM_MASTER_KEY=sk-master-...
LITELLM_OLLAMA_URL=http://host.docker.internal:11434
OPENROUTER_API_KEY=sk-or-...
```

---

## Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| Chamar OpenRouter direto com `OPENROUTER_API_KEY` | Bypass do gateway | Sempre usar LiteLLM (`hermes-*`) |
| Usar `OPENROUTER_API_KEY` no header do LiteLLM | Confundir chaves | LiteLLM usa `LITELLM_MASTER_KEY` |
| Usar alias antigo (`zappro-clima-tutor`, `embedding-nomic`) | Config desatualizada | Migrar para `hermes-*` |
| Apontar para `localhost:4000` ou `4002` | Porta legada | Usar `4018/v1` |

---

## Checklist para Novos Serviços

- [ ] Sempre usar `OPENAI_BASE_URL=http://127.0.0.1:4018/v1`
- [ ] Sempre usar `LITELLM_MASTER_KEY` no header `Authorization: Bearer ...`
- [ ] Selecionar alias `hermes-*` conforme tier (auto, local-code, vision, embed, brain)
- [ ] NUNCA chamar OpenRouter diretamente
- [ ] NUNCA hardcodar `OPENROUTER_API_KEY` em código de agente
