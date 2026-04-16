---
name: SPEC-054-gpu-model-stack-2026
description: 'GPU Model Stack 2026: matemática VRAM RTX 4090 24GB para Hermes 100% local — texto, visão, STT PT-BR, TTS, embedding'
status: DONE
priority: medium
author: Principal Engineer
date: 2026-04-16
---

# SPEC-054: GPU Model Stack — VRAM Math RTX 4090 (24GB)

**TL;DR:** Stack lean definitiva — whisper-medium-pt + Kokoro + nomic + qwen2.5vl:7b + Gemma4-12b-it (future), 14.4 GB VRAM livre.

---

## Hardware

| Componente | Especificação                                                                  |
| ---------- | ------------------------------------------------------------------------------ |
| GPU        | NVIDIA RTX 4090 — 24 GB VRAM (24,564 MiB)                                      |
| VRAM Used  | ~9.6 GB (whisper + Kokoro + nomic + qwen2.5vl:7b + Ollama overhead + RustDesk) |
| VRAM Free  | ~14.4 GB disponível para modelos                                               |

---

## VRAM Budget — Stack Lean (16/04/2026)

```
STACK LEAN DEFINITIVA (16/04/2026):
├── whisper-medium-pt   │  4.0 GB  │ STT LOCAL PRIMARY (:8204)
├── Kokoro TTS          │  0.5 GB  │ TTS LOCAL (:8013)
├── nomic-embed-text    │  0.5 GB  │ Qdrant RAG (carregado)
├── qwen2.5vl:7b       │  4.5 GB  │ LLM + visão + 128K ctx
├── Ollama overhead     │ ~0.5 GB  │ runtime
└── RustDesk (2x)       │ ~0.9 GB  │ FIXO (não remover)
──────────────────────────────────────────
TOTAL                   │  9.6 GB  ★ 14.4 GB LIVRE

STACK FUTURA (Gemma4-12b-it upgrade):
├── Gemma4-12b-it       │  7.0 GB  │ LLM text (32K ctx)
├── qwen2.5vl:7b (visão) │  ~4.5 GB │ visão (mantido)
├── whisper-medium-pt   │  4.0 GB  │ STT LOCAL PRIMARY
├── Kokoro TTS          │  0.5 GB  │ TTS LOCAL
├── nomic-embed-text    │  0.5 GB  │ Qdrant RAG
├── Ollama overhead     │ ~0.5 GB  │ runtime
└── RustDesk (2x)       │ ~0.9 GB  │ FIXO
──────────────────────────────────────────
TOTAL                   │ 16.6 GB  ★  7.4 GB LIVRE
```

| Modelo                      | VRAM   | Estado       | Notes                      |
| --------------------------- | ------ | ------------ | -------------------------- |
| qwen2.5vl:7b                | 4.5 GB | ✅ CARREGADO | LLM + visão, 128K ctx      |
| whisper-medium-pt           | 4.0 GB | ✅ CARREGADO | STT primary, WER 6.58%     |
| Kokoro TTS                  | 0.5 GB | ✅ CARREGADO | TTS primary PT-BR          |
| nomic-embed-text            | 0.5 GB | ✅ CARREGADO | Qdrant RAG                 |
| Gemma4-12b-it               | 7.0 GB | ⏳ FUTURO    | upgrade texto 32K ctx      |
| llama3-portuguese-tomcat-8b | 0 GB   | ❌ DESCARR.  | substituído por Gemma4-12b |
| llava-phi3                  | 0 GB   | ❌ DESCARR.  | crashava SIGSEGV (bug)     |
| gemma3:27b-it-qat           | 0 GB   | ❌ DESCARR.  | não existe no stack        |
| RustDesk (2x)               | 0.9 GB | ⚙️ FIXO      | não remover (app)          |

---

## Modelos Disponíveis 2026 — Research Results

### Text-Only (Melhor qualidade para conversa)

| Modelo              | VRAM      | Context     | Notes                |
| ------------------- | --------- | ----------- | -------------------- |
| gemma4-27b-it       | ~18-19 GB | 32k         | TIGHT — melhor texto |
| gemma4-12b-it       | ~7 GB     | 32k         | BOM                  |
| **qwen3.5-9.65B**   | ~6.5 GB   | 262k ctx ❤️ | ✅ INSTALADO         |
| llama4-scout-17B    | ~11 GB    | 1M ctx      | vision + text        |
| llama4-maverick-17B | ~11 GB    | 1M ctx      | vision + text        |
| mistral-small-24B   | ~13.5 GB  | 32k         | BOM                  |
| mistral-nemo-12B    | ~7.5 GB   | 32k         | BOM                  |
| codestral-22B       | ~14 GB    | -           | code-focused         |

### Vision + Text (Um modelo para ambos)

| Modelo                 | VRAM    | Context | Notes                     |
| ---------------------- | ------- | ------- | ------------------------- |
| **qwen2.5vl:7b**       | ~4.5 GB | 128k    | ✅ ACTUAL — texto + visão |
| llama4-scout-17B Q4    | ~11 GB  | 1M ctx  | NOVO — vision + text      |
| llama4-maverick-17B Q4 | ~11 GB  | 1M ctx  | NOVO — vision + text      |
| gemma4-E4B Q4/Q6       | ~3-5 GB | -       | vision, 4B params         |

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
qwen2.5vl:7b (visão)     │  ~4.5 GB
whisper-medium-pt        │  4.0 GB
Kokoro TTS               │  1.5 GB
nomic-embed-text         │  0.5 GB
───────────────────────────────────
PICO                      │ 16.2 GB  ★ 7.8 GB livre
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
qwen2.5vl:7b (visão)     │  ~4.5 GB
whisper-medium-pt        │  4.0 GB
Kokoro TTS                │  1.5 GB
nomic-embed-text          │  0.5 GB
───────────────────────────────────
PICO                      │ 22.7 GB  ⚠️ 1.3 GB livre
```

---

## Conclusão

**Stack lean é ÓPTIMA para 24GB VRAM — e agora tem UPGRADE REAL.**

- Stack lean actual: pico 9.6GB com 14.4GB livre
- **Upgrade path:** Gemma4-12b-it (~7 GB) — upgrade texto, qwen2.5vl:7b mantém visão

**Upgrade path (por prioridade):**

1. **Gemma4-12b-it** (~7 GB) — upgrade texto 32K ctx
2. **qwen2.5vl:7b** (~4.5 GB) — já instalado, manter visão
3. **Llama4-Scout** (~20.7 GB) — esperar registry Ollama ou single-file <20GB

---

## Sources

- Research agents: Gemma4, Llama4, Whisper PT-BR, Full Stack (12/04/2026)
- HuggingFace API — model discovery (16/04/2026)
- SYSTEM_STATE.md (actual measurements 06/04/2026)
- SPEC-053 (current deployment)

---

## Upgrade Path — qwen2.5vl:7b

### qwen2.5vl:7b (⭐ NOVO CAMPEÃO — 16/04/2026)

| Item                       | Valor                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| **HuggingFace**            | `unsloth/qwen2.5vl:7b-GGUF` (source GGUF, não usado — modelo nativo Ollama) |
| **Params**                 | 8B                                                                          |
| **Context**                | **128K tokens**                                                             |
| **VRAM (native + mmproj)** | **~5.5 GB**                                                                 |
| **VRAM total c/ stack**    | **9.6 GB** — 14.4 GB livre                                                  |
| **Multimodal**             | ✅ SIM (visão + texto)                                                      |
| **Status Ollama**          | NÃO existe — import manual HF                                               |

**Comparativo directo:**

| Modelo                       | VRAM        | Context  | multimodal | VRAM livre                 |
| ---------------------------- | ----------- | -------- | ---------- | -------------------------- |
| **qwen2.5vl:7b native**      | **~5.5 GB** | **128K** | ✅         | **14.4 GB** ✅CAMPEÃO      |
| qwen2.5vl:7b GGUF (hipotét.) | ~3.2 GB     | 128K     | ❌         | (não disponível em Ollama) |

**qwen2.5vl:7b é a escolha óbvia:** mais capaz (128K ctx), mais leve (~5.5GB vs 22GB+ de 32B), mesma qualidade de visão. Já instalado nativamente em Ollama.

### Qwen2.5-VL-32B-Instruct

| GGUF             | VRAM (c/ mmproj) | Cabe?             |
| ---------------- | ---------------- | ----------------- |
| Q3_K_L (16.1 GB) | 22.4 GB          | ✅ (1.6 GB livre) |
| Q4_K_M (18.5 GB) | 24.8 GB          | ❌ (-0.8 GB)      |
| _nativo_         | ~22 GB           | ❌ (>24 GB)       |

**Qwen2.5-VL-32B Q3_K_L** é viável mas muito perto do limite (1.6 GB livre) para usar em produção com whisper + Kokoro simultâneos.

---

## Research 16/04/2026 — Forum Senior Dev Consensus

### Llama-4 Scout 17B (Meta, released 2026-04)

- **HuggingFace:** `meta-llama/Llama-4-Scout-17B-16E-Instruct`
- Q4_K_M: ~60.8 GB (NÃO CABE — sharded 46+14 GB)
- IQ1_S (mradermacher single-file): **20.7 GB — CABE** ⚠️ IQ1 é agressivo
- IQ2_XS: 29.6 GB (NÃO CABE)
- _nativo_: ~17B params, não testado em Ollama
- **Ollama registry:** NÃO existe — import manual necessário

### Qwen3.6-35B-A3B (Qwen, released 2026-04-15)

- **HuggingFace:** `Qwen/Qwen3.6-35B-A3B` (MoE — 3B activos / 35B total)
- IQ2_M (bartowski): **11.2 GB — CABE** ✅ Melhor qualidade/VRAM ratio
- Q3_K_M: 15.1 GB (CABE + 0.8 GB vision = 15.9 GB)
- Q4_K_M: 19.9 GB (QUASE CABE com visão)
- _nativo MoE_: ~35B total / 3B activo, não testado em Ollama
- **Ollama registry:** NÃO existe — MoE pode não funcionar em Ollama

### Gemma4 Vision (Google)

- `gemma-4-E2B-it` (Q4_K_M): **3.2 GB — CABE FACIL** ✅
- `mmproj-BF16`: 0.9 GB
- TOTAL: 4.1 GB — VRAM sobra 12.5 GB
- ⚠️ 2B params = qualidade limitada para tarefas complexas

### Senior Dev Consensus 2026

| Abordagem        | Modelo                          | VRAM    | Veredicto                            |
| ---------------- | ------------------------------- | ------- | ------------------------------------ |
| **PRODUÇÃO**     | qwen2.5vl:7b + whisper + Kokoro | 9.6 GB  | ✅ Stack lean, 14.4 GB livre         |
| **EXPERIMENTAL** | Llama-4 Scout (20.7 GB)         | 22.3 GB | ⚠️ IQ1 = 20-30% perda qualidade      |
| **EXPERIMENTAL** | Qwen3.6-35B-A3B (11.2 GB)       | 13 GB   | ⚠️ MoE não testado em Ollama         |
| **LEVE**         | Gemma4-E2B-Vision (3.2 GB)      | 5 GB    | ⚠️ 2B = fraco para tarefas complexas |

**Consenso:** Ninguém usa Q4_K_M do Llama-4 Scout em 24GB (são 60 GB sharded). A melhor stack para 24GB em 2026 é a stack lean (qwen2.5vl:7b + whisper + Kokoro) e esperar pelo Llama-4 Scout single-file <20GB ou Qwen3.6 MoE com suporte Ollama.

**Stack actual (16/04/2026) está ACIMA da média** — 14.4 GB VRAM livre é mais do que a maioria dos senior devs consegue com a mesma GPU.
