# OpenWebUI HVAC Multimodal Architecture Runbook

**Service:** OpenWebUI HVAC Multimodal — zappro-clima-tutor
**Version:** 1.0.0
**Public Model:** zappro-clima-tutor
**Status:** Pilot Ready (Internal / Supervised Technical Use Only)
**Last Updated:** 2026-04-28

---

## Overview

Sistema multimodal que combina interface web (OpenWebUI), assistente HVAC (zappro-clima-tutor), reconhecimento de voz (Groq STT), síntese de voz (Edge TTS) e visão computacional (Qwen2.5VL via Ollama). Oferece interação por texto, áudio e imagem para técnicos de campo em equipamentos HVAC.

**Princípio arquitetural:** OpenWebUI como interface unificada. zappro-clima-tutor como cérebro. LiteLLM como gateway de modelos. Groq STT e Edge TTS para voz. Qwen2.5VL para visão.

---

## Architecture

### Fluxo Completo

```
[Usuário] → [OpenWebUI chat.zappro.site] → [zappro-clima-tutor] → [LiteLLM api.zappro.site] → [MiniMax M2.7]
   ↑                    ↓                                                    ↓
   └──────── TTS ←─── [Edge TTS]                               [Qwen2.5VL via Ollama]
   ↓
[Groq STT] → texto
```

### Diagrama Detalhado de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              OpenWebUI (chat.zappro.site)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Web UI    │  │  Audio In   │  │  Image In   │  │  Audio Out  │                 │
│  │  (texto)    │  │  (Groq STT) │  │  (upload)   │  │  (Edge TTS) │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
│         │                 │                 │                 │                      │
│         ▼                 ▼                 ▼                 ▼                      │
│  ┌──────────────────────────────────────────────────────────────────────┐            │
│  │                    Multimodal Router                                   │            │
│  │              (text / audio / vision routing)                          │            │
│  └─────────────────────────────────┬────────────────────────────────────┘            │
└───────────────────────────────────┼────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        zappro-clima-tutor (:4017)                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │    Juiz     │  │   Router    │  │  Qdrant     │  │  Friendly   │                 │
│  │ (validate)  │  │   (mode)    │  │   RAG       │  │  Rewriter   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────┬────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          LiteLLM (api.zappro.site:4000)                              │
│  ┌──────────────────────────────────────────────────────────────────────┐            │
│  │                          MiniMax M2.7                                 │            │
│  │                    (texto, chat, raciocínio)                         │            │
│  └──────────────────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│       Groq STT                  │  │         Ollama                   │
│   (api.groq.com)                │  │      (:11434)                   │
│                                 │  │                                 │
│   Whisper-large-v3             │  │   Qwen2.5VL                     │
│   Audio → Texto                 │  │   Image → Texto/Descrição       │
└─────────────────────────────────┘  └─────────────────────────────────┘

                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Edge TTS (:5050)                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐            │
│  │                         Microsoft Edge TTS                            │            │
│  │                    Texto → Audio (pt-BR)                              │            │
│  └──────────────────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Port Diagram

| Componente | URL/Porta | Uso |
|---|---|---|
| OpenWebUI | chat.zappro.site (443) | Interface web, entrada de texto/áudio/imagem |
| zappro-clima-tutor | llm.zappro.site:4017 | Cérebro — roteamento, RAG, resposta amigável |
| LiteLLM | api.zappro.site:4000 | Gateway de modelos (MiniMax M2.7) |
| Groq STT | api.groq.com | Voz → texto (Whisper-large-v3) |
| Edge TTS | localhost:5050 | Texto → voz (pt-BR, EdgeSpeech) |
| Qwen2.5VL | localhost:11434 | Visão → texto/descrição (Ollama) |
| Qdrant | localhost:6333 | Vector store — manuals HVAC |
| Ollama Embeddings | localhost:11434 |Embeddings (nomic-embed-text) |

---

## Environment Variables

### OpenWebUI

| Variável | Valor | Descrição |
|---|---|---|
| `OPENWEBUI_URL` | `https://chat.zappro.site` | URL pública do OpenWebUI |
| `OPENWEBUI_API_KEY` | `sk-...` | API key para autenticação |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base Ollama para imagens |
| `OPENWEBUI_PIPELINE_URL` | `http://llm.zappro.site:4017` | Pipeline zappro-clima-tutor |

### LiteLLM

| Variável | Valor | Descrição |
|---|---|---|
| `LITELLM_BASE_URL` | `http://api.zappro.site:4000` | Endpoint LiteLLM |
| `LITELLM_API_KEY` | `sk-zappro-...` | Chave API LiteLLM |
| `LITELLM_MODEL` | `minimax/m2.7` | Modelo padrão MiniMax |
| `LITELLM_MAX_TOKENS` | `8192` | Limite de tokens por resposta |
| `LITELLM_REQUEST_TIMEOUT` | `60` | Timeout em segundos |
| `LITELLM_TEMPERATURE` | `0.7` | Temperatura de geração |

### Groq STT

| Variável | Valor | Descrição |
|---|---|---|
| `GROQ_API_KEY` | `gsk_...` | Chave API Groq |
| `GROQ_STT_MODEL` | `whisper-large-v3` | Modelo de Speech-to-Text |
| `GROQ_STT_LANGUAGE` | `pt` | Idioma (português) |
| `GROQ_STT_TIMEOUT` | `30` | Timeout em segundos |

### Edge TTS

| Variável | Valor | Descrição |
|---|---|---|
| `EDGE_TTS_URL` | `http://localhost:5050` | Endpoint Edge TTS local |
| `EDGE_TTS_VOICE` | `pt-BR-FranciscaNeural` | Voz feminina pt-BR |
| `EDGE_TTS_RATE` | `+0%` | Velocidade da fala |
| `EDGE_TTS_PITCH` | `+0Hz` | Tom da voz |

### Ollama (Visão)

| Variável | Valor | Descrição |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | Endpoint Ollama |
| `OLLAMA_VISION_MODEL` | `qwen2.5vl` | Modelo de visão |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Modelo de embeddings |
| `OLLAMA_KEEP_ALIVE` | `5m` | Tempo de keep-alive |

### Qdrant (RAG)

| Variável | Valor | Descrição |
|---|---|---|
| `QDRANT_URL` | `http://localhost:6333` | Endpoint Qdrant |
| `QDRANT_API_KEY` | Hash 32+ chars | Chave API Qdrant |
| `QDRANT_COLLECTION` | `hvac_manuals_v1` | Collection de manuais |
| `QDRANT_TOP_K` | `6` | Número de resultados RAG |

---

## Data Flows

### Fluxo de Texto

```
[Usuário digita texto]
    │
    ▼
[OpenWebUI — validação local]
    │
    ▼
[POST /v1/chat/completions → zappro-clima-tutor:4017]
    │
    ▼
[Juiz — validação de domínio HVAC]
    │
    ├── APPROVED → [Router — escolhe modo]
    │                    │
    │                    ├── guided_triage
    │                    ├── field_tutor
    │                    └── printable
    │                    │
    │                    ▼
    │               [Qdrant RAG — busca contexto]
    │                    │
    │                    ▼
    │               [LiteLLM → MiniMax M2.7]
    │                    │
    │                    ▼
    │               [Friendly Rewriter]
    │                    │
    │                    ▼
    └────────────────────[Resposta ao usuário]
```

### Fluxo de Áudio (STT → Texto → LLM → TTS)

```
[Usuário envia áudio]
    │
    ▼
[Groq STT — Whisper-large-v3]
    │
    ▼
[Texto transcrito]
    │
    ▼
[OpenWebUI — trata como texto]
    │
    ▼
[Fluxo de texto normal]
    │
    ▼
[Resposta em texto]
    │
    ▼
[Edge TTS — Síntese de voz]
    │
    ▼
[Áudio reproduzido ao usuário]
```

### Fluxo de Imagem (Visão)

```
[Usuário envia imagem]
    │
    ▼
[OpenWebUI — detecta imagem]
    │
    ▼
[Ollama — Qwen2.5VL :11434]
    │
    ▼
[Descrição textual da imagem]
    │
    ▼
[Concatena com query do usuário]
    │
    ▼
[Fluxo de texto normal]
    │
    ▼
[Resposta + possível descrição]
```

---

## Component Limits

### OpenWebUI

| Limite | Valor | Observação |
|---|---|---|
| Max upload de imagem | 10 MB | JPEG, PNG, WebP |
| Max arquivo de áudio | 25 MB | WAV, MP3, OGG |
| Session timeout | 30 min | Inatividade |
| Max history | 50 mensagens | Por conversa |

### zappro-clima-tutor

| Limite | Valor | Observação |
|---|---|---|
| Timeout total | 45s | Pipeline completo |
| Timeout Juiz | 50ms | Pré-validação |
| Max tokens resposta | 2048 | Por resposta |
| Max contexto RAG | 6 chunks | top_k=6 |
| Max perguntas de follow-up | 1 | Por resposta |

### LiteLLM / MiniMax M2.7

| Limite | Valor | Observação |
|---|---|---|
| Max tokens | 8192 | Input + Output |
| Temperature | 0.7 | Default |
| Top P | 0.9 | Nucleus sampling |
| Timeout | 60s | Por requisição |
| RPM | 100 | Rate limit |
| TPM | 10000 | Tokens por minuto |

### Groq STT

| Limite | Valor | Observação |
|---|---|---|
| Max duração áudio | 60s | Por arquivo |
| Timeout | 30s | Por transcrição |
| Idiomas | Multi | pt-BR otimizado |
| Formatos | wav, mp3, ogg | WebM também |

### Edge TTS

| Limite | Valor | Observação |
|---|---|---|
| Max texto | 1000 chars | Por síntese |
| Timeout | 15s | Por síntese |
| Vozes disponíveis | 2 (M/F) | pt-BR |
| Latência | ~200ms | Local |

### Ollama / Qwen2.5VL

| Limite | Valor | Observação |
|---|---|---|
| Max imagem | 10 MB | Por imagem |
| Max resolução | 1280x1280 | Auto-resize |
| Timeout | 45s | Por análise |
| Contexto | 4K tokens | Vision context |

---

## Troubleshooting

### Problemas Comuns

#### 1. OpenWebUI não conecta ao pipeline

**Sintoma:** Erro "Connection refused" ou timeout ao enviar mensagem.

**Diagnóstico:**
```bash
# Verificar se zappro-clima-tutor está rodando
curl -s http://llm.zappro.site:4017/health

# Verificar logs do pipeline
journalctl -u zappro-clima-tutor --since "30 minutes ago"
```

**Solução:**
```bash
# Reiniciar pipeline
sudo systemctl restart zappro-clima-tutor

# Verificar firewall
sudo ufw status | grep 4017
```

#### 2. Groq STT retorna erro de transcrição

**Sintoma:** Áudio não é transcrito, resposta vazia ou erro 500.

**Diagnóstico:**
```bash
# Testar API Groq diretamente
curl -X POST https://api.groq.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F "file=@/tmp/test-audio.wav" \
  -F "model=whisper-large-v3"
```

**Solução:**
- Verificar se `GROQ_API_KEY` está configurado
- Verificar tamanho do arquivo (máx 25 MB)
- Converter para formato suportado: `ffmpeg -i input.webm -ar 16000 -ac 1 output.wav`

#### 3. Edge TTS não responde

**Sintoma:** TTS não reproduz, erro de conexão em localhost:5050.

**Diagnóstico:**
```bash
# Verificar se Edge TTS está rodando
curl -s http://localhost:5050/health

# Testar síntese
curl -X POST http://localhost:5050/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Teste", "voice": "pt-BR-FranciscaNeural"}'
```

**Solução:**
```bash
# Reiniciar Edge TTS
sudo systemctl restart edge-tts

# Ou iniciar manualmente
python3 -m edge_tts_proxy --port 5050 &
```

#### 4. Qwen2.5VL não processa imagens

**Sintoma:** Erro ao enviar imagem, resposta vazia sobre visão.

**Diagnóstico:**
```bash
# Verificar Ollama
curl http://localhost:11434/api/tags

# Testar modelo vision
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "qwen2.5vl", "prompt": "Descreva esta imagem", "images": ["base64..."]}'
```

**Solução:**
```bash
# Baixar modelo se necessário
ollama pull qwen2.5vl

# Reiniciar Ollama
sudo systemctl restart ollama
```

#### 5. LiteLLM retorna erro 500

**Sintoma:** Resposta do pipeline com erro interno.

**Diagnóstico:**
```bash
# Health check LiteLLM
curl http://api.zappro.site:4000/health

# Verificar modelo disponível
curl -H "Authorization: Bearer $LITELLM_API_KEY" \
  http://api.zappro.site:4000/v1/models
```

**Solução:**
```bash
# Verificar logs LiteLLM
docker logs litellm --since 30m

# Reiniciar se necessário
sudo systemctl restart litellm
```

#### 6. Qdrant RAG retorna poucos resultados

**Sintoma:** Respostas com contexto limitado ou incompleto.

**Diagnóstico:**
```bash
# Verificar collection
curl -H "Authorization: Bearer $QDRANT_API_KEY" \
  http://localhost:6333/collections/hvac_manuals_v1

# Buscar pontos
curl -H "Authorization: Bearer $QDRANT_API_KEY" \
  -X POST http://localhost:6333/collections/hvac_manuals_v1/points/search \
  -d '{"vector": [0.1, ...], "limit": 6}'
```

**Solução:**
- Verificar se collection tem > 400 pontos (threshold mínimo)
- Ajustar `QDRANT_TOP_K` se necessário
- Reindexar manuais se collection vazia

---

## Quick Commands

```bash
# Status completo do sistema
python3 scripts/hvac-rag/hvac-status.py

# Healthcheck
python /srv/monorepo/scripts/hvac-rag/hvac-healthcheck.py

# Verificar OpenWebUI
curl https://chat.zappro.site/health

# Verificar pipeline
curl http://llm.zappro.site:4017/health

# Verificar LiteLLM
curl http://api.zappro.site:4000/health

# Verificar Ollama
curl http://localhost:11434/api/tags

# Verificar Qdrant
curl http://localhost:6333/
```

---

## Alert Thresholds

| Metric | Warning | Critical |
|---|---|---|
| Pipeline latency (p95) | > 5000ms | > 10000ms |
| STT failure rate | > 5% | > 15% |
| TTS failure rate | > 3% | > 10% |
| Vision failure rate | > 10% | > 25% |
| Qdrant points | < 400 | < 300 |
| Healthcheck failures | 1 | 3+ consecutive |

---

## Contacts

| Role | Responsibility |
|---|---|
| Platform Engineering | Infraestrutura, deploys |
| AI Governance | Compliance, segurança |
| HVAC Technical Lead | Qualidade de queries, manuais |

---

## References

- SPEC-140: OpenWebUI HVAC Multimodal Architecture
- OpenWebUI: https://chat.zappro.site
- LiteLLM: http://api.zappro.site:4000
- Ollama: http://localhost:11434
- Groq STT: api.groq.com
- Qdrant: http://localhost:6333
- MiniMax M2.7: via LiteLLM
- Qwen2.5VL: via Ollama
- Edge TTS: http://localhost:5050
