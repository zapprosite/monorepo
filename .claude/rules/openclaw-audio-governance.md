# OpenClaw Audio Governance Rules

**Applies to:** All LLMs operating in this monorepo
**Host:** will-zappro homelab
**Updated:** 2026-04-09

---

## Core Rule — Audio Stack Imutavel

O OpenClaw Bot tem uma configuracao de audio canonical que NENHUM LLM pode propor alteracoes. Antes de sugerir qualquer mudanca relacionada a voz, STT, TTS, ou LLM, o LLM DEVE verificar `docs/SPECS/SPEC-009-openclaw-persona-audio-stack.md`.

---

## STT Rules

### REGRA: Apenas wav2vec2 para STT

O servico de Speech-to-Text do homelab e **wav2vec2** na porta `8201`.

**CORRETO:**
```
STT → wav2vec2 :8201 → texto
```

**PROIBIDO — NUNCA sugerir:**
- Deepgram cloud diretamente (DEVE usar via proxy wav2vec2-proxy :8203)
- Whisper (qualquer variant)
- Silero STT
- Qualquer outro STT

**Por que:** O STT canonical usa Deepgram API format via wav2vec2-proxy. Deepgram direto foi removido.

### REGRA: wav2vec2-proxy é o STT canonical

O OpenClaw usa Deepgram API format mas através de um proxy local (wav2vec2-deepgram-proxy).

**CORRETO:**
```
OpenClaw → api.deepgram.com → wav2vec2-proxy (:8203) → whisper-api (:8201)
```

O proxy implementa a API Deepgram (/v1/listen) e faz passthrough para whisper-api (wav2vec2).
Enhancement PT-BR feito via Ollama (llama3-portuguese-tomcat-8b-instruct-q8).

**PROIBIDO — NUNCA sugerir:**
- Usar Deepgram cloud diretamente
- Remover ou绕过 o wav2vec2-proxy
- Alterar o endpoint para whisper-api direto

---

## TTS Rules

### REGRA: TTS Bridge e o unico ponto de acesso ao Kokoro

O OpenClaw NAO pode chamar Kokoro diretamente. Deve passar pelo TTS Bridge na porta `8013`.

**CORRETO:**
```
OpenClaw → TTS Bridge :8013 → Kokoro :8880
```

**PROIBIDO — NUNCA sugerir:**
- OpenClaw → Kokoro direto (sem filtro de vozes)
- Mudar baseUrl para `http://10.0.19.7:8880` ou `http://10.0.2.4:8880`
- Remover o TTS Bridge

### REGRA: Apenas pm_santa e pf_dora sao permitidas

O TTS Bridge filtra vozes. Apenas estas duas voces PT-BR funcionam:

| Voice | Tipo | Uso |
|-------|------|-----|
| `pm_santa` | Masculino PT-BR | **PADRAO** |
| `pf_dora` | Feminino PT-BR | Fallback |

**PROIBIDO — NUNCA sugerir:**
- `af_sarah`, `af_nicole`, `am_adam` ou qualquer outra voz
- "vamos experimentar a voz X" para qualquer voz diferente de pm_santa/pf_dora

**Por que:** O TTS Bridge retorna 400 para voces nao autorizadas. Propor outra voz causara erro em producao.

---

## LLM Rules

### REGRA: MiniMax M2.7 e chamado DIRETO, NAO via LiteLLM

O LLM primario do OpenClaw (MiniMax M2.7) NAO passa pelo LiteLLM.

**CORRETO:**
```
OpenClaw → minimax/MiniMax-M2.7 → https://api.minimax.io/anthropic
```

**PROIBIDO — NUNCA sugerir:**
- `liteLLM/minimax-m2.7` como primario
- `ollama/llama3.3` como primario
- Qualquer modelo via LiteLLM como primario

**Por que:** LiteLLM nao tem campo `api` compativel com OpenClaw. Causa crash: `No API provider registered for api: undefined`.

### REGRA: LiteLLM e usado APENAS para servicos GPU locais

LiteLLM serve apenas como proxy para:
- Vision: `qwen2.5-vl` (via Ollama)
- Embeddings: `embedding-nomic`
- Modelos Ollama locais (nao primarios)

---

## Vision Rules

### REGRA: Apenas litellm/qwen2.5-vl para visao

O modelo de visao do OpenClaw e `litellm/qwen2.5-vl` (nao llava).

**CORRETO:**
```
Image → litellm/qwen2.5-vl → descricao
```

**PROIBIDO — NUNCA sugerir:**
- `llava` como modelo de visao (FOI SUBSTITUIDO por qwen2.5-vl em 2026-04-09)
- `openai/gpt-4o` ou qualquer modelo GPT para visao
- Claude Vision como alternativa

---

## Identity Rules

### REGRA: Identity e parte da configuracao stable

O OpenClaw tem identity configurado:
- **Nome:** Zappro
- **Emoji:** 🎙️
- **Tema:** assistente de voz PT-BR, eficiente, profissional

**PROIBIDO — NUNCA sugerir:**
- Mudar nome do bot
- Mudar emoji
- Alterar theme/personalidade

---

## Como Verificar Antes de Propor

Antes de propor qualquer mudanca relacionada a audio ou voz:

1. Ler `docs/SPECS/SPEC-009-openclaw-persona-audio-stack.md`
2. Verificar se a mudanca respeita as regras acima
3. Se a mudanca envolver qualquer item em "PROIBIDO", RECUSAR
4. Se nao tiver certeza, perguntar a will antes de continuar

---

## Exceptions — Requerem Aprovacao

As seguintes mudancas REQUEREM aprovacao explicita de will:
- Adicionar nova voz PT-BR ao TTS Bridge
- Trocar STT (wav2vec2 → outro)
- Trocar TTS (Kokoro → outro)
- Mudar LLM primario
- Alterar identity

---

**Authority:** will-zappro
**Last update:** 2026-04-09