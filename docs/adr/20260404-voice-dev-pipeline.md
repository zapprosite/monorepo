# ADR-012: Voice Dev Pipeline — Mute → Whisper → Gemma4 → Clipboard

**Data:** 2026-04-04
**Status:** Implementado
**Decisor:** will-zappro

## Contexto

O usuário precisava de uma forma rápida de dictar texto técnico em qualquer aplicação
sem sair do fluxo de trabalho. O terminal fechou durante tentativa de configurar
atalho de whisper, revelando que não havia pipeline funcional.

## Decisão

Implementar pipeline de voz completo com:

1. **Hotkey Mute** → GNOME custom keybinding (XF86AudioMute)
2. **STT Whisper** → faster-whisper small (GPU, ~1GB VRAM)
3. **Correção LLM** → gemma4:latest via Ollama local
4. **Clipboard** → xclip para colar em qualquer lugar

### Stack Anterior (removida)
- ~~Speaches STT~~ → Não funcionava bem
- ~~Chatterbox TTS~~ → VRAM-heavy (5GB), substituído por Kokoro
- ~~Groq Whisper~~ → API externa, agora local

### Stack Nova
```
arecord → whisper (GPU) → gemma4 (Ollama) → xclip → Ctrl+V
```

## Alternativas Consideradas

| Alternativa | Problema |
|-------------|----------|
| Groq Whisper API | Custo por minuto, dependência externa |
| OpenAI Whisper API | Idem + vendor lock |
| xtensa local | Não suporta pt-BR bem |
| Vosk | Qualidade inferior ao Whisper |

## Requisitos

- GPU RTX 4090 (24GB)
- ~4GB VRAM livre para whisper+gemma4
- GNOME desktop (para hotkey)
- Linux com ALSA ou PulseAudio

## Guardrails Aplicados

1. **Kokoro TTS lock:**
   - `chattr +i /srv/apps/voice/docker-compose.yml`
   - VERSÃO PINADA: v0.2.2
   - GUARDRAILS.md atualizado

2. **ZFS snapshot** criado antes das mudanças:
   - `tank@pre-20260404-230232-voice-pipeline`

## Custo/Benefício

| Recurso | Valor |
|---------|-------|
| VRAM whisper | ~1GB |
| VRAM gemma4 | ~9GB (já carregado no Ollama) |
| VRAM Kokoro | ~1GB |
| Latência | ~5-10s por dictation |
| Custo API | R$0 (100% local) |

## Consequências

### Positivas
- 100% offline (exceto GPU)
- Zero custo por transação
- Texto corrigido para pt-BR técnico
- Funciona em qualquer app via clipboard

### Negativas
- VRAM limitante (não pode rodar com gemma4 se outras ops GPU ativas)
- Requer desktop GNOME (não funciona em tty/ssh)
- Máx 30s por gravação

## Testes

```bash
# E2E test
arecord -d 5 -f cd /tmp/test.wav && voice-pipeline.sh /tmp/test.wav
xclip -selection clipboard -o
```

## Revisões

| Data | Versão | Mudança |
|------|--------|---------|
| 2026-04-04 | 1.0 | Implementação inicial |

---

** Referências:
- Skill: ~/.zappro/skills/voice-dev-pipeline/SKILL.md
- Scripts: ~/.local/bin/voice-*.sh
