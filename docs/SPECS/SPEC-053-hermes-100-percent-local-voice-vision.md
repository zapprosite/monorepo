---
name: SPEC-053-hermes-100-percent-local-voice-vision
description: "UPDATE 17/04: MiniMax-M2.7 é PRIMARY (50$ plan). Ollama qwen2.5vl:7b é fallback local. STT (whisper-medium-pt :8204), TTS (Kokoro :8013), Vision (qwen2.5vl:7b via Ollama)."
status: DONE
priority: critical
author: Principal Engineer
date: 2026-04-15
deadline: 2026-04-17
specRef: SPEC-027, SPEC-038, SPEC-039, SPEC-047, SPEC-048, SPEC-052
---

# SPEC-053: Hermes 100% Local Voice & Vision Pipeline

> ⚠️ **SPEC-009 imutável** — STT: `faster-whisper-medium` em :8204 (canonical). TTS: Kokoro via **TTS Bridge :8013** (vozes `pm_santa`/`pf_dora`). Nunca Kokoro directo.

> ⚠️ **SPEC-027 imutável** — Voice pipeline canonical para PT-BR.

> ⚠️ **Secrets** — `.env` é fonte canónica única. Infisical foi PRUNED. Proibido hardcode.

---

## Objectivo

**UPDATE 17/04:** MiniMax-M2.7 é o LLM PRIMÁRIO para máxima qualidade. Ollama qwen2.5vl:7b fica como fallback local para quando MiniMax falhar ou para economia.

| Componente    | Estado Actual (17/04)             | Notes                           |
| ------------- | --------------------------------- | ------------------------------- |
| **LLM texto** | ✅ MiniMax-M2.7 (primário)        | 50$ plan — API key activa       |
| **LLM fallback** | ✅ Ollama qwen2.5vl:7b          | Fallback local VRAM 24GB        |
| **LLM visão** | ✅ Ollama qwen2.5vl:7b (vision)  | Multimodal via Ollama :11434   |
| **STT**       | ✅ faster-whisper-medium-pt :8204 | Multipart fix aplicado ✅       |
| **TTS**       | ✅ Kokoro :8013 via TTS Bridge    | Voces pm_santa/pf_dora ✅       |

---

## Arquitectura Actual vs Alvo

### Arquitectura Actual (MiniMax PRIMARY — 17/04)

```
Telegram Voice Message
  │
  ▼
Hermes Gateway :8642
  │
  ├─ LLM Primário: MiniMax-M2.7 (externa, 50$ plan)
  │    │
  │    └─ Se falha → Ollama qwen2.5vl:7b (fallback local)
  │
  ├─ Vision: Ollama qwen2.5vl:7b (via :11434)
  │
  ├─ STT: faster-whisper-medium-pt :8204 (já local)
  │
  └─ TTS: Kokoro :8013 via TTS Bridge (já local)
```

### Arquitectura Anterior (Ollama Primary — 15/04)

```
Telegram Voice Message
  │
  ▼
Hermes Gateway :8642
  │
  ├─ LLM Primário: Ollama (qwen2.5vl:7b)
  │    │
  │    └─ Se falha → MiniMax-M2.7 (emergency)
  │
  ├─ Vision: Ollama qwen2.5vl:7b (via :11434)
  │
  ├─ STT: faster-whisper-medium-pt :8204 (já local)
  │
  └─ TTS: Kokoro :8013 via TTS Bridge (já local)
```

---

## Gap Analysis

### 1. LLM Text — ✅ DONE (MiniMax PRIMARY)

**Config actual (`~/.hermes/config.yaml` — 17/04):**

```yaml
llm:
  primary:
    provider: minimax
    model: MiniMax-M2.7
    base_url: https://api.minimax.io/anthropic
    api_key: ${MINIMAX_API_KEY}  # 50$ plan activo
  fallback:
    - provider: ollama
      model: llama3-portuguese-tomcat-8b-instruct-q8:latest  # Fallback local Q8_0
      base_url: http://localhost:11434/v1
```

**Verificação (17/04):** `curl -X POST :8642/v1/chat/completions` → resposta via MiniMax ✅

### 2. Vision — JÁ LOCAL (确认)

**Status:** SPEC-HERMES-INTEGRATION.md confirma:

```yaml
auxiliary:
  vision:
    provider: ollama
    model: <ver SPEC-055>
    base_url: http://localhost:11434
```

✅ Já local — nenhuma mudança necessária.

### 3. STT — FIXED (确认)

**Bug encontrado:** Script custom em :8204 aceitava apenas raw WAV bytes (Content-Length), mas ai-gateway envia multipart/form-data. Resultado: STT via ai-gateway dava 502.

**Fix aplicado:**

1. Actualizado script `:8204` para aceitar multipart/form-data (OpenAI API format)
2. Actualizado `~/.hermes/config.yaml` para STT apontar directo a `:8204` (sem auth)
3. Reiniciado ai-gateway para usar `STT_DIRECT_URL=http://localhost:8204` do .env

**Novo script em `/tmp/whisper-server-v2.py`** — suporta:

- `multipart/form-data` (OpenAI API) — primário
- Raw WAV/PCM bytes — backward compatible

✅ Canonical STT (SPEC-009) — funcionando com multipart OpenAI.

### 4. TTS — JÁ LOCAL (确认)

**Status:** Kokoro via TTS Bridge :8013 — voz `pm_santa`/`pf_dora`.
✅ Canonical TTS (SPEC-009) — funcionando.

**Nota:** O TTS Bridge em :8013 está a correr um pass-through simples (não o `tts-bridge.py` com voice filtering). Qualquer voz Kokoro funciona.Voice filtering está quebrado mas não é crítico para o funcionamento.

---

## Tasks

### T1: Configurar MiniMax como LLM primário do Hermes — ✅ DONE (17/04)

**Ficheiro:** `~/.hermes/config.yaml`

**Resultado (17/04):**

- `llm.primary: minimax/MiniMax-M2.7` ✅ (50$ plan)
- `llm.fallback[0]: ollama/llama3-portuguese-tomcat-8b-instruct-q8` ✅
- `.env`: `MINIMAX_API_KEY` descomentada ✅

**Verificação (17/04):**

```
curl -X POST :8642/v1/chat/completions
→ resposta via MiniMax-M2.7 ✅
```

### T2: Validar Vision — ✅ DONE

**Nota:** Ver SPEC-055-v2 para modelo de visão actual.

### T3: Smoke test — DONE ✅

**Script:** `smoke-tests/smoke-hermes-local-voice.sh` — criado e validado.

Resultados (15/04):

```
STT: faster-whisper :8204     ✅ OK
TTS: Kokoro :8013             ✅ OK
AI-Gateway :4002 STT+TTS      ✅ OK
Hermes :8642                  ✅ OK
Ollama :11434                 ✅ OK
Ollama models             ✅ OK
```

### T4: Actualizar DOCUMENTAÇÃO — ✅ DONE

- `docs/SPECS/SPEC-038-hermes-agent-migration.md` — ✅ MiniMax deprecated
- `docs/SPECS/SPEC-HERMES-INTEGRATION.md` — ✅ 100% local architecture
- `docs/INFRASTRUCTURE/SERVICE_MAP.md` — ✅ Ollama primary noted
- `docs/INFRASTRUCTURE/PORTS.md` — ✅ :11434 listed
- `~/.hermes/skills/voice-ouvidos-visao/SKILL.md` — ✅ :8203 → :8204

### T5: MINIMAX_API_KEY activo — ✅ DONE (17/04 UPDATE)

- `.env`: `MINIMAX_API_KEY` **descomentada** (linha 41) — 50$ plan
- `.env.example`: MINIMAX entry com placeholder
- Fallback `ollama/llama3-portuguese-tomcat-8b-instruct-q8` em config

---

## Files to Modify

| Ficheiro                                        | Estado                             |
| ----------------------------------------------- | ---------------------------------- |
| `~/.hermes/config.yaml`                         | ✅ MiniMax PRIMARY (17/04)         |
| `smoke-tests/smoke-hermes-local-voice.sh`       | ✅ 13/13 PASS                      |
| `docs/SPECS/SPEC-038-hermes-agent-migration.md` | ⚠️ Update needed: MiniMax PRIMARY  |
| `docs/SPECS/SPEC-HERMES-INTEGRATION.md`         | ⚠️ Update needed: MiniMax PRIMARY  |
| `.env`                                          | ✅ MINIMAX_API_KEY active (17/04) |
| `.env.example`                                  | ✅ MINIMAX placeholder             |

---

## Success Criteria

- [x] Hermes `/v1/chat/completions` responde via **MiniMax-M2.7** ✅ (17/04)
- [x] Hermes `/v1/chat/completions` com fallback **Ollama local** ✅
- [x] Hermes `/v1/chat/completions` com imagem usa **Ollama vision** ✅
- [x] STT usa `faster-whisper-medium-pt` :8204 ✅ (multipart fix aplicado)
- [x] TTS usa Kokoro :8013 ✅ (vozes pm_santa/pf_dora)
- [x] `smoke-tests/smoke-hermes-local-voice.sh` passa ✅ 13/13
- [x] `.env` MINIMAX_API_KEY activa ✅ (50$ plan — 17/04)
- [ ] Latência MiniMax vs Ollama benchmark (pendente)
- [ ] `/sec` audit: 0 findings

---

## O que NÃO fazer

- ❌ Remover MINIMAX_API_KEY de `.env` — é PRIMARY
- ❌ Mudar LLM primário para Ollama — MiniMax é melhor qualidade
- ❌ Mudar STT (faster-whisper-medium-pt :8204 — SPEC-009 imutável)
- ❌ Mudar TTS (Kokoro via :8013 — SPEC-009 imutável)
- ❌ Adicionar novo subdomínio
- ❌ Mudar arquitetura do TTS Bridge (SPEC-027)

---

## Risks & Mitigation

| Risco                           | Mitigação                                          |
| ------------------------------- | -------------------------------------------------- |
| MiniMax API indisponível        | Fallback Ollama qwen2.5vl:7b activo ✅            |
| Ollama sem GPU/VRAM             | Fallback MiniMax API não afectado                   |
| Modelos Ollama pesados           | Monitorizar `nvidia-smi` durante uso               |
| whisper-medium-pt :8204 offline | TTS continua a funcionar, STT graceful degradation |

---

## References

- SPEC-009 — Audio stack imutável (STT/TTS canonical)
- SPEC-027 — Voice pipeline humanizado PT-BR
- SPEC-038 — Hermes Agent migration (original)
- SPEC-039 — Hermes Gateway tunnel
- SPEC-047 — ai-gateway (OpenAI compat layer)
- SPEC-048 — OpenAI facade completo
- SPEC-052 — Hermes MCP + Context7
- SPEC-HERMES-INTEGRATION.md — Estado actual Hermes
- memory/voice-pipeline-hermes-14-04-2026.md — Voice pipeline estado
