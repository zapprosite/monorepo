---
name: SPEC-048-openai-facade-completo
description: Fazer llm.zappro.site ser um OpenAI completo — texto, visão, voz (TTS+STT) via ai-gateway. Rerouting do tunnel. Sem novo subdomínio.
status: IN_PROGRESS
priority: critical
author: Principal Engineer
date: 2026-04-15
deadline: 2026-04-15
specRef: SPEC-009, SPEC-027, SPEC-047
---

# SPEC-048: OpenAI Facade Completo — Texto + Visão + Voz

> ⚠️ **SPEC-009 imutável** — STT: whisper-medium-pt :8204 (canonical). TTS: TTS Bridge :8013 (pm_santa/pf_dora). NUNCA Kokoro directo.

---

## Objectivo

`llm.zappro.site` deve responder **como se fosse a API OpenAI completa** — texto, visão e voz — para que qualquer app que só suporte OpenAI funcione sem alterações. O ai-gateway (:4002) é o único ponto de entrada; LiteLLM fica interno.

---

## Situação Actual vs Desejada

| Endpoint                                       | Actual              | Desejado                             |
| ---------------------------------------------- | ------------------- | ------------------------------------ |
| `llm.zappro.site/v1/chat/completions`          | LiteLLM directo     | ai-gateway → LiteLLM                 |
| `llm.zappro.site/v1/chat/completions` + imagem | ❌ não funciona bem | ai-gateway → LiteLLM → llava-phi3:7B |
| `llm.zappro.site/v1/audio/speech`              | ❌ não existe       | ai-gateway → Llama filter → Kokoro   |
| `llm.zappro.site/v1/audio/transcriptions`      | ❌ não existe       | ai-gateway → whisper-medium-pt :8204 |
| `llm.zappro.site/v1/models`                    | LiteLLM models      | ai-gateway: lista unificada          |

---

## Arquitectura

```
App externa
  │  Authorization: Bearer $AI_GATEWAY_FACADE_KEY
  ▼
llm.zappro.site:443 (Cloudflare tunnel)
  │  [repoint: :4000 → :4002]
  ▼
ai-gateway :4002
  │
  ├─ POST /v1/chat/completions
  │    model: "gpt-4o" / "gpt-4o-mini" / etc  ──▶ LiteLLM :4000
  │    model: "gpt-4o-vision"  ─────────────────▶ LiteLLM :4000 (llava-phi3:7B via Ollama)
  │    [resposta em PT-BR? → Llama filter opcional via header x-ptbr-filter: true]
  │
  ├─ POST /v1/audio/speech
  │    model: "tts-1" | "tts-1-hd"
  │    voice: "pm_santa" (default) | "pf_dora"   ──▶ Llama PT-BR text cleaner
  │    input: texto (pode vir sujo, com símbolos)      │
  │                                                    ▼
  │                                               TTS Bridge :8013 → Kokoro :8880
  │                                               → mp3/wav/opus
  │
  ├─ POST /v1/audio/transcriptions
  │    model: "whisper-1"
  │    file: audio                               ──▶ whisper-medium-pt :8204 (OpenAI-compat)
  │    → {"text": "..."}
  │
  └─ GET /v1/models
       → lista: gpt-4o, gpt-4o-mini, gpt-4o-vision, tts-1, tts-1-hd, whisper-1
```

---

## Modelos (aliases)

| Alias (OpenAI)  | Real                                                             | Onde               |
| --------------- | ---------------------------------------------------------------- | ------------------ |
| `gpt-4o`        | `tom-cat-8b` (llama3-portuguese-tomcat-8b via Ollama)            | LiteLLM :4000      |
| `gpt-4o-vision` | `llava-phi3` (llava-phi3:latest (PRUNED: llava-phi3) via Ollama) | LiteLLM :4000      |
| `tts-1`         | Kokoro via **TTS Bridge :8013** (voz: `pm_santa`)                | ai-gateway → :8013 |
| `tts-1-hd`      | Kokoro via **TTS Bridge :8013** (voz: `pf_dora`)                 | ai-gateway → :8013 |
| `whisper-1`     | whisper-medium-pt :8204 (OpenAI-compat nativo)                   | ai-gateway → :8204 |

> ⚠️ **Fix crítico:** LiteLLM config actual tem `tts-1 → Kokoro :8880 directo` (bypassa TTS Bridge, viola SPEC-009). Deve ser corrigido para `→ TTS Bridge :8013`.

---

## PT-BR Filter — onde aplica

| Situação                            | Aplica filtro?                              | Quando                                                  |
| ----------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `/v1/chat/completions`              | **Opcional** — header `x-ptbr-filter: true` | Só se pedido; adiciona ~200ms                           |
| `/v1/audio/speech` — input text     | **Sempre**                                  | Antes do TTS: limpa símbolos, formata para fala natural |
| `/v1/audio/transcriptions` — output | **Nunca**                                   | Transcrição deve ser fiel                               |

**Prompt do PT-BR filter para TTS** (baseado na lógica actual de `speak.sh` + `preprocess_for_tts`):

```
Lê este texto em voz alta, como se fosse um livro para alguém, em português brasileiro natural.
Regras:
- Remove símbolos (→, ←, •, ★, ►, —) ou substitui por palavras naturais
- Listas numeradas: "1. Item" → "Primeiro, Item"
- Títulos (MAIÚSCULAS ou linha curta isolada) → pausa antes: ", ..."
- Texto misto PT/EN → manter PT-BR mas não traduzir termos técnicos
- NÃO reescreve o conteúdo — apenas formata para fala
- Responde APENAS com o texto formatado
Texto: {input}
```

**Lógica replicada de:** `~/Desktop/voice-pipeline/scripts/speak.sh` (Ctrl+Shift+C, já em produção)

---

## Mudança de Infra — Tunnel Rerouting

**Actual:** `llm.zappro.site` → tunnel → `localhost:4000` (LiteLLM)
**Novo:** `llm.zappro.site` → tunnel → `localhost:4002` (ai-gateway)

Fazer via Cloudflare API (skill `cloudflare-terraform` ou `new-subdomain`):

- Atualizar ingress rule do tunnel: `service: http://localhost:4002`
- LiteLLM `:4000` fica apenas interno (não exposto publicamente)
- `api.zappro.site` (alias de :4000) → também repontado para :4002

---

## Env Vars (já existem em `.env`)

| Var                     | Uso                                         |
| ----------------------- | ------------------------------------------- |
| `LITELLM_LOCAL_URL`     | `http://localhost:4000/v1`                  |
| `LITELLM_MASTER_KEY`    | auth para LiteLLM interno                   |
| `TTS_BRIDGE_URL`        | `http://localhost:8013`                     |
| `STT_PROXY_URL`         | `http://localhost:8204` → whisper-medium-pt |
| `OLLAMA_URL`            | `http://localhost:11434`                    |
| `PTBR_FILTER_MODEL`     | `llama3-portuguese-tomcat-8b-instruct-q8`   |
| `AI_GATEWAY_FACADE_KEY` | chave única para clientes externos          |

---

## Deliverables

1. `apps/ai-gateway/src/routes/chat.ts` — adicionar routing para `gpt-4o-vision` (multipart com imagem)
2. `apps/ai-gateway/src/routes/models.ts` — lista de modelos corrigida
3. `apps/ai-gateway/src/middleware/ptbr-filter.ts` — melhorar prompt para TTS
4. Cloudflare tunnel rerouting: `llm.zappro.site` → `:4002`
5. Atualizar `SUBDOMAINS.md` e `PORTS.md`
6. `smoke-tests/smoke-openai-facade-full.sh` — testa texto + visão + TTS + STT

---

## Acceptance Criteria

- [ ] `curl https://llm.zappro.site/v1/chat/completions -d '{"model":"gpt-4o",...}'` responde PT-BR
- [ ] `curl https://llm.zappro.site/v1/chat/completions -d '{"model":"gpt-4o-vision","messages":[{"role":"user","content":[{"type":"image_url",...}]}]}'` responde com descrição da imagem
- [ ] `curl https://llm.zappro.site/v1/audio/speech -d '{"model":"tts-1","input":"Olá mundo","voice":"pm_santa"}'` retorna mp3 com voz PT-BR perfeita
- [ ] `curl https://llm.zappro.site/v1/audio/transcriptions -F "file=@audio.wav" -F "model=whisper-1"` retorna transcrição JSON
- [ ] Qualquer app OpenAI-only conecta em `llm.zappro.site` com `AI_GATEWAY_FACADE_KEY` e funciona
- [ ] PT-BR filter no TTS limpa símbolos antes de Kokoro
- [ ] `/sec` audit: 0 findings

---

## O que NÃO fazer

- ❌ LangGraph / LangChain — overhead desnecessário para um proxy
- ❌ Novo subdomínio — usar `llm.zappro.site` existente
- ❌ Trocar Kokoro, whisper-medium-pt, TTS Bridge (SPEC-009 imutável)
- ❌ Expor LiteLLM directamente (:4000) publicamente após rerouting

---

## References

- SPEC-009 — Audio stack imutável
- SPEC-027 — Voice pipeline humanizado PT-BR
- SPEC-047 — ai-gateway scaffold (base)
- PORTS.md — :4000 LiteLLM, :4002 ai-gateway, :8013 TTS, :8204 STT
- SUBDOMAINS.md — llm.zappro.site, api.zappro.site
