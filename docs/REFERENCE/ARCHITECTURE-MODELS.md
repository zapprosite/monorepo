# Arquitetura — MiniMax vs LiteLLM (Padronização)

**Data:** 2026-04-08
**Status:** Padrão — seguir em todos os serviços

---

## Regra Principal

> **MiniMax e LiteLLM são SEPARADOS.** Nunca misturar.

| | MiniMax Official | LiteLLM Proxy |
|--|--|--|
| **Tipo** | API oficial do provedor | Proxy/ gateway p/ múltiplos provedores |
| **Endpoint** | `https://api.minimax.chat` | `localhost:4000` |
| **Auth** | `MINIMAX_TOKEN` | `LITELLM_MASTER_KEY` |
| **Models** | `MiniMax-Text-01`, `MiniMax-Embedding` | Unificado (OpenAI-style) |
| **Uso direto** | ✅ Sim | ✅ Sim |
| **Via proxy LiteLLM** | ✅ Configurado como provider | N/A |

---

## MiniMax Official API

**Quando usar:** Chamadas diretas ao provedor MiniMax, sem passar pelo LiteLLM.

```python
# Exemplo Python
import os
MINIMAX_API_KEY = os.environ.get("MINIMAX_TOKEN")

response = requests.post(
    "https://api.minimax.chat/v1/text/chatcompletion_v2",
    headers={"Authorization": f"Bearer {MINIMAX_TOKEN}"},
    json={...}
)
```

**Env vars:**
- `MINIMAX_API_KEY` ou `MINIMAX_TOKEN`

---

## LiteLLM Proxy (localhost:4000)

**Quando usar:** Proxy unificado para múltiplos provedores (OpenAI, Claude, Groq, MiniMax, etc.)

```python
# Exemplo Python —via LiteLLM
import os
LITELLM_KEY = os.environ.get("LITELLM_MASTER_KEY")

response = requests.post(
    "http://localhost:4000/v1/chat/completions",
    headers={"Authorization": f"Bearer {LITELLM_KEY}"},
    json={"model": "gpt-4o", ...}
)
```

**Models disponíveis no LiteLLM local:**
```
gpt-4o, gpt-4o-mini, claude-3-5-sonnet, groq/llama-3.3-70b,
minimax-ot-01 (MiniMax via LiteLLM), ...
```

**Env vars:**
- `LITELLM_MASTER_KEY` — master key do proxy
- `LITELLM_VIRTUAL_KEY` — virtual key (mesmo valor)

---

## Arquitetura de Rede

```
                    ┌─────────────────────────────────────┐
                    │         localhost:4000           │
                    │            (LiteLLM proxy)          │
                    │                                     │
  OpenClaw ────────│  LITELLM_MASTER_KEY ──────────────►│
  OpenWebUI ───────│                                     │
  MCP-Qdrant ──────│                                     │
                    └─────────────────────────────────────┘
                                    │
                                    │ (pode rotear para
                                    │  MiniMax, OpenAI,
                                    │  Claude, etc.)
                                    ▼
                         ┌──────────────────┐
                         │   api.minimax.chat│
                         │  (MiniMax oficial)│
                         │                  │
                         │  MINIMAX_TOKEN ──►│
                         └──────────────────┘

  OpenClaw ──────────────│────────────────────────────────►
  (chamadas diretas)     │   MINIMAX_TOKEN (não via proxy)
                         └────────────────────────────────►
```

---

## OpenClaw Bot — Padrão

**Referência:** `/srv/data/openclaw/AURELIA_SECRETS.env`

```
LITELLM_MASTER_KEY=sk-master-b83cfa00...   # LiteLLM proxy (localhost:4000)
MINIMAX_TOKEN=sk-cp-uA1oy3...              # MiniMax direto
```

- LiteLLM para models via proxy
- MiniMax Token para chamadas diretas ao MiniMax

---

## Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| Misturar `MINIMAX_TOKEN` como key do LiteLLM | Confundir serviços | São SEPARADOS |
| Usar `MINIMAX_TOKEN` no header do LiteLLM | Provedor diferente | LiteLLM usa `LITELLM_MASTER_KEY` |
| Chamar `api.minimax.chat` com key do LiteLLM | Endereço errado | Usar endpoint correto |

---

## Checklist para Novos Serviços

- [ ] Descobrir se usa LiteLLM proxy ou MiniMax direto
- [ ] Se LiteLLM → usar `LITELLM_MASTER_KEY` no header
- [ ] Se MiniMax direto → usar `MINIMAX_TOKEN` / `MINIMAX_API_KEY`
- [ ] NUNCA trocar as chaves entre eles
- [ ] NUNCA usar `MINIMAX_TOKEN` no lugar de `LITELLM_MASTER_KEY`
