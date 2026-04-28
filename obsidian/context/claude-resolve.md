# Super Prompt Técnico — OpenClaw + Voice Pipeline

**Data:** 05/04/2026 | **Host:** will-zappro | **Objetivo:** Bot Telegram responder + Voice Pipeline (olhos+boca+ouvidos) via GPU local

---

## ARQUITETURA ATUAL

```
┌─────────────────────────────────────────────────────────────────┐
│                     COOLIFY (10.0.19.x)                        │
│  ┌─────────────────┐    ┌──────────────────────────────────┐  │
│  │  OpenClaw Bot   │    │  Browser (Chrome DevTools)        │  │
│  │  Port 8080       │───│  Port 9222                       │  │
│  │  @CEO_REFRIMIX   │    │                                  │  │
│  └─────────────────┘    └──────────────────────────────────┘  │
│         │                                                      │
│         │ liteLLM/minimax-m2.7  ──►  LiteLLM (10.0.1.1:4000) │
│         │                                                       │
│         │ OPENAI_TTS_BASE_URL ──► Kokoro (10.0.19.6:8880)    │
│         │                                                       │
│         │ STT ──► Deepgram Cloud (fallback)                   │
│         │                                                       │
│         │ Memory ──► Qdrant (10.0.19.5:6333)                  │
└─────────┼──────────────────────────────────────────────────────┘
          │
          │ 10.0.1.1:4000
          ▼
┌─────────────────────────────────────┐
│          DOCKER0 BRIDGE             │
│  ┌─────────────────┐  ┌─────────┐ │
│  │   LiteLLM Proxy │  │ Ollama  │ │
│  │   :4000         │──│ :11434  │ │
│  └─────────────────┘  │ GPU     │ │
│                       │ gemma4  │ │
│                       │ llava   │ │
│                       │ nomic   │ │
│                       └─────────┘ │
└─────────────────────────────────────┘
          │
          │ GPU (RTX 4090)
          ▼
   ┌──────────────┐
   │ Kokoro TTS   │  10.0.19.6:8880
   │ pm_santa PT-BR│
   └──────────────┘
```

---

## O QUE FUNCIONA ✅

| Serviço | IP:Port | Status | Teste |
|---------|---------|--------|-------|
| MiniMax API (direto) | api.minimax.io | ✅ OK | `curl` testado |
| LiteLLM Proxy | 10.0.1.1:4000 | ✅ OK | Auth error (precisa key) |
| Ollama (GPU) | 10.0.1.1:11434 | ✅ OK | `gemma4`, `llava`, `nomic-embed-text` |
| Kokoro TTS | 10.0.19.6:8880 | ✅ OK | Responde na porta |
| Qdrant (Coolify) | 10.0.19.5:6333 | ✅ OK | Collections vazias |
| OpenClaw Telegram | @CEO_REFRIMIX_bot | ⚠️ conecta mas não responde | - |

---

## O QUE NÃO FUNCIONA ❌

1. **OpenClaw Telegram** — conecta (`clients=0` no log), não responde mensagens
2. **OPENCLAW_PRIMARY_MODEL** — o `.env` do Coolify reseta após deploy
3. **LiteLLM via OpenClaw** — Auth error quando testado direto, mas bot conecta

---

## CONFIG ATUAL DO OPENCLAW (via `openclaw config get`)

```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "liteLLM/minimax-m2.7" }
    }
  },
  "providers": {
    "minimax": {
      "baseUrl": "https://api.minimax.io/anthropic",
      "apiKey": "${MINIMAX_API_KEY}",
      "models": [{ "id": "MiniMax-M2.1" }]  // ⚠️ SÓ TEM M2.1!
    },
    "liteLLM": {
      "baseUrl": "http://10.0.1.1:4000/v1",
      "apiKey": "sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1",
      "models": [{ "id": "minimax-m2.7" }]
    }
  }
}
```

---

## ARQUIVOS CRÍTICOS

| Arquivo | Conteúdo |
|---------|-----------|
| `/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/.env` | Vars ambiente (TOKEN, API Keys) |
| `/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/docker-compose.yml` | Compose do Coolify |
| `/home/will/zappro-lite/config.yaml` | **LiteLLM config** — modelos |
| `~/.claude/settings.json` | Claude Code + MCP servers |

---

## LITELLM CONFIG.YAML ATUAL

```yaml
model_list:
- model_name: gemma4
  litellm_params:
    model: ollama/gemma4:latest
    api_base: http://10.0.1.1:11434
- model_name: llava
  litellm_params:
    model: ollama/llava:latest
    api_base: http://10.0.1.1:11434
- model_name: embedding-nomic
  litellm_params:
    model: ollama/nomic-embed-text:latest
    api_base: http://10.0.1.1:11434
    mode: embedding
- model_name: qwen3.6-plus
  litellm_params:
    model: openrouter/qwen/qwen3.6-plus
- model_name: minimax-m2.7
  litellm_params:
    model: openrouter/minimax/minimax-m2.7
```

---

## O QUE JÁ TENTAMOS

1. ✅ `OPENCLAW_PRIMARY_MODEL=MiniMax-M2.7` → Não funfou (provider só tem M2.1)
2. ✅ `liteLLM/minimax-m2.7` → Gateway aceita mas não responde
3. ✅ Restart gateway → Não resolveu
4. ✅ Pairing list → Sem pending requests
5. ✅ Telegram mode: polling → OK
6. ✅ Auth Token Telegram → OK (${TELEGRAM_BOT_TOKEN})
7. ❌ Config reset via Coolify → .env sobrescrito

---

## HIPÓTESES

1. **Provider minimax** só tem `MiniMax-M2.1` mas configuramos `M2.7` — API aceita?
2. **LiteLLM auth** — OpenClaw passa key errada ou formato errado?
3. **Coolify .env** — `OPENCLAW_PRIMARY_MODEL` reseta após deploy
4. **nginx basic auth** — Interfere com Telegram webhook?
5. **Gateway restart** — `SIGUSR1` não reload modelo corretamente

---

## O QUE PRECISA

1. **Estabilizar** `OPENCLAW_PRIMARY_MODEL` persistente (não resetar)
2. **Confirmar** se `liteLLM/minimax-m2.7` realmente funciona ou é rota morta
3. **Testar** MiniMax direto no OpenClaw (sem LiteLLM) — corrigir provider M2.7
4. **Verificar** se Telegram recebe messages mas gateway ignora
5. **Pinning** versão OpenClaw se atualização quebrou

---

## COMANDOS DE DIAGNÓSTICO

```bash
# Ver modelo ativo no gateway
docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f --tail 5 | grep "agent model"

# Ver config completa
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f openclaw config get

# Ver channels status
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f openclaw channels status

# Ver se há pairing pendente
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f openclaw pairing list telegram

# Testar LiteLLM direto
curl -H "Authorization: Bearer sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1" \
  http://10.0.1.1:4000/v1/models

# Testar MiniMax direto
curl -X POST "https://api.minimax.io/anthropic/v1/messages" \
  -H "Authorization: Bearer ${MINIMAX_API_KEY}" \
  -d '{"model":"MiniMax-M2.7","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

---

## PONTOS DE AUDITORIA

1. **OpenClaw Telegram flow** — onde a msg é perdida?
2. **LiteLLM `/v1/chat/completions`** — está sendo chamado? Com que params?
3. **Provider resolution** — como `liteLLM/minimax-m2.7` é resolvido?
4. **Auth flow** — Telegram → Gateway → Agent → Provider → Model

**Arquivos pra auditar:**
- OpenClaw source: `/opt/openclaw/app/dist/` (no container)
- Gateway WS handler
- Telegram provider handler
- Model routing logic

---

## PROVIDERS.MINIMAX — SÓ TEM M2.1

O provider `minimax` no OpenClaw só conhece `MiniMax-M2.1`:

```json
"minimax": {
  "models": [
    { "id": "MiniMax-M2.1", "contextWindow": 200000, ... }
  ]
}
```

**Mas** a API aceita `MiniMax-M2.7`. Provavelmente:
- Ou o modelo é registrado automaticamente na primeira chamada
- Ou precisa adicionar manualmente no config

**Testar adicionar M2.7 ao provider:**
```bash
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f openclaw config set providers.minimax.models '[{"id":"MiniMax-M2.7","contextWindow":200000}]'
```

---

## VERSION PENDING — 2026-04-05

O .env do Coolify foi sobrescrito varias vezes. Versão do OpenClaw:

```
OpenClaw 2026.2.6
```

**Issue conocido:** Versão `2026.4.x` mudou como `allowedOrigins` funciona.

**Se resolver não funcionar, fazer downgrade para 2026.2.6 (já é a atual).**
