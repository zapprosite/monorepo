# Voice Pipeline — F8 + F9

**Data:** 2026-04-06
**Status:** ✅ PRODUÇÃO
**Host:** will-zappro | Ubuntu Desktop LTS

---

## Visão Geral

Pipeline de voz 100% local — transcreve e corrige português.

**Fluxo F8 (rápido):**
```
F8 → ENTER → Grava → ENTER → Para → Transcreve → Ctrl+Shift+V
```

**Fluxo F9 (completo):**
```
F9 → ENTER → Grava → ENTER → Para → Transcreve → Gemma4 corrige → Ctrl+Shift+V
```

---

## Hotkeys

| Tecla | Script | Função |
|-------|--------|--------|
| **F8** | `jarvis-voice-command.sh` | Transcreve (rápido) |
| **F9** | `record.sh` → `voice.sh` | Transcreve + Gemma4 corrige |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      Ubuntu Desktop LTS                       │
│                                                              │
│  ┌──────────────┐     ┌─────────────────┐                   │
│  │  GNOME F8   │────▶│ jarvis-voice-   │                   │
│  │  GNOME F9   │────▶│ record.sh       │                   │
│  └──────────────┘     └────────┬────────┘                   │
│                                │                             │
│                                ▼                             │
│                     ┌─────────────────────┐                 │
│                     │ faster-whisper small │                 │
│                     │ GPU :8201            │                 │
│                     └────────┬────────────┘                   │
│                                │                             │
│              ┌────────────────┼────────────────┐           │
│              ▼                ▼                ▼           │
│       ┌────────────┐    ┌──────────┐    ┌──────────┐       │
│       │  xclip    │◀───│  Gemma4  │◀───│  Ollama  │       │
│       │ (clipboard)│    │ (correct)│    │ gemma4   │       │
│       └────────────┘    └──────────┘    └──────────┘       │
└─────────────────────────────────────────────────────────────┘

GPU: RTX 4090 (24GB) | VRAM: ~1GB Whisper + ~9GB Gemma4
```

---

## Componentes

| Componente | Arquivo | Status |
|-----------|---------|--------|
| **F8 hotkey** | `jarvis-voice-command.sh` | ✅ Pinned via systemd |
| **F9 hotkey** | `record.sh` + `voice.sh` | ✅ Pinned via systemd |
| **Whisper API** | `:8201` (host) | ✅ Running |
| **Gemma4** | Ollama `:11434` | ✅ gemma4:latest |
| **xclip** | host | ✅ Nativo |

---

## Como Usar

### F8 — Transcrição rápida
```bash
F8 → ENTER (inicia gravação) → ENTER (para) → Ctrl+Shift+V (cola)
```

### F9 — Correção completa
```bash
F9 → ENTER (inicia gravação) → ENTER (para) → Gemma4 corrige → Ctrl+Shift+V (cola)
```

---

## Smoke Test

```bash
# Verificar componentes
curl -s http://localhost:8201/health  # Whisper API
curl -s http://localhost:11434/api/tags | grep gemma4  # Gemma4
nvidia-smi --query-gpu=memory.free --format=csv,noheader  # VRAM

# Hotkeys
gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings
```

---

## Manter Pinned

### Systemd services (rebootproof)
```
~/.config/systemd/user/jarvis-hotkey.service  → F8
~/.config/systemd/user/voice-hotkey.service   → F9
```

### Verificar hotkeys
```bash
bash ~/Desktop/voice-pipeline/scripts/verify-hotkey.sh
```

### Recovery
```bash
systemctl --user restart jarvis-hotkey
systemctl --user restart voice-hotkey
```

---

## Referências

- **Scripts:** `~/Desktop/voice-pipeline/scripts/`
- **Logs:** `~/Desktop/voice-pipeline/logs/`
- **Governança:** `/srv/ops/ai-governance/GUARDRAILS.md`

**Mantenedor:** will-zappro
**Versão:** 3.0
**Última Atualização:** 2026-04-06
