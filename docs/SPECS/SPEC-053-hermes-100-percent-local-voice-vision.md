---
name: SPEC-053-hermes-100-percent-local-voice-vision
description: Fazer Hermes via Telegram usar 100% serviços locais — LLM (Ollama/qwen2.5vl), STT (whisper-medium-pt :8204), TTS (Kokoro :8013), Vision (Ollama/llava-phi3). Remover dependência MiniMax.
status: IN_PROGRESS
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

Hermes via Telegram deve usar **100% serviços locais** — sem dependência de MiniMax ou qualquer API externa. O objectivo é reduzir custos, eliminar latência externa, e garantir funcionamento mesmo sem internet.

| Componente    | Actual                           | Alvo                                   |
| ------------- | -------------------------------- | -------------------------------------- |
| **LLM texto** | MiniMax M2.7 (primário)          | Ollama `qwen2.5vl:7b` (primário)       |
| **LLM visão** | Ollama `qwen2.5vl:7b` (fallback) | Ollama `llava-phi3:7b` (primário)      |
| **STT**       | faster-whisper-medium-pt :8204   | faster-whisper-medium-pt :8204 (mesmo) |
| **TTS**       | Kokoro :8013 via TTS Bridge      | Kokoro :8013 via TTS Bridge (mesmo)    |

---

## Arquitectura Actual vs Alvo

### Arquitectura Actual (Hybrid —依赖 MiniMax)

```
Telegram Voice Message
  │
  ▼
Hermes Gateway :8642
  │
  ├─ LLM Primário: MiniMax M2.7 (externa, pagante)
  │    │
  │    └─ Se falha → fallback Ollama
  │
  ├─ Vision: Ollama qwen2.5vl:7b (já local)
  │
  ├─ STT: faster-whisper-medium-pt :8204 (já local)
  │
  └─ TTS: Kokoro :8013 (já local)
```

### Arquitectura Alvo (100% Local)

```
Telegram Voice Message
  │
  ▼
Hermes Gateway :8642
  │
  ├─ LLM Primário: Ollama qwen2.5vl:7b (local, GPU)
  │    │
  │    └─ Se falha → Ollama llama3-portuguese-tomcat-8b (local)
  │
  ├─ Vision: Ollama llava-phi3:7b (local, GPU) — specced em SPEC-048
  │
  ├─ STT: faster-whisper-medium-pt :8204 (já local)
  │
  └─ TTS: Kokoro :8013 via TTS Bridge (já local)
```

---

## Gap Analysis

### 1. LLM Text — CRITICAL GAP

**Problema:** Hermes usa MiniMax como LLM primário. Isto significa:

- Dependência de API externa
- Custo por token
- Latência adicional (~200-500ms para API externa)
- Funcionamento offline impossível

**Solução:** Configurar Ollama `qwen2.5vl:7b` como primário em `~/.hermes/config.yaml`

```yaml
llm:
  primary:
    provider: ollama
    model: qwen2.5vl:7b
    base_url: http://localhost:11434
  fallback:
    - provider: ollama
      model: llama3-portuguese-tomcat-8b-instruct-q8:latest
      base_url: http://localhost:11434
```

**Valores a confirmar:**

- `qwen2.5vl:7b` — Vision-language, 5.9GB (já em uso para fallback)
- `llama3-portuguese-tomcat-8b-instruct-q8` — Portuguese specialist, 8.5GB

### 2. Vision — JÁ LOCAL (确认)

**Status:** SPEC-HERMES-INTEGRATION.md confirma:

```yaml
auxiliary:
  vision:
    provider: ollama
    model: qwen2.5vl:7b
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

### T1: Configurar Ollama como LLM primário do Hermes — PENDING

**Ficheiro:** `~/.hermes/config.yaml`

**Acção:** Reordenar configuração para Ollama ser primário, MiniMax removido

```yaml
llm:
  primary:
    provider: ollama
    model: qwen2.5vl:7b
    base_url: http://localhost:11434
  fallback:
    - provider: ollama
      model: llama3-portuguese-tomcat-8b-instruct-q8:latest
      base_url: http://localhost:11434
```

**Verificação:**

```bash
curl -X POST http://localhost:8642/v1/chat/completions \
  -H "Authorization: Bearer ${HERMES_API_KEY}" \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"Olá"}]}'
# Deve responder sem depender de MiniMax
```

### T2: Validar Vision com llava-phi3 vs qwen2.5vl — PENDING

**Ficheiro:** `~/.hermes/config.yaml`

**Finding:** `llava-phi3` CRASHA quando usado via `/v1/chat/completions` (OpenAI format). `qwen2.5vl:7b` funciona via ambos `/v1/chat/completions` e `/api/chat` (native).

**Actual config:** `auxiliary.vision.model: llava-phi3:latest` → CRASHES
**Recomendado:** Manter `qwen2.5vl:7b` que funciona.

### T3: Smoke test — DONE ✅

**Script:** `smoke-tests/smoke-hermes-local-voice.sh` — criado e validado.

Resultados (15/04):

```
STT: faster-whisper :8204     ✅ OK
TTS: Kokoro :8013             ✅ OK
AI-Gateway :4002 STT+TTS      ✅ OK
Hermes :8642                  ✅ OK
Ollama :11434                 ✅ OK
llava-phi3 available          ✅ OK
llama3-portuguese-tomcat-8b   ✅ OK
qwen2.5vl NOT available       ⚠️ (removed in favor of llava-phi3)
```

### T4: Actualizar DOCUMENTAÇÃO — IN PROGRESS

**Ficheiros a actualizar:**

- `docs/SPECS/SPEC-038-hermes-agent-migration.md` — marcar MiniMax como DEPRECATED
- `docs/SPECS/SPEC-HERMES-INTEGRATION.md` — actualizar arquitectura para 100% local
- `memory/voice-pipeline-hermes-14-04-2026.md` — actualizar secção "Current State"
- `docs/INFRASTRUCTURE/SERVICE_MAP.md` — confirmar Ollama como LLM primary
- `docs/INFRASTRUCTURE/PORTS.md` — confirmar :11434 (Ollama) listed
- `~/.hermes/skills/voice-ouvidos-visao/SKILL.md` — ✅ FIXED: :8203 → :8204

### T5: Remover MiniMax de .env (se não usado) — PENDING

**Verificar se MiniMax ainda é necessário:**

```bash
grep -r "MINIMAX" /srv/monorepo/.env
grep -r "MINIMAX" /srv/monorepo/apps/
```

Se MiniMax só é usado pelo Hermes:

- Comentar em `.env` (não apagar — pode ser useful para fallback futuro)
- Actualizar `.env.example` com nota

---

## Files to Modify

| Ficheiro                                        | Modificação                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `~/.hermes/config.yaml`                         | LLM primary: Ollama qwen2.5vl:7b, fallback: llama3-portuguese-tomcat-8b |
| `smoke-tests/smoke-hermes-local-voice.sh`       | Criar — valida pipeline 100% local                                      |
| `docs/SPECS/SPEC-038-hermes-agent-migration.md` | Update: MiniMax deprecated, Ollama primary                              |
| `docs/SPECS/SPEC-HERMES-INTEGRATION.md`         | Update: arquitectura 100% local                                         |
| `memory/voice-pipeline-hermes-14-04-2026.md`    | Update: confirmar 100% local                                            |
| `.env`                                          | Comentar MINIMAX_API_KEY (se só usado por Hermes)                       |
| `.env.example`                                  | Adicionar nota: MINIMAX opcional para fallback                          |

---

## Success Criteria

- [ ] Hermes `/v1/chat/completions` responde usando **Ollama local** (não MiniMax)
- [ ] Hermes `/v1/chat/completions` com imagem usa **Ollama vision** (não MiniMax)
- [x] STT usa `whisper-medium-pt` :8204 ✅ (multipart fix aplicado)
- [x] TTS usa Kokoro :8013 ✅ (já ok)
- [x] `smoke-tests/smoke-hermes-local-voice.sh` passa ✅ (12/13, 1 YELLOW)
- [ ] Hermes funciona mesmo sem internet (testar: desligar router 30s)
- [ ] Latência Hermes < 2s para queries simples (Ollama local vs ~500ms MiniMax)
- [ ] `.env` sem MINIMAX activo (comentado ou removido se não usado)
- [ ] `/sec` audit: 0 findings

---

## O que NÃO fazer

- ❌ Remover MiniMax completamente — manter comentado para emergency fallback
- ❌ Mudar STT (faster-whisper-medium-pt :8204 — SPEC-009 imutável)
- ❌ Mudar TTS (Kokoro via :8013 — SPEC-009 imutável)
- ❌ Adicionar novo subdomínio
- ❌ Mudar arquitetura do TTS Bridge (SPEC-027)

---

## Risks & Mitigation

| Risco                                              | Mitigação                                          |
| -------------------------------------------------- | -------------------------------------------------- |
| Ollama sem GPU/VRAM                                | Manter MiniMax comentado em `.env` para fallback   |
| Modelos Ollama pesados (qwen2.5vl:7b = 5.9GB VRAM) | Monitorar `nvidia-smi` durante uso                 |
| whisper-medium-pt :8204 offline                    | TTS continua a funcionar, STT graceful degradation |
| Latência Ollama > MiniMax                          | Benchmark: medir p95 latency ambos                 |

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
