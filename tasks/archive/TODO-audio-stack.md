# TODO: Audio Stack Integration Tasks

**Data:** 08/04/2026
**Parent Plan:** PLAN-audio-stack-integration.md

---

## STATUS FINAL 08/04/2026 - ✅ CONCLUÍDO

### Arquitetura Implementada:
```
TTS: OpenClaw → LiteLLM :4000 → Kokoro :8880 ✅
STT: OpenClaw → wav2vec2 :8201 DIRETO ✅ (sem LiteLLM)
Vision: OpenClaw → LiteLLM :4000 → Qwen2.5-VL 7B ✅
LLM: OpenClaw → LiteLLM :4000 → Tom Cat 8B (importando...)
```

### LiteLLM Models (5 carregados):
| Modelo | Tipo | Status |
|--------|------|--------|
| tts-1 | Kokoro TTS | ✅ OK |
| whisper-1 | STT (wav2vec2 route) | ✅ OK |
| qwen2.5-vl | Vision | ✅ OK |
| tom-cat-8b | LLM PT-BR | 🔄 Importando |
| embedding-nomic | Embeddings | ✅ OK |

### VRAM (RTX 4090 - 24GB):
```
Kokoro TTS: ~0.5GB ✅
wav2vec2 STT: ~2GB ✅
Qwen2.5-VL: carregando...
Ollama models: ~5GB cada
Total estimado: ~12GB | Sobra: ~12GB
```

### Services:
- LiteLLM: `localhost:4000` ✅
- Kokoro: `10.0.2.4:8880` (Docker network) ✅
- wav2vec2: `localhost:8201` (host direto) ✅
- Ollama: `10.0.1.1:11434` ✅

---

## A FAZER:
- [x] Corrigir LiteLLM config (provider: openai para todos)
- [x] TTS Kokoro via LiteLLM ✅
- [x] STT wav2vec2 DIRETO (sem LiteLLM - mais rápido)
- [x] Qwen2.5-VL 7B ✅
- [ ] Importar Llama3 Portuguese Tom Cat 8B (em progresso)
- [ ] Atualizar OpenClaw providers.json
- [ ] Proteger SPEC-005 (wav2vec2 intocável)
