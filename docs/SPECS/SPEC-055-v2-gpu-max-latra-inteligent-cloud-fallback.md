---
name: SPEC-055-v2-gpu-max-latra-inteligent-cloud-fallback
description: 'Arquitectura v2: GPU maximizada com water cooling — llama4-scout-17B + whisper-medium-pt + Kokoro, cloud STT only quando GPU VRAM >50% livre (GROQ + Deepgram free tiers)'
status: PROPOSED
priority: high
author: Principal Engineer
date: 2026-04-16
specRef: SPEC-053, SPEC-054, SPEC-048, SPEC-009
---

# SPEC-055-v2: GPU Max + Intelligent Cloud Fallback

**TL;DR:** Maximizar GPU com water cooling (24/7 high load), usar cloud STT só quando GPU precisa de folga — GROQ + Deepgram free tiers como backup inteligente.

---

## Hardware

| Componente  | Especificação                                          |
| ----------- | ------------------------------------------------------ |
| GPU         | NVIDIA RTX 4090 — 24 GB VRAM (water cooled)            |
| Water block | Custom loop — aguenta 24/7 em high load                |
| VRAM Used   | ~2.9 GB (Ollama + whisper + Kokoro + nomic + RustDesk) |
| VRAM Free   | ~20.6 GB disponível para modelos                       |

---

## VRAM Budget — Stack Lean Actual (16/04/2026)

```
LEAN STACK ACTUAL (qwen2.5vl/llama3-tomcat/llava-phi3 descargados):
├── whisper-medium-pt   │  4.0 GB  │ STT local PRIMARY (:8204)
├── Kokoro TTS GPU      │  0.5 GB  │ TTS local (:8013)
├── nomic-embed-text    │  0.5 GB  │ Qdrant RAG (carregado)
├── Ollama + runtime    │  1.5 GB  │ overhead
└── RustDesk (2x)       │  0.9 GB  │ FIXO
───────────────────────────────────────────
TOTAL GPU              │  7.4 GB  ★ 16.6 GB LIVRE

FULL GPU STACK (llama4-scout disponível):
├── llama4-scout-17B    │ 11.0 GB  │ LLM + visão + 1M ctx
├── whisper-medium-pt   │  4.0 GB  │ STT local PRIMARY
├── Kokoro TTS GPU      │  1.5 GB  │ TTS local PRIMARY
├── nomic-embed-text    │  0.5 GB  │ embedding
└── nomic-embed-text    │  0.5 GB  │ RustDesk + overhead
───────────────────────────────────────────
TOTAL GPU              │ 17.5 GB  ★  6.5 GB LIVRE
```

**Pico real agora**: ~7.4GB VRAM com stack lean
**Pico futuro**: ~17.5GB VRAM com llama4-scout-17B activo
**VRAM livre agora**: ~20.6 GB (buffer enorme para 24/7)

---

## Arquitectura v2 — Intelligent Cloud Fallback

```
┌─────────────────────────────────────────────────────────────┐
│                    HERMES GATEWAY :8642                      │
│                         ↓                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              STT SELECTOR (rate limiter)             │  │
│  │                                                      │  │
│  │  IF GPU VRAM > 50% livre (~12GB):                   │  │
│  │    → whisper-medium-pt :8204 (LOCAL)  ← PRIMARY    │  │
│  │  ELSE:                                               │  │
│  │    → GROQ whisper-turbo (cloud)   ← FALLBACK        │  │
│  │       → Deepgram Nova-3 (cloud)   ← FALLBACK #2     │  │
│  └─────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              LLM SELECTOR                             │  │
│  │                                                      │  │
│  │  PRIMARY: llama4-scout-17B Q4 (GPU)                  │  │
│  │  FALLBACK: qwen2.5vl-7B Q4 (GPU)                     │  │
│  │  FALLBACK #2: llama3-portuguese-tomcat-8b (GPU)     │  │
│  └─────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              TTS — ALWAYS LOCAL                      │  │
│  │         Kokoro :8013 (GPU) — PRIMARY                  │  │
│  │         Edge TTS (cloud) — FALLBACK                 │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## STT Cloud Free Tiers

### GROQ Whisper (PRIMARY CLOUD)

| Item         | Valor                    |
| ------------ | ------------------------ |
| **Modelo**   | `whisper-large-v3-turbo` |
| **Custo**    | Free tier: ~50 req/min   |
| **PT-BR**    | ✅ via `language="pt"`   |
| **Latência** | ~200-400ms               |
| **Limite**   | Rate limited             |

### Deepgram Nova-3 (FALLBACK #2)

| Item         | Valor                |
| ------------ | -------------------- |
| **Modelo**   | Nova-3               |
| **Custo**    | $200 free credits    |
| **PT-BR**    | ✅                   |
| **Latência** | <300ms (sub-300ms)   |
| **WER**      | -53% vs concorrentes |

### LiteLLM Fallback Chain

```yaml
stt:
  primary: whisper-medium-pt # Local :8204
  fallback_1:
    provider: litellm
    model: groq/whisper-large-v3-turbo
    api_key: ${GROQ_API_KEY}
  fallback_2:
    provider: litellm
    model: deepgram/nova-3
    api_key: ${DEEPGRAM_API_KEY}
```

---

## TTS Strategy

### Kokoro LOCAL (PRIMARY) — :8013

- 100% local, não compete com VRAM (só 0.5GB)
- Sempre activo como primary
- Fallback: Edge TTS cloud (se Kokoro falha)

### Edge TTS (FALLBACK) — $0

- Wrapper Python `edge-tts` (não-oficial, sem SLA)
- Só usar se Kokoro :8013 offline
- Rate limit: 20 TPS

---

## VRAM-Aware Rate Limiter

### Logic

```python
# Pseudo-code para selector
def get_stt_provider():
    vram_free = get_gpu_vram_free()  # nvidia-smi

    if vram_free > 12_GB:  # > 50% livre
        return "local"  # whisper-medium-pt :8204
    elif vram_free > 8_GB:
        return "groq"  # GROQ cloud (free tier)
    else:
        return "deepgram"  # Deepgram (fallback final)
```

### Thresholds

| GPU VRAM Livre | STT Provider            | Reason                     |
| -------------- | ----------------------- | -------------------------- |
| > 12 GB (50%)  | whisper-medium-pt LOCAL | Headroom suficiente        |
| 8-12 GB        | GROQ whisper-turbo      | GPU stressed, cloud barato |
| < 8 GB         | Deepgram Nova-3         | GPU critical, melhor WER   |

### Kokoro — Always Local

- Kokoro usa ~0.5GB VRAM
- Não compete significativamente com llama4-scout-17B
- Sempre Kokoro local como primary TTS

---

## Modelos

### llama4-scout-17B Q4 (PRIMARY LLM)

| Item             | Valor                             |
| ---------------- | --------------------------------- |
| **VRAM**         | ~11 GB Q4_K_M                     |
| **Context**      | **1M tokens** ★★★★★               |
| **Capabilities** | Texto + Visão                     |
| **Quality**      | Melhor que qwen2.5vl para texto   |
| **Notes**        | 17B params, 1M ctx, vision + text |

### whisper-medium-pt (PRIMARY STT LOCAL)

| Item          | Valor              |
| ------------- | ------------------ |
| **VRAM**      | ~4 GB              |
| **WER PT-BR** | 6.58%              |
| **Endpoint**  | :8204              |
| **Status**    | SPEC-009 canonical |

### Kokoro TTS (PRIMARY TTS LOCAL)

| Item         | Valor                        |
| ------------ | ---------------------------- |
| **VRAM**     | ~0.5-1.5 GB                  |
| **Voices**   | 64 (pf_dora, pm_santa PT-BR) |
| **Endpoint** | :8013                        |
| **Status**   | SPEC-009 canonical           |

### qwen2.5vl-7B Q4 (FALLBACK LLM)

| Item             | Valor                     |
| ---------------- | ------------------------- |
| **VRAM**         | ~4.5 GB                   |
| **Context**      | 8k                        |
| **Capabilities** | Texto + Visão             |
| **Use**          | Se llama4-scout-17B falha |

---

## Custo Cloud Estimado

**Usando free tiers intelligently:**

| Cenário               | GROQ              | Deepgram | Total  |
| --------------------- | ----------------- | -------- | ------ |
| GPU com folga (>12GB) | $0                | $0       | **$0** |
| GPU stressed (8-12GB) | ~$0               | $0       | **$0** |
| GPU critical (<8GB)   | $0 (rate limited) | ~$0      | **$0** |

**Com $200 Deepgram credits**: ~500+ horas de fallback
**GROQ free tier**: ~50 req/min = ~3000 req/hora

**Custo cloud real**: **~$0** enquanto usar free tiers
**Custo GPU**: $0 (eletricidade já incluída no setup)

---

## Implementation Tasks

### T1: Pull llama4-scout-17B Q4

```bash
ollama pull llama4-scout-17b-q4-k-m
# ~11GB download
```

### T2: Configurar LiteLLM fallback chain

```yaml
# litellm/config.yaml
model_list:
  - model_name: whisper-local
    litellm_params:
      model: whisper-medium-pt
      api_base: http://localhost:8204

  - model_name: groq-whisper
    litellm_params:
      model: groq/whisper-large-v3-turbo
      api_key: os.environ/GROQ_API_KEY

  - model_name: deepgram-nova3
    litellm_params:
      model: deepgram/nova-3
      api_key: os.environ/DEEPGRAM_API_KEY

fallbacks:
  - model: whisper-local
    fallback_models: [groq-whisper, deepgram-nova3]
```

### T3: Rate limiter VRAM-aware

```python
# smart_stt_selector.py
import subprocess
import requests

def get_vram_free_gb():
    result = subprocess.run(
        ['nvidia-smi', '--query-gpu=memory.free', '--format=csv,noheader,nounits'],
        capture_output=True, text=True
    )
    return int(result.stdout.strip()) / 1024  # MiB to GB

def get_stt_provider():
    vram = get_vram_free_gb()

    if vram > 12:
        return "local"
    elif vram > 8:
        return "groq"
    else:
        return "deepgram"
```

### T4: Actualizar Hermes config

```yaml
# ~/.hermes/config.yaml
stt:
  provider: adaptive # new mode
  local_threshold_gb: 12
  cloud_fallback_order:
    - groq-whisper
    - deepgram-nova3
```

### T5: Smoke test

```bash
# Test VRAM thresholds
nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits

# Test GROQ fallback
curl -X POST https://api.groq.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F file="@test.wav" \
  -F model="whisper-large-v3-turbo"

# Test Deepgram fallback
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token $DEEPGRAM_API_KEY" \
  --data-urlencode audio=@test.wav
```

---

## Success Criteria

- [ ] llama4-scout-17B Q4 pullado e a funcionar em :11434 ⚠️ BLOQUEADO — modelo ainda não disponível no registry Ollama
- [x] VRAM-aware rate limiter implementado (`scripts/smart-stt-selector.py`)
- [x] whisper-medium-pt :8204 activo como primary (local)
- [x] Kokoro :8013 sempre local (TTS)
- [ ] VRAM < 12GB → GROQ activa automatico (pendente validação endpoint)
- [ ] VRAM < 8GB → Deepgram activa automatico (key needs re-validation)
- [ ] Smoke test passa: STT local + cloud fallback
- [ ] Custo cloud: $0 (free tiers)

## Implementation (2026-04-16)

### T3: VRAM-aware rate limiter ✅

```bash
# scripts/smart-stt-selector.py
python3 scripts/smart-stt-selector.py
# Output: STT_PROVIDER=local | STT_URL=http://localhost:8204 | VRAM_FREE_GB=20.6
```

### Shell wrapper

```bash
source scripts/stt-selector.env
echo $STT_PROVIDER  # local | groq | deepgram
```

### Current state

- VRAM livre: ~20.5 GB (GPU activa com qwen2.5vl:7b + whisper-medium-pt + Kokoro)
- STT Provider: **local** (:8204) — 20.5 GB > 12 GB threshold
- GROQ_API_KEY guardado em .env (pendente validação endpoint)
- DEEPGRAM_API_KEY guardado em .env (key requer re-validação)

---

## O que NÃO fazer

- ❌ Remover whisper-medium-pt local (é primary, não fallback)
- ❌ Remover Kokoro local (TTS sempre local)
- ❌ Usar cloud STT como primary (só fallback)
- ❌ Ignorar VRAM thresholds (rate limiter existe para proteger GPU)

---

## Files

- SPEC-053: Hermes 100% local (legacy)
- SPEC-054: GPU Model Stack 2026
- SPEC-009: Audio stack imutável
- SPEC-048: OpenAI facade
- SPEC-055: Cloud APIs comparison (v1)

---

## Notes

- Water cooling permite 24/7 high load — não há excuse para throttle
- Free tiers são para backup inteligente, não primary
- Custo real: $0 cloud enquanto free tiers durarem
- Quando Deepgram credits acabarem: GROQ só ou budget Azure
