---
name: SPEC-055-cloud-voice-apis-ptbr-2026
description: 'Research 16/04/2026: GROQ + Edge TTS vs local stack — STT/TTS PT-BR cloud APIs comparison. 14 agents research. Conclusão: local stack é melhor custo/qualidade.'
status: COMPLETED
priority: medium
author: Principal Engineer
date: 2026-04-16
---

# SPEC-055: Cloud Voice APIs vs Local Stack — PT-BR Comparison

> **TL;DR:** Local stack (whisper-medium-pt + Kokoro) é a melhor escolha para PT-BR. GROQ+Edge é a melhor alternativa cloud se latência for crítica.

---

## Research Methodology

14 agentes MiniMax pesquisaram em paralelo (16/04/2026):

- GROQ voice programming API
- Microsoft Edge TTS PT-BR
- Azure Speech STT+TTS PT-BR
- Deepgram STT+TTS PT-BR
- ElevenLabs TTS PT-BR
- OpenAI Whisper API
- Coqui XTTS v2 PT-BR
- Voice programming latency comparison
- Whisper large-v3-turbo benchmarks
- Complete voice PT-BR stack recommendation

---

## STT (Speech-to-Text) Comparison

| Serviço                     | Custo                 | PT-BR                 | Latência    | WER PT-BR | Notas                         |
| --------------------------- | --------------------- | --------------------- | ----------- | --------- | ----------------------------- |
| **GROQ Whisper**            | $0.04/hr              | ✅ `language="pt"`    | ~200-400ms  | ~7%       | Turbo: 216x realtime          |
| **OpenAI Whisper API**      | $0.006/min ($0.36/hr) | ✅                    | 300-600ms   | ~6-7%     | Mais barato que GROQ          |
| **Azure Speech STT**        | ~$1/hora              | ✅ Fast Transcription | <300ms      | Custom    | Custom Speech + Pronunciation |
| **Deepgram Nova-3**         | ~$0.024/1K chars      | ⚠️ Parcial            | <200ms      | WER -53%  | Sem PT-BR específico          |
| **Local whisper-medium-pt** | Grátis (GPU)          | ✅ WER 6.58%          | 5-11s (AMD) | **6.58%** | 4GB VRAM, SPEC-009            |

### STT Key Findings

**GROQ:**

- `whisper-large-v3-turbo` — $0.04/hr (STT apenas)
- PT-BR via `language="pt"` (não `pt-BR`)
- 216x realtime transcription (0.46s por 100s áudio)
- **GROQ Orpheus TTS: SÓ English e Arabic** — **SEM suporte PT-BR**
  - English: 6 vozes (Autumn, Diana, Hannah, Austin, Daniel, Troy)
  - Arabic: 6 vozes
  - Custo TTS: $22/M chars (EN), $40/M chars (Arabic)
  - Max input: 200 caracteres por request
- **SEM batch processing**

**OpenAI Whisper API:**

- $0.006/min = $0.36/hr (9x mais caro que GROQ turbo)
- whisper-large-v3-turbo disponível
- 99 idiomas incluindo PT-BR
- Limite: 128MB por ficheiro

**Azure Speech:**

- Fast Transcription: <30s para áudio <60s
- Custom Speech: treina modelo específico PT-BR
- 30+ vozes neurais PT-BR (Thalita, Antonio, Brenda, etc.)
- HD voices: DragonHDLatestNeural

**Local whisper-medium-pt (SPEC-009/SPEC-053):**

- WER: 6.58% PT-BR (SPEC-053 medido)
- 4GB VRAM em RTX 4090
- Fix multipart aplicado em :8204
- Corrigido bug de routing para ai-gateway

---

## TTS (Text-to-Speech) Comparison

| Serviço                     | Custo               | PT-BR                    | Vozes       | Latência | Notas                |
| --------------------------- | ------------------- | ------------------------ | ----------- | -------- | -------------------- |
| **Edge TTS**                | Grátis              | ✅                       | 15+ neurais | <300ms   | TTS-only, sem STT    |
| **ElevenLabs**              | $0.05-0.10/1K chars | ✅ Multilingual          | 10,000+     | <500ms   | Voice cloning, IVR   |
| **Azure Neural TTS**        | ~$1/hora            | ✅                       | 30+         | <300ms   | SSML, Custom Voice   |
| **Deepgram Aura-2**         | $0.030/1K chars     | ❌                       | 40+ (EN)    | <200ms   | Sem PT-BR            |
| **Kokoro ONNX GPU (local)** | Grátis (GPU)        | ✅ `pf_dora`, `pm_santa` | 64          | ~100ms   | 1.5GB VRAM, SPEC-027 |

### TTS Key Findings

**Edge TTS (GRÁTIS mas NÃO é para produção):**

- Wrapper Python `edge-tts` (rany2/edge-tts) — **gratuito**, usa WebSocket
- API não oficial, usa endpoints Edge Bing — **SEM SLA**
- PT-BR vozes neurais disponíveis (mesmas do Azure)
- Latência: ~200-500ms (streaming WebSocket)
- **Risco**: não é oficialmente suportado, pode quebrar,ToS ambiguo
- **Para produção**: usar Azure Speech TTS ($15/1M chars)

**ElevenLabs:**

- Flash/Turbo: $0.05/1K chars
- Multilingual v2/v3: $0.10/1K chars
- 10,000+ vozes na biblioteca
- Instant Voice Cloning: 1-5 min áudio → clone
- Professional Voice Cloning: 30+ min → clone ultra-realista
- IVR/Phone Agents: integração Twilio, SIP, etc.
- **Grátis**: 20,000 chars/mês (free tier)

**Kokoro local (SPEC-027/SPEC-053):**

- 100% gratuito (GPU local)
- 64 vozes disponíveis
- PT-BR: `pf_dora` (feminino), `pm_santa` (masculino)
- 1.5GB VRAM em RTX 4090
- Bridge em :8013 (SPEC-009 imutável)

**Deepgram Aura-2:**

- $0.030/1K chars (mais barato que ElevenLabs)
- 40+ vozes English (EUA, AU, PH)
- **SEM suporte PT-BR** confirmado

---

## Custo por Hora de Voz

```
CLOUD PIPELINE OPÇÕES:

Opção A: GROQ STT + Edge TTS (mais económico cloud)
├─ GROQ whisper-turbo:     $0.04/hr STT (PT-BR ✅)
├─ Edge TTS:               $0.00/hr (não-oficial, sem SLA)
└─ Total:                 ~$0.04/hr ★ MELHOR CLOUD (mas risco)

Opção B: GROQ STT + Azure TTS (produção confiável)
├─ GROQ whisper-turbo:     $0.04/hr STT
├─ Azure TTS:             ~$1-2/hr (15/1M chars × ~500 chars/min × 60min)
└─ Total:                 ~$1-2/hr ★ PRODUÇÃO

Opção C: OpenAI Whisper + ElevenLabs (premium)
├─ OpenAI whisper:        $0.36/hr STT
├─ ElevenLabs TTS:        ~$3-6/hr
└─ Total:                 ~$3.36-6.36/hr

Opção D: Azure Speech (meio-termo)
├─ Azure STT:             ~$1/hr
├─ Azure TTS:             ~$1/hr
└─ Total:                 ~$2/hr

LOCAL STACK (SPEC-053):
├─ whisper-medium-pt:     $0.00/hr (GPU)
├─ Kokoro ONNX GPU:       $0.00/hr (GPU)
└─ Total:                 $0.00/hr ★★ MELHOR TOTAL
```

**Análise de custo por mês** (8h/dia × 30 dias = 240h):

| Pipeline         | Custo/mês |
| ---------------- | --------- |
| Local (SPEC-053) | $0        |
| GROQ + Azure TTS | ~$30-60   |
| Azure Speech     | $480      |
| ElevenLabs       | $720-1440 |

---

## Arquitectura Recomendada

### Prioridade 1: Manter Local (SPEC-053) — ✅ DONE

```
┌─────────────────────────────────────────────┐
│ Telegram Voice Message                       │
│   ↓                                         │
│ Hermes Gateway :8642                        │
│   ↓ STT              ↓ TTS                 │
│ whisper-medium-pt   Kokoro :8013           │
│ :8204  (GPU)         (GPU)                  │
│ 4GB VRAM            1.5GB VRAM             │
│ WER: 6.58% PT-BR    pf_dora/pm_santa       │
└─────────────────────────────────────────────┘
PICO VRAM: 5.5GB / 24GB ★ 18.5GB livre
Custo: $0.00/hora
```

### Prioridade 2: GROQ + Edge TTS (se latência STT crítica)

```
┌─────────────────────────────────────────────┐
│ Telegram Voice Message                       │
│   ↓                                         │
│ Hermes Gateway :8642                        │
│   ↓ STT              ↓ TTS                 │
│ GROQ Whisper         Edge TTS (grátis)   │
│ ($0.04/hr)           ~200-500ms latency   │
└─────────────────────────────────────────────┘
Custo: $0.04/hora (GROQ) + $0 (Edge TTS)
```

**Upgrade para GROQ STT** (se adoptado):

- Mudar `STT_DIRECT_URL` de `:8204` para GROQ endpoint
- Usar Edge TTS (grátis) como TTS cloud
- **Cuidado**: Edge TTS não é oficial, sem SLA, pode quebrar
- Endpoint GROQ: `https://api.groq.com/v1/audio/transcriptions`
- Endpoint Edge TTS: `edge-tts` Python package
- Endpoint GROQ: `https://api.groq.com/v1/audio/transcriptions`

---

## Imutabilidade (SPEC-009)

> **SPEC-009 imutável**: `faster-whisper-medium` em :8204 (canonical). TTS: Kokoro via **TTS Bridge :8013**. Nunca Kokoro directo.

Qualquer mudança a STT ou TTS que não siga SPEC-009 requer SPEC override explícito.

---

## Veredito Final

| Critério             | Local (SPEC-053) | GROQ + Edge TTS      | ElevenLabs    |
| -------------------- | ---------------- | -------------------- | ------------- |
| **Custo**            | ★★★★★ $0         | ★★★★☆ $0.04/hr       | ★★☆☆☆ $3-6/hr |
| **Qualidade STT**    | ★★★★☆ WER 6.58%  | ★★★★☆ ~7%            | N/A           |
| **Qualidade TTS**    | ★★★★☆            | ★★★☆☆ (Edge sem SLA) | ★★★★★         |
| **Latência STT**     | ★★☆☆☆ 5-11s      | ★★★★★ <400ms         | N/A           |
| **Latência TTS**     | ★★★★★ ~100ms     | ★★★★☆ <500ms         | ★★★★☆ <500ms  |
| **Privacidade**      | ★★★★★ 100% local | ★★★☆☆ Cloud          | ★★☆☆☆ Cloud   |
| **PT-BR específico** | ★★★★★            | ★★★★☆                | ★★★★★         |
| **Confiabilidade**   | ★★★★★            | ★★☆☆☆ (Edge sem SLA) | ★★★★☆         |

**Recomendação**: Manter stack local (SPEC-053). É a melhor relação custo/qualidade/privacidade para PT-BR.

**Se latência STT <400ms for crítica**: GROQ + Edge TTS ($0.04/hr) é a alternativa cloud mais económica — mas Edge TTS não é oficial e não tem SLA.

---

## Files

- SPEC-053: Stack 100% local deployed
- SPEC-054: VRAM math RTX 4090
- SPEC-009: Audio stack imutável
- SPEC-027: Voice pipeline PT-BR

---

## Research Agents (16/04/2026)

14 agents executados em paralelo via MiniMax M2.7:

1. Research GROQ voice programming API ✅
2. Research Microsoft Edge TTS PT-BR ✅
3. Research Azure Speech STT TTS PT-BR ✅
4. Research Deepgram STT PT-BR pricing ✅
5. Research ElevenLabs PT-BR voice ✅
6. Research OpenAI Whisper API ✅
7. Research Coqui XTTS v2 PT-BR ✅
8. Research voice programming latency ✅
9. Research Whisper large-v3 turbo PT-BR API ✅
10. Research GROQ vs Azure vs Edge TTS latency ✅
11. Research best cloud STT API PT-BR comparison ✅
12. Research complete voice PT-BR stack recommendation ✅
13. Research Whisper PT-BR local benchmarks ✅
14. Research voice model PT-BR quality comparison ✅

Fonts: Azure Docs, HuggingFace, ElevenLabs, GROQ API docs, Edge TTS docs, Deepgram docs.
