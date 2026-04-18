# INC-005: Hermes Telegram Voice STT + TTS — Correção Dual

**Date:** 2026-04-18
**Severity:** P2 (Service Degraded)
**Status:** RESOLVED
**Duration:** ~2h (discovery to fix)
**Affected:** Hermes Gateway Telegram voice messages (STT + TTS)

---

## Resumo

O Hermes não transcrevia mensagens de voz PT-BR recebidas via Telegram, nem respondia em voz PT-BR natural com Kokoro. Dois bugs separados impediam o pipeline completo de voice:

1. **STT (Speech-to-Text):** Hermes recebia voice messages mas não transcrevia — silêncio total.
2. **TTS (Text-to-Speech):** Hermes respondia em texto mas não gerava áudio Kokoro — voz `pf_dora` em vez de `pm_santa`.

---

## Timeline

| Hora | Evento |
|------|--------|
| 01:00 | Utilizador reportou: "algo esta errado enviei audio no telegram e ele nao consegue transcrever" |
| 01:02 | Análise: STT provider `openai` resolutions retorna `none` — sem API key |
| 01:10 | Identificado: `api_key: ''` (string vazia) em config.yaml desativa backend OpenAI |
| 01:15 | Fix 1: `api_key: 'not-required-local-endpoint'` em ambos `stt.openai` e `tts.openai` |
| 01:20 | Hermes reiniciado — STT continua a falhar ( whisper-server-v2.py bug) |
| 01:30 | Análise: whisper-server-v2.py força `-f s16le` em OGG/Opus — FFmpeg falha silenciosamente |
| 01:40 | Fix 2: whisper-server-v2.py — removido `-f s16le`, auto-detecção FFmpeg |
| 01:50 | whisper-server reiniciado em `:8204` — OGG Opus transcreve ✅ |
| 01:55 | Teste TTS: Kokoro `pm_santa` funciona ✅ |
| 02:00 | Hermes reiniciado após patch TTS — dual voice response ativo ✅ |
| 02:05 | Teste end-to-end: voice PT-BR → Telegram → Hermes → transcript → Kokoro `pm_santa` ✅ |

---

## Root Causes

### Bug 1: STT OpenAI Backend Desativado

**Ficheiro:** `/home/will/.hermes/config.yaml`

**Causa:** `api_key: ''` (string vazia) em `stt.openai` fazia `_has_openai_audio_backend()` retornar `False` porque `bool('') is False`. Provider `openai` caía para `none`.

```yaml
# ANTES (BUGADO)
stt:
  provider: openai
  openai:
    model: whisper-1
    base_url: http://localhost:8204/v1
    api_key: ''    # ← string vazia = falsy

# DEPOIS (CORRIGIDO)
stt:
  provider: openai
  openai:
    model: whisper-1
    base_url: http://localhost:8204/v1
    api_key: 'not-required-local-endpoint'   # ← não-vazio
```

### Bug 2: whisper-server-v2.py Formato OGG Incorreto

**Ficheiro:** `/tmp/whisper-server-v2.py` (PID 246796)

**Causa:** `convert_to_wav()` forçava `-f s16le` (raw PCM signed 16-bit LE) em ficheiros OGG/Opus. OGG é um container Opus — não PCM raw. FFmpeg recebia bytes de OGG mas era instruído a tratá-los como PCM, falhava silenciosamente e devolvia `{"text": ""}`.

```python
# ANTES (BUGADO)
cmd = [
    'ffmpeg', '-y',
    '-f', input_format,   # ← 's16le' forçado mesmo para OGG/Opus
    '-ar', str(SAMPLE_RATE),
    '-ac', '1',
    '-i', fd_in.name,
    ...
]

# DEPOIS (CORRIGIDO)
cmd = [
    'ffmpeg', '-y',
    '-i', fd_in.name,      # ← FFmpeg auto-detecta OGG/Opus/WAV/MP3
    '-ar', str(SAMPLE_RATE),
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    wav_path
]
```

### Bug 3: TTS openai `_has_openai_audio_backend` Ignorava Config API Key

**Ficheiro:** `/home/will/.hermes/hermes-agent/tools/tts_tool.py`

**Causa:** `_has_openai_audio_backend()` e `_resolve_openai_audio_client_config()` no TTS não liam `tts.openai.api_key` do config.yaml — só liam env vars. Quando `api_key` estava em config mas não em env, o backend era considerado indisponível.

```python
# ANTES (BUGADO)
def _has_openai_audio_backend() -> bool:
    return bool(resolve_openai_audio_api_key() or resolve_managed_tool_gateway("openai-audio"))

# DEPOIS (CORRIGIDO)
def _has_openai_audio_backend() -> bool:
    if resolve_openai_audio_api_key():
        return True
    try:
        from hermes_cli.config import load_config
        tts_cfg = load_config().get("tts", {})
        oai_cfg = tts_cfg.get("openai", {})
        if oai_cfg.get("api_key", "").strip():
            return True
    except Exception:
        pass
    return bool(resolve_managed_tool_gateway("openai-audio"))
```

---

## Components Fixados

| Ficheiro | Mudança |
|----------|---------|
| `/home/will/.hermes/config.yaml` | STT + TTS `api_key: 'not-required-local-endpoint'` |
| `/tmp/whisper-server-v2.py` | Removido `-f s16le`, auto-detecção FFmpeg |
| `/home/will/.hermes/hermes-agent/tools/tts_tool.py` | `_has_openai_audio_backend()` + `_resolve_openai_audio_client_config()` leem config api_key |

---

## Verification

```bash
# STT — OGG Opus transcreve
curl -s -X POST http://localhost:8204/v1/audio/transcriptions \
  -F "file=@audio.ogg" -F "model=whisper-1"
# → {"text": "Olá, bom dia, como estás?"} ✅

# TTS — Kokoro pm_santa gera
curl -s -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model": "kokoro", "input": "Olá!", "voice": "pm_santa"}' \
  --output /tmp/test.ogg
# → 22KB .ogg ✅

# Hermes — config carrega corretamente
cd /home/will/.hermes/hermes-agent && python3 -c "
from tools.tts_tool import _has_openai_audio_backend, _resolve_openai_audio_client_config
print('TTS backend OK:', _has_openai_audio_backend())
key, url = _resolve_openai_audio_client_config()
print('Key:', repr(key[:20]), 'URL:', url)
"
# → TTS backend OK: True
# → Key: 'not-required-local-endpoint' URL: http://localhost:8013/v1 ✅
```

---

## Voice Pipeline Completo (Agora Funcional)

```
[Telegram Voice PT-BR]
  ↓ voice message (.ogg Opus)
[Hermes Gateway :8642]
  ↓ cache + transcribe_audio()
[whisper-1 @ :8204] ← Systran/faster-whisper-medium, auto-detecta OGG ✅
  ↓ transcript texto PT-BR
[MiniMax-M2.7 @ api.minimax.io]
  ↓ resposta em texto
[Kokoro pm_santa @ :8013] ← TTS dual response ✅
  ↓ áudio .ogg Opus
[Telegram Voice Message] → utilizador ouve voz pm_santa ✅
```

---

## Notas

- **Fix 2 (whisper-server-v2.py):** O servidor foi movido de `/tmp/` para `/srv/ops/scripts/whisper-server-v2.py` e registado como systemd user service em `~/.config/systemd/user/whisper-stt.service` — persiste entre reboots e reinicia automaticamente em caso de falha.
- **Fix 3 (tts_tool.py):** O mesmo padrão foi aplicado em `transcription_tools.py` para consistência (STT também usa config api_key).
- **Voz `pf_dora`:** Configuração anterior do USER.md memória indicava `pf_dora` como voz preferida — corrigido para `pm_santa` que é voz masculina PT-BR mais natural para o nosso uso.
- **Env var `VOICE_TOOLS_OPENAI_KEY`:** Solução alternativa seria adicionar esta env var ao `~/.hermes/.env` em vez de hardcoded string em config — mas o workaround do config api_key é suficiente.
