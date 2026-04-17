# SPEC-057: Hermes Multimodal PT-BR MinIMax Token Plan Polish

**Date:** 2026-04-16
**Author:** Principal Engineer
**Status:** PROPOSED
**Type:** Engineering Excellence
**Branch:** feature/swift-kernel-1776284093

---

## Objective

Polimento enterprise do stack Hermes Agent multimodal PT-BR, estabelecendo MinIMax como plano primário de token/uso, com Ollama GPU como fallback local. Executar via workflow de 14 agentes + spec + pg + cursor-loop.

---

## Background

Stack atual:

- **STT:** faster-whisper-medium-pt @ :8204
- **TTS:** Kokoro @ :8880 via TTS Bridge @ :8013
- **LLM PRIMÁRIO:** qwen2.5vl:7b via Ollama :11434 (RTX 4090)
- **Vision:** qwen2.5vl:7b via Ollama :11434
- **MinIMax:** .env ACTIVE (contradiz SPEC-053 "emergência apenas")

### Problemas Identificados

| #   | Severity      | Problema                                                                   | Local                                  |
| --- | ------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| 1   | 🔴 Critical   | MinIMax API key ACTIVE em .env, contradiz SPEC-053                         | .env                                   |
| 2   | 🔴 Critical   | AGENTS.md lista MinIMax como primary LLM (errado)                          | AGENTS.md                              |
| 3   | 🟡 Important  | SUBDOMAINS.md: hermes.zappro.site → :4002 (deveria ser :4002 sim, T400 OK) | docs/INFRASTRUCTURE/SUBDOMAINS.md      |
| 4   | 🟡 Important  | PINNED-SERVICES.md drift: "Hermes Agent deprecated" ambiguoso              | docs/GOVERNANCE/PINNED-SERVICES.md:250 |
| 5   | 🟡 Important  | apps/list-web/tools.js:17 hardcoded `10.0.2.4:4001` (porta errada)         | apps/list-web/tools.js                 |
| 6   | 🔵 Suggestion | smoke-multimodal-stack.sh:135 expectativa errada Hermes STT                | smoke-tests/smoke-multimodal-stack.sh  |
| 7   | 🔵 Suggestion | Scripts deprecated OpenClaw ainda existem                                  | tasks/smoke-tests/pipeline-\*.sh       |

---

## Tech Stack — Canonical 2026

### LLM Tiering (CORRIGIDO)

| Tier          | Model                       | Provider              | Use Case                      |
| ------------- | --------------------------- | --------------------- | ----------------------------- |
| **PRIMARY**   | qwen2.5vl:7b                | Ollama (RTX 4090)     | Texto + Visão + Voice         |
| **FALLBACK**  | llama3-portuguese-tomcat-8b | Ollama                | Texto fallback                |
| **EMERGENCY** | MinIMax M2.7                | API (MINIMAX_API_KEY) | Apenas emergências (SPEC-053) |

### Multimodal Stack

```
STT  → faster-whisper-medium-pt (:8204) → OpenAI whisper-1 compat
TTS  → Kokoro (:8880) + TTS Bridge (:8013) → OpenAI tts-1 compat
Vision → qwen2.5vl:7b (:11434) → llava-phi3 fallback
LLM  → qwen2.5vl:7b (:11434) → MiniMax M2.7 fallback
MCP  → Hermes :8092
```

---

## 14 Agents Research (já em execução)

1. Hermes Agent use cases Linux
2. Hermes Agent multimodal PT-BR integration
3. MinIMax token optimization strategies
4. LLM agent self-improvement patterns
5. LLM agent systemd bare-metal deployment
6. LLM agent Telegram/Discord integration
7. LLM agent skills/tool creation
8. LLM agent context window management
9. LLM agent vision capabilities
10. LLM agent observability/monitoring
11. LLM agent MCP protocol
12. LLM agent security hardening
13. LLM agent voice pipeline STT/TTS
14. LLM agent web search/research

---

## Tasks

###must

- [ ] **T1:** Corrigir .env — MinIMax API key como EMERGENCY_ONLY (comentar por padrão)
- [ ] **T2:** Corrigir AGENTS.md — remover MinIMax como primary LLM
- [ ] **T3:** Corrigir PINNED-SERVICES.md — clarificar "Hermes Agent deprecated" (manter :8642)
- [ ] **T4:** Corrigir apps/list-web/tools.js — porta 4001 → 8642

###should

- [ ] **T5:** Executar /pg para gerar pipeline.json a partir de SPECs pendentes
- [ ] **T6:** Executar /cursor-loop para workflow enterprise
- [ ] **T7:** Verificar smoke test Hermes Agent (Telegram polling)
- [ ] **T8:** Verificar integrations MCP (:8092) com Claude Code

###could

- [ ] **T9:** Adicionar Telegram smoke test a pipeline
- [ ] **T10:** Polir observabilidade Hermes (logs, métricas)

---

## Acceptance Criteria

1. .env tem MinIMax API key comentada com label EMERGENCY_ONLY
2. AGENTS.md mostra Ollama qwen2.5vl:7b como PRIMARY, MinIMax como EMERGENCY
3. hermes.zappro.site responde :4002 (ai-gateway) com /health → 200
4. smoke-multimodal-stack.sh passa 13/13
5. Hermes Agent Telegram polling funcional
6. 14 agents research concluídos e findings documentados

---

## Files to Change

| File                                           | Change                                                    |
| ---------------------------------------------- | --------------------------------------------------------- |
| `.env`                                         | Comentar MINIMAX_API_KEY com label EMERGENCY_ONLY         |
| `AGENTS.md`                                    | Remover MinIMax como primary; documentar tiering correto  |
| `docs/GOVERNANCE/PINNED-SERVICES.md`           | Clarificar "deprecated" → "legacy bot.zappro.site PRUNED" |
| `apps/list-web/tools.js`                       | 4001 → 8642                                               |
| `docs/INFRASTRUCTURE/SUBDOMAINS.md`            | Verificar T400 routing                                    |
| `smoke-tests/smoke-multimodal-stack.sh`        | Corrigir expectativa Hermes STT                           |
| `tasks/smoke-tests/pipeline-openclaw-voice.sh` | DELETE (deprecated)                                       |
| `tasks/smoke-tests/voice-pipeline-loop.sh`     | DELETE (deprecated)                                       |

---

## Success Metrics

- Zero drift entre SPEC-053, .env, e AGENTS.md sobre MinIMax role
- Hermes Agent :8642 + :8092 ambos healthy
- Telegram bot polling ativo
- 14/14 agents research completos
- Pipeline enterprise executado via /cursor-loop
