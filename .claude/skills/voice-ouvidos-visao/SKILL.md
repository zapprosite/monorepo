---
name: voice-ouvidos-visao
description: Unified PT-BR voice + vision pipeline. Listens via faster-whisper (:8204), thinks via MiniMax-M2.7 (primary LLM), speaks via Kokoro TTS Bridge (:8013, pm_santa), and sees via qwen2.5vl:7b (:11434). Activates with /ouvir (voice in), /ver (vision), /falar (voice out), /visao (vision+voice).
version: 2.0.0
date: 2026-04-20
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [voice, stt, tts, vision, kokoro, faster-whisper, qwen, pt-br]
    related_skills: []
    status: production
---

# voice-ouvidos-visao v2.0

Unified PT-BR pipeline — **Ouvir** (STT) → **Pensar** (MiniMax-M2.7) → **Falar** (Kokoro TTS) → **Enxergar** (qwen2.5vl)

## Arquitetura Atual (SPEC-053 — 17/04/2026)

```
Telegram Voice Message
  │
  ▼
Hermes Gateway :8642
  │
  ├── LLM PRIMÁRIO: MiniMax-M2.7 (texto) — 50$ plan
  │
  ├── Vision: Ollama qwen2.5vl:7b (:11434)
  │
  ├── STT: faster-whisper-medium-pt (:8204)
  │
  └── TTS: Kokoro Bridge (:8013) — vozes pm_santa / pf_dora
```

### Regras de Divisão de Trabalho

| Componente | Provider | Uso |
|------------|----------|-----|
| **LLM texto** | MiniMax-M2.7 | Texto, raciocínio, decisões |
| **Vision** | Ollama qwen2.5vl:7b | Análise de imagem |
| **STT** | faster-whisper-medium-pt | Transcrição de áudio |
| **TTS** | Kokoro :8013 | Síntese de voz PT-BR |

> ⚠️ **REGRAS CRÍTICAS (SPEC-053):**
> - Ollama **NUNCA** para texto — apenas Vision + Embeddings
> - MiniMax-M2.7 é o **ÚNICO** LLM de texto
> - `.env` é fonte canónica de todas as chaves

---

## Endpoints Ativos

| Service | URL | Model | Purpose |
|---------|-----|-------|---------|
| **Hermes Gateway** | `http://localhost:8642` | MiniMax-M2.7 | LLM primário |
| **STT** | `http://localhost:8204/v1/audio/transcriptions` | faster-whisper-medium-pt | Voice input (PT-BR) |
| **TTS** | `http://localhost:8013/v1/audio/speech` | kokoro | Voice output (PT-BR) |
| **Vision** | `http://localhost:11434/api/chat` | qwen2.5vl:7b | Image analysis |

### Modelos Ollama Disponíveis (verificação: `ollama list`)

```
qwen2.5vl:7b              8.3B Q4_K_M   — Vision (6GB)
nomic-embed-text:latest   137M F16      — Embeddings
```

---

## STT — Speech-to-Text

**Porta:** `:8204` (OpenAI-compatible `/v1/audio/transcriptions`)

```bash
# Teste direto
curl -sf http://localhost:8204/health
# Resposta: {"status":"ok","model":"Systran/faster-whisper-medium"}

# Transcrição (requer ficheiro áudio)
curl -sf http://localhost:8204/v1/audio/transcriptions \
  -F "file=@audio.wav" \
  -F "model=whisper-1" \
  -F "language=pt"
```

**Formatos aceitos:** WAV (16kHz mono), OGG (Telegram), MP3
**STT via ai-gateway:** `http://localhost:4002/v1/audio/transcriptions` (mesmo faster-whisper)

---

## TTS — Text-to-Speech

**Porta:** `:8013` (Kokoro TTS Bridge — **NÃO** usar Kokoro direto)

```bash
# Teste direto
curl -sf http://localhost:8013/health
# Resposta: {"status":"healthy"}

# Síntese de voz
curl -sf http://localhost:8013/v1/audio/speech \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Olá, como posso ajudar?","voice":"pm_santa","response_format":"mp3"}' \
  -o resposta.ogg
```

**Vozes disponíveis:** `pm_santa` (masculino), `pf_dora` (feminino)
**Formato de saída:** mp3/ogg (Telegram) ou wav

### ⚠️ Limite de Tamanho

`HERMES_MAX_TTS_SIZE_BYTES=52428800` (50MB) — textos muito longos são rejeitados.

### TTS Via Hermes Gateway

O gateway expõe `/v1/audio/speech` na porta :8642, que faz proxy para :8013.

---

## Vision — Análise de Imagem

**Endpoint:** `http://localhost:11434/api/chat`
**Modelo:** qwen2.5vl:7b (6GB, Q4_K_M, context 128k)

### ⚠️ CRÍTICO: Base64 Cru (SEM prefixo)

```bash
# ✅ CORRETO — base64 sem prefixo
IMG_B64=$(base64 -w 0 /path/to/image.png)
curl -s http://localhost:11434/api/chat \
  -d "{\"model\":\"qwen2.5vl:7b\",\"messages\":[{\"role\":\"user\",\"content\":\"Descreva esta imagem.\",\"images\":[\"${IMG_B64}\"]}]}"

# ❌ ERRADO — prefixo data:image/...;base64,
# Resultado: "illegal base64 data at input byte X"
```

**Resposta é streaming** — acumula `.message.content` de cada chunk:

```bash
curl -s http://localhost:11434/api/chat \
  -d "{\"model\":\"qwen2.5vl:7b\",\"messages\":[{\"role\":\"user\",\"content\":\"O que há nesta imagem?\",\"images\":[\"${IMG_B64}\"]}]}" \
  | jq -r '.message.content'
```

### Como Receber Imagens do Telegram

1. Telegram envia `photo[]` com `file_id`
2. Download via `GET /bot{TOKEN}/getFile?file_id={file_id}`
3. Download real: `https://api.telegram.org/file/bot{TOKEN}/{file_path}`
4. Converter para base64 e enviar ao qwen2.5vl

---

## Comandos

| Comando | Modo | Descrição |
|---------|------|-----------|
| `/ouvir` | Voice Input | Ativa STT — grava áudio, transcreve |
| `/ver` | Vision | Envia imagem que eu descrevo |
| `/falar` | Voice Output | Recebe texto, gera áudio e envia |
| `/visao` | Vision + TTS | Descreve imagem e fala resultado |
| `/ouvidos` | Pipeline Completo | Ouvir → Pensar → Falar |

---

## Environment Variables (`.env` canonical)

```bash
MINIMAX_API_KEY=***           # LLM primário (50$ plan)
MINIMAX_GROUP_ID=2034696179689731017
OLLAMA_URL=http://localhost:11434
OLLAMA_VISION_MODEL=qwen2.5vl:7b
STT_DIRECT_URL=http://localhost:8204
TTS_BRIDGE_URL=http://localhost:8013
KOKORO_URL=http://localhost:8880
HERMES_MAX_TTS_SIZE_BYTES=52428800
```

---

## Troubleshooting

### Smoke Test

```bash
# Localização: /srv/monorepo/tasks/smoke-tests/
# Verificar todos os serviços:
curl -sf http://localhost:8204/health && echo "STT OK"
curl -sf http://localhost:8013/health && echo "TTS OK"
curl -sf http://localhost:8642/health && echo "Hermes OK"
curl -sf http://localhost:11434/api/tags | jq -r '.models[].name'
```

### STT Falhando

```bash
# Verificar se faster-whisper está a correr
ps aux | grep whisper

# Testar com ficheiro WAV simples
curl -sf http://localhost:8204/v1/audio/transcriptions \
  -F "file=@/srv/monorepo/will_voice_ZapPro.wav" \
  -F "model=whisper-1"

# Se 502: multipart OpenAI format — o script :8204 já suporta
# Se 400: formato do áudio incompatível — converter com ffmpeg
```

### TTS Falhando

```bash
# Health check
curl -sf http://localhost:8013/health

# Testar síntese simples
curl -sf http://localhost:8013/v1/audio/speech \
  -X POST -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste","voice":"pm_santa"}' \
  -o /tmp/test_tts.ogg

# Se 500: Kokoro container pode ter crashado — verificar docker
docker ps | grep kokoro
```

### Vision qwen2.5vl Falhando

```bash
# Verificar se modelo está carregado
ollama list | grep qwen2.5vl

# Se não aparecer: puxar
ollama pull qwen2.5vl:7b

# Testar com imagem simples
IMG_B64=$(base64 -w 0 /tmp/test.png)
curl -s http://localhost:11434/api/chat \
  -d "{\"model\":\"qwen2.5vl:7b\",\"messages\":[{\"role\":\"user\",\"content\":\"Test\",\"images\":[\"${IMG_B64}\"]}]}" \
  | jq -r '.message.content'

# Se "illegal base64": prefixo data:image errado — ver formato acima
```

### Hermes Gateway Indisponível

```bash
curl -sf http://localhost:8642/health
# Se FAIL: gateway pode ter crashado
# Verificar processo
ps aux | grep hermes
# Restart via systemd ou Coolify
```

---

## Evoluções em Avaliação (Não em Produção)

### F5-TTS — Voice Cloning (SPEC-076)

> **Status:** Em avaliação — **NÃO é produção**

F5-TTS permitiria clonar a voz real do utilizador (William) em vez de usar vozes pré-fabricadas (pm_santa/pf_dora).

**Situação atual (18/04/2026):**
- ✅ F5-TTS venv criado (`.f5tts-venv/`, 4.3GB)
- ✅ f5-tts 1.1.17 + torch 2.5.1+cu121 instalado
- ⚠️ Geração falha com processo killed — API mismatch
- ⏳ Aguardando decisão sobre próximo passo

**Research findings:**
| Modelo | Quality | VRAM | PT-BR | Status |
|--------|---------|------|-------|--------|
| F5-TTS | 8/10 | ~4GB | Zero-shot | ✅ Active 2026 |
| XTTS-v2 | 7.5/10 | ~4GB | ✅ | ⚠️ Coqui deprecated |
| Kokoro | 6/10 | ~1GB | Pre-made | ✅ Production |

**Se F5-TTS passar nos testes:** swap cirúrgico Kokoro → F5-TTS com fallback Kokoro.

### XTTS-v2 (SPEC-072)

> **Status:** Deprecated — Coqui.ai shutdown announced

---

## Ficheiros

```
voice-ouvidos-visao/
├── SKILL.md              # Esta skill
└── (scripts auxiliares em /srv/monorepo/tasks/smoke-tests/)
```

---

## Referências

- SPEC-053: Hermes 100% Local Voice & Vision (estado atual)
- SPEC-076: F5-TTS Voice Clone Evaluation
- SPEC-072: TTS PT-BR Upgrade (XTTS deprecated)
- SPEC-009: Audio stack imutável (STT/TTS canonical)
- SPEC-027: Voice pipeline PT-BR
