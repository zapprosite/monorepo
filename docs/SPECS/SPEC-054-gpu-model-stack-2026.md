---
name: SPEC-054-gpu-model-stack-2026
description: 'GPU Model Stack 2026: matemática VRAM RTX 4090 24GB para Hermes 100% local — texto, visão, STT PT-BR, TTS, embedding'
status: DONE
priority: medium
author: Principal Engineer
date: 2026-04-16
---

# SPEC-054: GPU Model Stack — VRAM Math RTX 4090 (24GB)

**TL;DR:** Stack lean em vigor — qwen2.5vl/llama3-tomcat/llava-phi3 descargados, 20.6 GB VRAM livre. Próximo passo: llama4-scout-17b quando disponível no registry.

---

## Hardware

| Componente | Especificação                                        |
| ---------- | ---------------------------------------------------- |
| GPU        | NVIDIA RTX 4090 — 24 GB VRAM (24,564 MiB)            |
| VRAM Used  | ~2.9 GB (Ollama overhead + whisper + Kokoro + nomic) |
| VRAM Free  | ~20.6 GB disponível para modelos                     |

---

## VRAM Budget — Stack Lean (16/04/2026)

```
STACK LEAN ATUAL:
├── whisper-medium-pt   │  4.0 GB  │ STT LOCAL PRIMARY
├── Kokoro TTS GPU      │  1.5 GB  │ TTS LOCAL (0.5GB VRAM)
├── nomic-embed-text    │  0.5 GB  │ Qdrant RAG (carregado)
├── Ollama overhead     │ ~0.5 GB  │ runtime
└── RustDesk (2x)       │ ~0.9 GB  │ FIXO (não remover)
──────────────────────────────────────────
TOTAL                   │  7.4 GB  ★ 16.6 GB LIVRE

STACK FUTURA (llama4-scout disponível):
├── llama4-scout-17B    │ 11.0 GB  │ LLM + visão + 1M ctx
├── whisper-medium-pt   │  4.0 GB  │ STT LOCAL PRIMARY
├── Kokoro TTS GPU      │  1.5 GB  │ TTS LOCAL
├── nomic-embed-text    │  0.5 GB  │ Qdrant RAG
├── Ollama overhead     │ ~0.5 GB  │ runtime
└── RustDesk (2x)       │ ~0.9 GB  │ FIXO
──────────────────────────────────────────
TOTAL                   │ 18.4 GB  ★  5.6 GB LIVRE
```

| Modelo                      | VRAM   | Estado       | Notes                  |
| --------------------------- | ------ | ------------ | ---------------------- |
| llama4-scout-17B Q4         | 11 GB  | ⏳ PENDENTE  | registry Ollama        |
| whisper-medium-pt           | 4.0 GB | ✅ CARREGADO | STT primary, WER 6.58% |
| Kokoro TTS GPU              | 0.5 GB | ✅ CARREGADO | TTS primary PT-BR      |
| nomic-embed-text            | 0.5 GB | ✅ CARREGADO | Qdrant RAG             |
| qwen2.5vl-7B Q4             | 0 GB   | ❌ DESCARR.  | substituído por llama4 |
| llama3-portuguese-tomcat-8b | 0 GB   | ❌ DESCARR.  | substituído por llama4 |
| llava-phi3                  | 0 GB   | ❌ DESCARR.  | crashava SIGSEGV (bug) |
| RustDesk (2x)               | 0.9 GB | ⚙️ FIXO      | não remover (app)      |

---

## Modelos Disponíveis 2026 — Research Results

### Text-Only (Melhor qualidade para conversa)

| Modelo                     | VRAM      | Context     | Notes                |
| -------------------------- | --------- | ----------- | -------------------- |
| gemma4-27b-it Q4_K_M       | ~18-19 GB | 32k         | TIGHT — melhor texto |
| gemma4-12b-it Q4_K_M       | ~7 GB     | 32k         | BOM                  |
| **qwen3.5-9.65B Q4_K_M**   | ~6.5 GB   | 262k ctx ❤️ | ✅ INSTALADO         |
| llama4-scout-17B Q4_K_M    | ~11 GB    | 1M ctx      | vision + text        |
| llama4-maverick-17B Q4_K_M | ~11 GB    | 1M ctx      | vision + text        |
| mistral-small-24B Q4_K_M   | ~13.5 GB  | 32k         | BOM                  |
| mistral-nemo-12B Q4_K_M    | ~7.5 GB   | 32k         | BOM                  |
| codestral-22B Q4_K_M       | ~14 GB    | -           | code-focused         |

### Vision + Text (Um modelo para ambos)

| Modelo                  | VRAM    | Context | Notes                         |
| ----------------------- | ------- | ------- | ----------------------------- |
| **qwen2.5vl-7B Q4_K_M** | ~4.5 GB | 8k      | ✅ ACTUAL — texto + visão     |
| llama4-scout-17B Q4     | ~11 GB  | 1M ctx  | NOVO — vision + text          |
| llama4-maverick-17B Q4  | ~11 GB  | 1M ctx  | NOVO — vision + text          |
| gemma4-E4B Q4/Q6        | ~3-5 GB | -       | vision, 4B params             |
| llava-phi3 Q4           | ~2.5 GB | -       | ❌ CRASHA (Ollama 0.20.2 bug) |

### STT — Whisper PT-BR

| Modelo                       | VRAM    | WER   | Notes                        |
| ---------------------------- | ------- | ----- | ---------------------------- |
| whisper-medium-pt            | ~4 GB   | 6.58% | ✅ ACTUAL — PT-BR fine-tuned |
| whisper-large-v3-turbo INT8  | ~2.5 GB | ~7%   | alternativa lean             |
| distil-whisper-large-v3-ptbr | ~1.5 GB | ~8%   | muito lean                   |

### TTS — Kokoro

| Modelo          | VRAM        | Voices | Notes                               |
| --------------- | ----------- | ------ | ----------------------------------- |
| Kokoro ONNX GPU | ~0.4-1.5 GB | 64     | ✅ ACTUAL — pm_santa, pf_dora PT-BR |

### Embedding

| Modelo           | VRAM    | Dims | Notes              |
| ---------------- | ------- | ---- | ------------------ |
| nomic-embed-text | ~0.5 GB | 1024 | ✅ ACTUAL — 274M   |
| bge-m3           | ~1.2 GB | 1024 | alternativa — 566M |

---

## Alternativas de Stack

### Alternativa A — Text + Vision separados (melhor qualidade)

```
gemma4-12b Q4 (texto)    │  7.0 GB
qwen2.5vl-7B Q4 (visão) │  4.5 GB
whisper-medium-pt        │  4.0 GB
Kokoro TTS               │  1.5 GB
nomic-embed-text         │  0.5 GB
───────────────────────────────────
PICO                      │ 17.5 GB  ★ 6.5 GB livre
```

### Alternativa B — Llama4 Scout (17B vision + text + 1M ctx)

```
llama4-scout-17B Q4      │ 11.0 GB
whisper-medium-pt        │  4.0 GB
Kokoro TTS               │  1.5 GB
nomic-embed-text         │  0.5 GB
───────────────────────────────────
PICO                      │ 17.0 GB  ★ 7.0 GB livre
```

### Alternativa C — Mistral Small 24B + visão (POUCO HEADROOM)

```
mistral-small-24B Q4     │ 13.5 GB
qwen2.5vl-7B (visão)     │  4.5 GB
whisper-medium-pt        │  4.0 GB
Kokoro TTS                │  1.5 GB
nomic-embed-text          │  0.5 GB
───────────────────────────────────
PICO                      │ 24.0 GB  ⚠️ CHEIO! 0 GB livre
```

---

## Conclusão

**Stack actual é ÓPTIMA para 24GB VRAM.**

- Cabe tudo: pico 12.7GB com 11.3GB livre
- Não há melhoria significativa que justifique swap
- whisper-medium-pt INT8 (~1.5GB) libertaria 2.5GB extra se necessário

**Para upgrade futuro considerar:**

1. **llama4-scout-17B Q4** (~11GB) — substitui qwen2.5vl como primário vision+text com 1M ctx
2. **gemma4-27b Q4** (~18GB) — melhor texto puro, mas sem visão simultânea com outros
3. **whisper INT8** (~1.5GB) — libera 2.5GB VRAM

---

## Sources

- Research agents: Gemma4, Llama4, Whisper PT-BR, Full Stack (12/04/2026)
- SYSTEM_STATE.md (actual measurements 06/04/2026)
- SPEC-053 (current deployment)
