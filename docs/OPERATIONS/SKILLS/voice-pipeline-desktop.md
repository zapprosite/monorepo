# Voice Pipeline Desktop — Skill

**Host:** Ubuntu Desktop (will-zappro)
**Date:** 2026-04-10
**Ref:** `/home/will/Desktop/`

---

## ⚠️ GOVERNANCE — LLM Model Swap Rule

> Quando qualquer modelo LLM for alterado no homelab (Ollama, LiteLLM, GPU), **OBRIGATORIAMENTE** esta configuração deve ser atualizada.

### Modelos em Uso

| Ficheiro | Modelo | Porta | Uso |
|----------|--------|-------|-----|
| `voice.sh` | `llama3-portuguese-tomcat-8b-instruct-q8` | `:11434` | Correção PT-BR |
| `speak.sh` | `llama3-portuguese-tomcat-8b-instruct-q8` | `:11434` | Humanização TTS PT-BR |

### Voz TTS

- **Voz:** `pf_dora` (feminina PT-BR) — `:8012`
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

1. Editar `/home/will/Desktop//scripts/voice.sh` — linha do payload:
```bash
"model": "llama3-portuguese-tomcat-8b-instruct-q8",  # trocar aqui
```

2. Editar `/home/will/Desktop//scripts/speak.sh` — linha do payload:
```bash
"model": "llama3-portuguese-tomcat-8b-instruct-q8",  # trocar aqui
```

3. Testar:
```bash
bash /home/will/Desktop//scripts/voice.sh /tmp/test_audio.wav
```

---

## Hotkeys

| Tecla | Script | Função |
|-------|--------|--------|
| **F12** | `record.sh` | Gravar voz → transcreve → Ctrl+Shift+V cola |
| **Ctrl+Shift+C** | `speak.sh` | Texto selecionado → LLM humaniza → `pf_dora` → headset |
| **Ícone** | `voice-toggle.sh` | Clique toggle gravação |

### Hotkey Restore

Os hotkeys são restaurados via autostart:
- Ficheiro: `~/.config/autostart/voice-hotkeys-restore.desktop`
- Script: `/home/will/Desktop//scripts/hotkey-restore.sh`

Se hotkeys desaparecerem após reboot, executar:
```bash
bash /home/will/Desktop//scripts/hotkey-restore.sh
```

### Ubuntu Dock — Pinned

O Voice Pipeline está pinned no Ubuntu Dock (GNOME) via:
- Ficheiro: `~/.local/share/applications/.desktop`
- Entrada GNOME: `org.gnome.shell favorite-apps`

---

## Services

| Serviço | Porta | Tipo | Container |
|--------|-------|------|-----------|
| | `:8012` | HTTP | `zappro-` |
| Whisper API | `:8201` | HTTP | Native (`whisper_api.py`) |
| Ollama | `:11434` | HTTP | Native |

---

## Smoke Test

```bash
cd /home/will/Desktop/
bash tasks/smoke-tests/2e-telegram.sh
```

---

## Logs

- Speak: `~/Desktop//logs/speak-YYYYMMDD.log`
- Voice: `~/Desktop//logs/voice-YYYYMMDD.log`
- Toggle: `~/Desktop//logs/toggle-YYYYMMDD.log`

---

## Troubleshooting

### F12 não funciona
```bash
bash /home/will/Desktop//scripts/hotkey-restore.sh
```

### 
```bash
curl -s http://localhost:8012/health
docker restart zappro-
```

### Whisper API não responde
```bash
curl -s http://localhost:8201/health
pkill -f whisper_api.py
nohup python3 ~/Desktop//whisper_api.py &
```
