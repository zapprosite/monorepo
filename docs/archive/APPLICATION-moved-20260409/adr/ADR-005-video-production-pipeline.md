# ADR-005: Video Production Pipeline

**Data:** 2026-04-07
**Status:** APPROVED
**Decisor:** William Rodrigues (Mestre)

---

## Context

Agencia full service precisa de VIDEO para prender atencao.
Prioridade: VIDEO PRIMEIRO.

---

## Decisions

### 1. Core: FULL SERVICE
Design + Marketing + Video Production

### 2. Budget: $70-120/mes
- MiniMax: $50 (dev plan)
- Claude Pro: $20
- APIs video: allocated from budget

### 3. Video Priority

**FASE 8: Video Pipeline**

```
8.1 Thumbnail AI
    - Vmake.ai API (free tier)
    - 1of10 API (CTR optimization)
    - Canva API

8.2 Video Effects API
    - WaveSpeedAI (Kling 2.0)
    - Runway

8.3 Auto Cut (futuro)
    - Cortar videos longos
    - Identificar melhores momentos
```

### 4. YouTube Transcription

**HABILIDADE:** Transcrever videos YouTube via Whisper local.

```bash
yt-dlp -x --audio-format mp3 "URL" -o /tmp/audio.mp3
curl -X POST http://localhost:8010/v1/audio/transcriptions -F file=@/tmp/audio.mp3
```

**Workflow:**
1. Colar URL YouTube
2. Baixar audio
3. Transcrever com Whisper local
4. Imprimir no chat para analise
5. Estudar juntos

---

## Video Tools Market

| Ferramenta | Uso | Custo | API |
|-------------|-----|-------|-----|
| Vmake.ai | Thumbnails Shorts/Reels | Free | Sim |
| 1of10 | Thumbnail CTR otimizado | Trial | Sim |
| WaveSpeedAI | Effects, auto cuts | API | Sim |
| Runway | Overlays, filmmaking | $15+/mes | Sim |
| Canva | Thumbnails, templates | Free tier | Sim |

---

## Consequences

**Positivos:**
- Thumbnails de alto CTR
- Producao de video profissional
- Transcricao de videos para estudo

**Negativos:**
- Custo adicional de APIs
- Curva de aprendizado

---

## Status: ✅ APPROVED
