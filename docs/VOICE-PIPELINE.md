# Voice/STT Pipeline — Documentacao Tecnica

**Data:** 2026-05-01
**Stack:** MiniMax-M2.7 (primary) + Groq Whisper (STT free) + Edge TTS (TTS free)

---

## Visao Geral

Pipeline de voz bidirecional: entrada de audio (STT) → processamento LLM → saida de audio (TTS).

```
Microfone (Telegram Voice)
    │
    ▼
Groq Whisper Turbo (STT cloud, 150min/dia gratis) ── fallback ──▶ faster-whisper (:8204)
    │
    ▼
MiniMax-M2.7 (LLM primário, via LiteLLM :4000)
    │
    ▼
Edge TTS (pt-BR-AntonioNeural) ──→ Telegram Voice
```

---

## STT — Speech-to-Text

### Provider Principal: Groq Whisper Turbo (GRÁTIS — 150min/dia)

**API:** `https://api.groq.com/openai/v1/audio/transcriptions`
**Modelo:** `whisper-large-v3-turbo`
**Limite:** 150 minutos/dia gratis

```bash
# Transcricao direta com Groq
curl -X POST https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F "file=@audio.ogg" \
  -F "model=whisper-large-v3-turbo"
```

### Fallback: faster-whisper-server (porta 8204)

Quando Groq esta indisponivel ou limite atingido, o fallback local entra em acao.

**Porta:** `:8204` (OpenAI-compatible `/v1/audio/transcriptions`)
**Modelo:** faster-whisper-medium-pt

```bash
# Health check
curl -sf http://localhost:8204/health

# Transcricao fallback
curl -sf http://localhost:8204/v1/audio/transcriptions \
  -F "file=@audio.wav" \
  -F "model=whisper-1" \
  -F "language=pt"
```

**Formatos aceitos:** WAV (16kHz mono), OGG (Telegram), MP3

---

## TTS — Text-to-Speech

### Provider Canonical: Edge TTS (Microsoft — GRÁTIS)

**Voz:** `pt-BR-AntonioNeural`
**Script:** `~/.hermes/scripts/tts-edge.py`

```bash
# Uso direto
python3 ~/.hermes/scripts/tts-edge.py "Texto para falar" [chat_id]
```

### Pre-processamento de Texto

O `tts-edge.py` possui TextScanner single-pass:
- Converte bullet points em narracao ordinal (primeiro, segundo...)
- Resume blocos de codigo (nao le linha a linha)
- Converte simbolos matematicos e operadores
- Fala titulos com enfase
- Limpa markdown e emojis

---

## LLM — Processamento

### Primario: MiniMax-M2.7

**Endpoint:** LiteLLM em `localhost:4000`
**Routing:** Automatico via LiteLLM

### Fallback: qwen2.5-coder via Ollama

**VRAM:** ~8GB
**Uso:** Codigo local via Ollama `:11434`

---

## Fluxo Completo

```
1. Usuario grava audio no Telegram
2. Hermes Gateway recebe voz (:8642)
3. STT: Groq Whisper Turbo transcreve → texto
   (fallback: faster-whisper :8204 se Groq indisponivel)
4. LLM: MiniMax-M2.7 processa entrada (:4000)
5. TTS: Edge TTS (pt-BR-AntonioNeural) gera audio
6. Hermes Gateway envia audio de volta ao Telegram
```

### Diagrama de Fluxo

```
┌─────────────┐
│   Telegram  │
│  Voice Msg  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Hermes Gateway   │
│    :8642        │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐     ┌──────────────────┐
│  Groq Whisper    │     │ faster-whisper   │
│  (cloud)         │────▶│   :8204          │
│  whisper-large    │     │   (fallback)     │
│  -v3-turbo       │     └──────────────────┘
│  (150min FREE)   │
└──────┬──────────┘
       │ texto
       ▼
┌─────────────────┐
│    LiteLLM       │
│    :4000        │
│  MiniMax-M2.7   │
└──────┬──────────┘
       │ texto
       ▼
┌─────────────────┐
│   Edge TTS       │
│ pt-BR-Antonio   │
│  Neural (FREE)  │
└──────┬──────────┘
       │ audio.opus
       ▼
┌─────────────────┐
│   Telegram      │
│   sendVoice     │
└─────────────────┘
```

---

## Environment Variables

```bash
# STT Primary (Groq cloud — FREE 150min/dia)
GROQ_API_KEY=${GROQ_API_KEY}

# STT Fallback (faster-whisper local)
STT_DIRECT_URL=http://localhost:8204

# LLM
MINIMAX_API_KEY=${MINIMAX_API_KEY}
MINIMAX_GROUP_ID=${MINIMAX_GROUP_ID}
OLLAMA_URL=http://localhost:11434
LITELLM_URL=http://localhost:4000
```

---

## Ports e Services

| Servico | Porta | Tipo |
|---------|-------|------|
| Hermes Gateway | 8642 | Agent brain |
| LiteLLM | 4000 | LLM proxy |
| ai-gateway | 4002 | OpenAI facade |
| faster-whisper (fallback STT) | 8204 | STT local |
| Edge TTS Bridge | 8012 | TTS cloud |
| Ollama | 11434 | Local LLM |
| Qdrant | 6333 | Vector DB |

---

## Custos

| Provider | Model | Custo |
|----------|-------|-------|
| Groq | whisper-large-v3-turbo | **$0** (150min/dia free) |
| Edge TTS | pt-BR-AntonioNeural | **$0** |
| MiniMax | minimax-m2.7 | $0.10/1M |
| Ollama | qwen2.5:3b | $0 |

---

## Referencias

- Voice/STT Stack: `VOICE-STT-STACK.md`
- TTS script: `~/.hermes/scripts/tts-edge.py`
- Smoke test: `smoke-tests/smoke-hermes-local-voice.sh`
- PORTS.md: `/srv/ops/ai-governance/PORTS.md`


---

## VOICE-STT-STACK

    │
    ▼
Edge TTS (pt-BR-AntonioNeural) ──▶ Telegram Voice
```

**Princípio:** Cloud gratuito = primary. Local = fallback quando cloud indisponível.

---

## STT — Speech-to-Text

### Primary: Groq Whisper Turbo (GRÁTIS — 150min/dia)

**API:** `https://api.groq.com/openai/v1/audio/transcriptions`
**Modelo:** `whisper-large-v3-turbo`
**Limite:** 150 minutos/dia (free tier)
**Vantagens:** Rápido, precisão excelente em PT-BR, baixa latência

```bash
# Transcrição via Groq
curl -X POST https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F "file=@audio.ogg" \
  -F "model=whisper-large-v3-turbo"
```

### Fallback: faster-whisper-server (local)

**Porta:** `:8204` (OpenAI-compatible `/v1/audio/transcriptions`)
**Modelo:** `faster-whisper-medium-pt`
**Ativado quando:** Groq rate limited (>150min) ou indisponível

```bash
# Health check
curl -sf http://localhost:8204/health

# Transcrição fallback
curl -sf http://localhost:8204/v1/audio/transcriptions \
  -F "file=@audio.wav" \
  -F "model=whisper-1" \
  -F "language=pt"
```

**Formatos aceitos:** WAV (16kHz mono), OGG (Telegram), MP3

### Routing Logic

```
if (Groq available && minutes_used < 150):
    use Groq Whisper
else:
    use faster-whisper (:8204)
```

---

## TTS — Text-to-Speech

### Provider: Edge TTS (Microsoft — GRÁTIS)

**Voz canonical:** `pt-BR-AntonioNeural`
**Script:** `~/.hermes/scripts/tts-edge.py`

```bash
# Uso direto
python3 ~/.hermes/scripts/tts-edge.py "Texto para falar" [chat_id]
```

### Pre-processamento de Texto

O `tts-edge.py` possui TextScanner single-pass:
- Converte bullet points em narração ordinal (primeiro, segundo...)
- Resume blocos de código (não lê linha a linha)
- Converte símbolos matemáticos e operadores
- Limpa markdown e emojis

### Voices Canonical (apenas estas permitted)

| Voice ID | Tipo | Uso | Status |
|----------|------|-----|--------|
| `pt-BR-AntonioNeural` | Masculino PT-BR | **PADRÃO** — produção | ✅ |
| `pt-BR-Female` | Feminino PT-BR | Fallback | ✅ |
| Todas outras | — | BLOQUEADAS | ❌ |

---

## Environment Variables (Canonical)

```bash
# STT Primary (Groq cloud — FREE 150min/dia)
source /srv/monorepo/.env
GROQ_API_KEY=${GROQ_API_KEY}

# STT Fallback (faster-whisper local)
STT_DIRECT_URL=http://localhost:8204

# TTS (Edge/Microsoft — FREE)
TTS_BRIDGE_URL=http://localhost:8012

# Voice Config
HERMES_VOICE=pt-BR-AntonioNeural
HERMES_MAX_TTS_SIZE_BYTES=52428800  # 50MB max
```

### Secrets — NEVER HARDCODE

```bash
# Retrieve from .env (canonical source)
source /srv/monorepo/.env

# Never do this:
# GROQ_API_KEY=sk-xxx written directly
# Bearer sk-xxx hardcoded
```

---

## Ports & Services

| Service | Port | Type | Health |
|---------|------|------|--------|
| Hermes Gateway | 8642 | Agent brain | ✅ |
| LiteLLM | 4000 | LLM proxy | ✅ |
| Edge TTS Bridge | 8012 | TTS gateway | ✅ |
| faster-whisper | 8204 | STT fallback | ✅ |
| Ollama | 11434 | Local LLM | ✅ |
| Qdrant | 6333 | Vector DB | ✅ |

---

## Monitoring

### Health Check

```bash
# STT providers
curl -sf http://localhost:8204/health  # faster-whisper

# TTS
curl -sf http://localhost:8012/health  # Edge TTS Bridge

# Groq (external)
curl -sf https://api.groq.com/openai/v1/models 2>/dev/null && echo "Groq OK"
```

---

## Incident Response

### Groq Rate Limited (>150 min/day)

1. Automatic fallback to faster-whisper (:8204)
2. Monitor: `curl -sf http://localhost:8204/health`
3. Alert if fallback also fails

### Edge TTS Down

1. Check container: `docker ps | grep edge-tts`
2. Check logs: `docker logs zappro-edge-tts --tail 50`
3. Restart if needed: `docker restart zappro-edge-tts`

### STT Fallback Down

1. Check process: `ps aux | grep faster-whisper`
2. Restart service manually
3. Verify: `curl -sf http://localhost:8204/health`

---

## Flow Diagram

```
┌─────────────┐
│   Telegram  │
│  Voice Msg  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Hermes Gateway  │
│    :8642        │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐     ┌──────────────────┐
│  Groq Whisper    │     │ faster-whisper   │
│  (cloud)          │────▶│   :8204          │
│  whisper-large    │     │   (fallback)    │
│  -v3-turbo        │     └──────────────────┘
│  (150min FREE)    │
└──────┬──────────┘
       │ texto
       ▼
┌─────────────────┐
│    LiteLLM       │
│    :4000        │
│  MiniMax-M2.7   │
└──────┬──────────┘
       │ texto
       ▼
┌─────────────────┐
│   Edge TTS       │
│ pt-BR-Antonio   │
│  (FREE)         │
└──────┬──────────┘
       │ audio.opus
       ▼
┌─────────────┐
│   Telegram  │
│   sendVoice │
└─────────────┘
```

---

## Provider Cost Reference

| Provider | Model | Input Cost | Output Cost |
|----------|-------|------------|-------------|
| Groq | whisper-large-v3-turbo | $0 (150min/day free) | — |
| MiniMax | minimax-m2.7 | $0.10/1M | $0.10/1M |
| Edge TTS | pt-BR-AntonioNeural | $0 | $0 |
| Ollama | qwen2.5:3b | $0 | $0 |

---

## Audit Log

```bash
echo "$(date '+%Y-%m-%d %H:%M:%S') - Voice/STT stack verified" >> /srv/logs/audit.log
```

---

**Nexus Framework:** /srv/monorepo/docs/NEXUS-SRE-GUIDE.md
**Related:** VOICE-PIPELINE.md, LLM_PROVIDER_ARCHITECTURE.md


---

## OPENWEBUI HVAC MULTIMODAL (SPEC-140)

zappro-clima-tutor / llm.zappro.site = cérebro (memória, RAG, router)
LiteLLM / api.zappro.site = gateway de modelos
MiniMax M2.7 = primary LLM
Groq = STT (whisper-large-v3-turbo)
Edge TTS = TTS (pt-BR-FranciscaNeural)
Qwen2.5VL:3B = visão (Ollama local)
Qdrant/Mem0/Postgres/Hermes = memória e RAG
```

## Arquitetura-Alvo

### Fluxo de Texto/Instrução
```
OpenWebUI → zappro-clima-tutor → llm.zappro.site → LiteLLM → MiniMax M2.7
```

### Fluxo STT
```
OpenWebUI → Groq (whisper-large-v3-turbo) → texto → zappro-clima-tutor
```

### Fluxo TTS
```
zappro-clima-tutor → OpenWebUI → Edge TTS (pt-BR-FranciscaNeural)
```

### Fluxo de Visão
```
OpenWebUI anexo → zappro-clima-tutor → Qwen2.5VL:3B (Ollama :11434) → extrai código → estado → MiniMax
```

## Tarefas

### T-OW01: Config OpenWebUI — API e Modelo Principal
**Arquivo:** `docker-compose.openwebui-hvac.yml`
- OPENAI_API_BASE_URL=http://localhost:4017/v1
- OPENAI_API_KEY=sk-local-zappro-clima
- DEFAULT_MODELS=zappro-clima-tutor
- DEFAULT_PINNED_MODELS=zappro-clima-tutor
- TASK_MODEL_EXTERNAL=zappro-clima-tutor
- ENABLE_OLLAMA_API=false
- Expor SOMENTE zappro-clima-tutor como modelo

### T-OW02: Config STT — Groq Whisper
**Arquivo:** `docker-compose.openwebui-hvac.yml` (env section)
- AUDIO_STT_ENGINE=openai
- AUDIO_STT_OPENAI_API_BASE_URL=https://api.groq.com/openai/v1
- AUDIO_STT_OPENAI_API_KEY=${GROQ_API_KEY}
- AUDIO_STT_MODEL=whisper-large-v3-turbo
- AUDIO_STT_SUPPORTED_CONTENT_TYPES=audio/wav,audio/mpeg,audio/webm,audio/mp4

### T-OW03: Config TTS — Edge TTS
**Runtime verificado em 2026-04-29:** container `zappro-edge-tts`, imagem `edge-tts-edge-tts`, healthy, `127.0.0.1:8012 -> 8015/tcp`.
- AUDIO_TTS_ENGINE=openai
- AUDIO_TTS_OPENAI_API_BASE_URL=http://127.0.0.1:8012/v1
- AUDIO_TTS_OPENAI_API_KEY=not-needed
- AUDIO_TTS_MODEL=tts-1
- AUDIO_TTS_VOICE=pt-BR-AntonioNeural
- AUDIO_TTS_SPLIT_ON=punctuation

### T-OW04: Config LiteLLM — MiniMax Primary
**Arquivo:** `config/litellm/config.yaml` ou `docker-compose.litellm.yml`
- model_name: minimax-m2.7
- model: openai/MiniMax-M2.7
- api_base: https://api.minimax.io/v1
- fallback: minimax-m2.7-highspeed
- temperature: 0.45-0.55, top_p: 0.9, max_tokens: 1800-2500

### T-OW05: Config Qwen2.5VL — Ollama Visão
**Arquivo:** `scripts/hvac-rag/hvac_vision.py`
- qwen2.5vl:3b via Ollama local :11434
- Usado SOMENTE como ferramenta interna do tutor
- NÃO exposto como modelo público no OpenWebUI
- Fluxo: anexo → detecta imagem → chama Ollama → extrai texto → injeta no estado

### T-OW06: Healthcheck Atualizado
**Arquivo:** `scripts/hvac-rag/hvac-healthcheck.py`
- OpenWebUI (:3456 ou subdomain)
- zappro-clima-tutor (:4017)
- LiteLLM/api.zappro.site (:4000)
- MiniMax model alias
- Groq STT endpoint
- Edge TTS endpoint
- Ollama qwen2.5vl
- Qdrant
- Mem0
- Postgres
- Não imprimir secrets

### T-OW07: Smoke Test Multimodal
**Arquivo:** `scripts/hvac-rag/hvac-daily-smoke.py`
- Teste de chat via zappro-clima-tutor
- Teste de STT (se Groq key disponível)
- Teste de TTS (se Edge TTS disponível)
- Teste de visão com imagem dummy
- Validar que OpenWebUI só mostra zappro-clima-tutor

### T-OW08: Documentação — RUNBOOK
**Arquivo:** `docs/RUNBOOKS/OPENWEBUI-HVAC-MULTIMODAL-ARCHITECTURE.md`
- Arquitetura completa com diagramas
- Variáveis de ambiente
- Fluxos de dados
- Limites de cada componente
- Troubleshooting

### T-OW09: Verificação — Modelo Único Visível
**Validar:**
- OpenWebUI mostra SOMENTE zappro-clima-tutor
- NÃO mostra: minimax-m2.7, qwen2.5vl, hvac-manual-strict, field-tutor, printable, LiteLLM

### T-OW10: Verificação — Fluxo de Texto
**Validar:**
- Chat → zappro-clima-tutor → LiteLLM → MiniMax
- Resposta volta com formato de tutor técnico PT-BR

### T-OW11: Verificação — Segurança
**Validar:**
- api.zappro.site não exposto publicamente
- Qdrant não exposto publicamente
- LiteLLM protegido por Access (Cloudflare)
- Secrets nunca em logs

## Critérios de Aceite

1. OpenWebUI expõe só zappro-clima-tutor como modelo
2. STT usa Groq whisper-large-v3-turbo
3. TTS usa Edge TTS com pt-BR-FranciscaNeural
4. Imagem anexada chama qwen2.5vl:3b via Ollama local
5. LiteLLM é gateway de modelos (não chamada direta)
6. Healthcheck valida todos os componentes
7. Documentação completa com fluxos
8. Smoke test passa

## Componentes

| Componente | URL/Porta | Uso |
|-----------|-----------|-----|
| OpenWebUI | chat.zappro.site | Interface |
| zappro-clima-tutor | llm.zappro.site :4017 | Cérebro |
| LiteLLM | api.zappro.site :4000 | Gateway modelos |
| Groq STT | api.groq.com | Voz→texto |
| Edge TTS | :8012 | Texto→voz |
| Qwen2.5VL | Ollama :11434 | Visão |
| Qdrant | hermes-second-brain-qdrant | RAG |
| Mem0 | localhost | Memória quente |
| Postgres | localhost | Ledger eventos |

## Restrições

- NÃO expor Qdrant publicamente
- NÃO colocar api.zappro.site sem Cloudflare Access
- NÃO expor modelos internos (hvac-manual-strict, etc)
- NÃO imprimir secrets em logs

## Notas de Implementação (2026-04-29)

### Marcas Brasileiras Suportadas
Sistema agora reconhece todas as marcas principais de AC no Brasil:
- Springer, Komeco, Agratto, Comfee, Mondial, PHCO (adicionadas)
- Daikin, Carrier, Midea, LG, Samsung, Gree, Hitachi, Johnson, Elgin, Consul, Electrolux (existentes)

### Fluxo de Fallback Universal
```
Qdrant miss (modelo não indexado)
  → Triagem técnica via MiniMax M2.7 (sempre responde)
  → Checagem externa (MiniMax MCP → Tavily HTTP API → DuckDuckGo Lite → Google News RSS)
  → LLM formata resposta em PT-BR
```

### Correções Aplicadas
- "Sprint" não dispara mais rota "printable" (word-boundary regex)
- Respostasforçam PT-BR — sem CJK/Cirílico
- Pydantic v2 compatibility em extract_state_from_messages
- Chave Tavily exposta em chat deve ser rotacionada após validação; não registrar valor em git/logs
