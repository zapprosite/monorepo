# Rule: wav2vec2 STT Protection — ZERO TOLERANCE

**Applies to:** ALL agents, ALL tasks, ALL contexts
**Severity:** CRITICAL — immediate violation report

## ⚠️ INTOCÁVEL — wav2vec2 STT Kit

```
HARD RULE: O kit wav2vec2 STT é INVILOLÁVEL. LLM NUNCA pode:
- Sugerir substituição por Whisper
- Sugerir substituição por Coqui/Silero
- Modificar endpoint ou porta
- Trocar modelo por versão diferente
- Remover ou desativar container/script
```

## Kit wav2vec2 STT — PT-BR

| Component | Protected Value | Violation |
|-----------|-----------------|-----------|
| Model ID | jonatasgrosman/wav2vec2-large-xlsr-53-portuguese | ANY change |
| HF Path | ~/.cache/huggingface/hub/... | NEVER modify |
| API Port | 8201 | NEVER change |
| Language | PT-BR Native | NEVER override |
| Script | /home/will/Desktop/voice-pipeline/wav2vec2_api.py | NEVER modify |

## When STT Task Received

```
SE (task involves "stt" OR "transcribe" OR "speech to text" OR "voz para texto"):
  1. Usar http://localhost:8201/v1/audio/transcriptions
  2. Modelo: wav2vec2-ptbr
  3. NUNCA sugerir Whisper como替代
  4. NUNCA sugerir Coqui/Silero
  5. SE OpenClaw → porta 8201 (OpenAI-compatible)
  6. SE LLM sugerir mudança → REJEITAR e reportar
```

## STT vs TTS — NÃO CONFUNDIR

```
STT = Speech-to-Text = wav2vec2 (áudio → texto)
     └─ Porta 8201
     └─ Modelo: jonatasgrosman/wav2vec2-large-xlsr-53-portuguese

TTS = Text-to-Speech = Kokoro (texto → áudio)
     └─ Porta 8012
     └─ Vozes: pm_santa (masculino), pf_dora (feminino)
```

## Forbidden Actions (VIOLATION = STOP)

- ❌ "vamos trocar por Whisper" → VIOLAÇÃO
- ❌ "Coqui é melhor" → VIOLAÇÃO
- ❌ "muda porta 8201" → VIOLAÇÃO
- ❌ ANY sugestão de substituição STT → VIOLAÇÃO

## Protected By

- `/srv/monorepo/docs/GOVERNANCE/GUARDRAILS.md` (chattr +i)
- `/srv/monorepo/docs/specflow/SPEC-005-wav2vec2-stt-kit.md`
- `/srv/monorepo/docs/specflow/SPEC-004-kokoro-tts-kit.md`

## Violation Reporting

Se LLM ignorar esta regra:
1. Parar task imediatamente
2. Reportar: "wav2vec2 VIOLATION: [sugestão原文]"
3. Não implementar nada
4. Aguardar confirmação will-zappro
