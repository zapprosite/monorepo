# Voice Pipeline Desktop — Smoke Test & Gap Analysis

**Data:** 2026-04-10
**Diretório:** `/home/will/Desktop/voice-pipeline`
**Governance ref:** `docs/OPERATIONS/SKILLS/openclaw-agents-kit/`

---

## Smoke Test — 2026-04-10

### Services

| Serviço | Porta | Status | Tipo |
|---------|-------|--------|------|
| Kokoro TTS | `:8012` | ✅ UP | Docker (`zappro-kokoro`) |
| Whisper API (native) | `:8201` | ✅ UP | Python process |
| Ollama | `:11434` | ✅ UP | Native |
| wav2vec2-proxy | — | ✅ UP | Docker |
| OpenClaw | `:8080` | ✅ UP | Docker |

### Modelos Disponíveis (Ollama)

```
llama3-portuguese-tomcat-8b-instruct-q8:latest  ← LLM PT-BR
qwen2.5vl:7b                                    ← Vision
nomic-embed-text:latest                          ← Embeddings
```

### Scripts

| Script | Estado | Função |
|--------|--------|--------|
| `speak.sh` | ✅ OK | Ctrl+Shift+C → Kokoro direto |
| `voice.sh` | ✅ OK | STT → LLM PT-BR → clipboard |
| `voice-toggle.sh` | ✅ OK | Toggle gravação (clique) |
| `record.sh` | ✅ OK | Grava ENTER→parar→processa |

### Hotkeys

| Binding | Comando | Estado |
|---------|---------|--------|
| `Ctrl+Shift+C` | `speak.sh` | ✅ OK |
| `F12` | `record.sh` | ✅ OK (hotkey-restore.sh no autostart) |

---

## Gaps Identificadas

### 1. F12 Hotkey Não Persiste ❌

**Problema:** O hotkey F12 desaparece após configuração. GNOME settings daemon reseta.

**Workaround:** Recriar binding sempre que necessário:
```bash
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/voice-f9/ binding "'F12'"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/voice-f9/ command "'/home/will/Desktop/voice-pipeline/scripts/record.sh'"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/voice-f9/ name "'Voice Record (F12)'"
```

**Fix necessário:** Investigar o que está a resetar os custom-keybindings do GNOME.

### 2. whisper_api.py Corre Nativamente, Não em Docker

**Observação:** O `whisper_api.py` corre como processo Python nativo (:8201), não em container Docker.Está a usar VRAM: **1140 MiB**

### 3. GPU VRAM Usage

```
python3 (whisper_api.py): 1140 MiB
python3 (ollama):           2526 MiB
ollama server:            12474 MiB
Total GPU:                19118 / 24564 MiB
```

### 4. Ícone Desktop Não Atualiza

**Problema:** Ícone PNG novo não aparece na dock do GNOME após `Alt+F2→r`.

**Solução:** Requer logout/login para ver ícone `voice-pipeline-on-128.png`.

---

## Modelo LLM — Troca Obrigatória

> ⚠️ **GOVERNANCE RULE:** Quando o modelo LLM PT-BR for alterado em qualquer lugar do homelab, esta configuração **OBRIGATORIAMENTE** deve ser atualizada.

### Ficheiros que Referenciam o Modelo

| Ficheiro | Modelo Atual | Linha |
|----------|-------------|-------|
| `voice.sh` | `llama3-portuguese-tomcat-8b-instruct-q8` | 89 |
| `speak.sh` | (não usa LLM — Kokoro direto) | — |

### Para Trocar Modelo

1. Editar `voice.sh` linha 89:
```bash
"model": "llama3-portuguese-tomcat-8b-instruct-q8",  # trocar aqui
```

2. Verificar se modelo está disponível:
```bash
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

3. Testar:
```bash
bash /home/will/Desktop/voice-pipeline/scripts/voice.sh /tmp/test_audio.wav
```

---

## Fluxo Completo

```
MODO 1 — Texto para Fala:
  Selecionar texto → Ctrl+Shift+C → Kokoro pm_santa → headset

MODO 2 — Voz para Texto:
  Clique ícone → gravar → clique → para →
  whisper (STT) → llama3-ptbr (corrige) → clipboard →
  Ctrl+Shift+V cola

MODO 3 — F12:
  Prima F12 → ENTER → fala → ENTER → processa → Ctrl+Shift+V cola
```

---

## Startup Ubuntu — Persistência

### O que inicia automaticamente:

1. **Ollama** — systemd ou startup manual
2. **whisper_api.py** — via `start-whisper-api.sh` (chamado por voice-toggle.sh)
3. **Kokoro** — container Docker `zappro-kokoro` (chamado por voice-toggle.sh)
4. **Hotkeys** — GNOME settings daemon (volátil — não persiste após reboot)

### Hotkey Restore — Autostart

O script `hotkey-restore.sh` é chamado automaticamente via:
- `~/.config/autostart/voice-hotkeys-restore.desktop`

Isto garante que após reboot, os hotkeys são restaurados automaticamente.

### Para persistir hotkeys manualmente:

O GNOME guarda hotkeys em dconf. Para persistir:
```bash
# Exportar
dconf dump /org/gnome/settings-daemon/plugins/media-keys/ > hotkeys.ini

# Importar após reboot
dconf load /org/gnome/settings-daemon/plugins/media-keys/ < hotkeys.ini
```

### Containers Docker — Auto-start:

Os containers Kokoro e OpenClaw têm restart policy configurada no Docker Compose.

---

## Notas

- `speak.sh` usa `xclip -selection primary` para texto selecionado (não clipboard)
- Kokoro está em :8012 (não :8013 que é o TTS Bridge com filtro de vozes)
- voz→texto usa `whisper_api.py` nativo (não container) por performance GPU
