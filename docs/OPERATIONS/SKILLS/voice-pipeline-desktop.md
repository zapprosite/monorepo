# Voice Pipeline Desktop — Skill

**Host:** Ubuntu Desktop (homelab)
**Date:** 2026-04-10
**Ref:** `/home/will/Desktop/voice-pipeline`

---

## ⚠️ GOVERNANCE — LLM Model Swap Rule

> Quando qualquer modelo LLM for alterado no homelab (Ollama, LiteLLM, GPU), **OBRIGATORIAMENTE** esta configuração deve ser atualizada.

### Modelos em Uso

| Ficheiro   | Modelo          | Porta    | Uso                   |
| ---------- | --------------- | -------- | --------------------- |
| `voice.sh` | `Gemma4-12b-it` | `:11434` | Correção PT-BR        |
| `speak.sh` | `Gemma4-12b-it` | `:11434` | Humanização TTS PT-BR |

### Voz TTS

- **Voz:** `pf_dora` (feminina PT-BR) — Kokoro na porta `:8012`
- **Anterior:** `pm_santa` (masculina)

### Sintomas de Modelo Desatualizado

- STT transcreve mas correção falha
- Texto colado fica vazio ou em inglês
- Erro `model not found` no log
- TTS devolve texto vazio

### Verificar Modelo Atual

```bash
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

### Para Trocar Modelo

1. Editar `/home/will/Desktop/voice-pipeline/scripts/voice.sh` — linha do payload:

```bash
"model": "Gemma4-12b-it",  # trocar aqui
```

2. Editar `/home/will/Desktop/voice-pipeline/scripts/speak.sh` — linha do payload:

```bash
"model": "Gemma4-12b-it",  # trocar aqui
```

3. Testar:

```bash
bash /home/will/Desktop/voice-pipeline/scripts/voice.sh /tmp/test_audio.wav
```

---

## Hotkeys

| Tecla            | Script            | Função                                                        |
| ---------------- | ----------------- | ------------------------------------------------------------- |
| **F12**          | `record.sh`       | Gravar voz → transcreve → Ctrl+Shift+V cola                   |
| **Ctrl+Shift+C** | `speak.sh`        | Texto selecionado → LLM humaniza → Kokoro `pf_dora` → headset |
| **Ícone**        | `voice-toggle.sh` | Clique toggle gravação                                        |

### Hotkey Restore

Os hotkeys são restaurados via autostart:

- Ficheiro: `~/.config/autostart/voice-hotkeys-restore.desktop`
- Script: `/home/will/Desktop/voice-pipeline/scripts/hotkey-restore.sh`

Se hotkeys desaparecerem após reboot, executar:

```bash
bash /home/will/Desktop/voice-pipeline/scripts/hotkey-restore.sh
```

### Ubuntu Dock — Pinned

O Voice Pipeline está pinned no Ubuntu Dock (GNOME) via:

- Ficheiro: `~/.local/share/applications/voice-pipeline.desktop`
- Entrada GNOME: `org.gnome.shell favorite-apps`

---

## Services

| Serviço     | Porta    | Tipo | Container                 |
| ----------- | -------- | ---- | ------------------------- |
| Kokoro TTS  | `:8012`  | HTTP | `zappro-kokoro`           |
| Whisper API | `:8201`  | HTTP | Native (`whisper_api.py`) |
| Ollama      | `:11434` | HTTP | Native                    |

---

## Smoke Test

```bash
cd /home/will/Desktop/voice-pipeline
bash tasks/smoke-tests/voice-pipeline-e2e-telegram.sh
```

---

## Logs

- Speak: `~/Desktop/voice-pipeline/logs/speak-YYYYMMDD.log`
- Voice: `~/Desktop/voice-pipeline/logs/voice-YYYYMMDD.log`
- Toggle: `~/Desktop/voice-pipeline/logs/toggle-YYYYMMDD.log`

---

## Troubleshooting

### F12 não funciona

```bash
bash /home/will/Desktop/voice-pipeline/scripts/hotkey-restore.sh
```

### Kokoro não responde

```bash
curl -s http://localhost:8012/health
docker restart zappro-kokoro
```

### Whisper API não responde

```bash
curl -s http://localhost:8201/health
pkill -f whisper_api.py
nohup python3 ~/Desktop/voice-pipeline/whisper_api.py &
```
