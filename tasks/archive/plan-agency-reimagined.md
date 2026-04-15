# Plan: OpenClaw Agency — Voice-First

**Spec:** SPEC-011
**Created:** 2026-04-08
**Author:** will

---

## Overview

Reimaginar o OpenClaw como uma agencia de design/marketing voice-first. O diferenciador e que clientes fazem briefing por audio e recebem relatorios por audio — ninguem no mercado faz isso.

---

## Dependency Graph

```
VOICE BRIEFING (Fase 1)
    │
    ├── wav2vec2 :8201 (STT) — ja existe
    ├── Qdrant collections — client (existe vazio)
    └── skill voice-briefing — CRIAR
            │
            ▼
SUB-AGENTS (Fase 2)
    │
    ├── CREATIVE sub-agent — CRIAR
    ├── DESIGN sub-agent — CRIAR
    ├── SOCIAL sub-agent — CRIAR
    └── agentToAgent config — ATUALIZAR
            │
            ▼
VOICE REPORTS (Fase 3)
    │
    ├── TTS Bridge :8013 — ja existe
    ├── Kokoro — ja existe
    └── template relatorio — CRIAR
            │
            ▼
SOCIAL AUTOMATION (Fase 4)
    │
    ├── n8n workflow — ATUALIZAR
    ├── PROJECT sub-agent — CRIAR
    └── calendar skill — CRIAR
            │
            ▼
BRAND GUIDE ENGINE (Fase 5)
    │
    ├── llava via LiteLLM — ja existe
    └── brand extraction skill — CRIAR
```

---

## Vertical Slices (one complete path per task)

### Slice 1: Voice Briefing Pipeline
- Completar: audio → STT → transcribe → Qdrant context → copy generation → TTS preview
- Unica tarefa end-to-end que o cliente pode usar imediatamente
- Validado quando cliente recebe copy gerada a partir de audio

### Slice 2: CREATIVE + DESIGN sub-agents
- Completar: SOUL.md + workspace + delegation test
- Validado quando CEO MIX delega e sub-agents respondem

### Slice 3: Voice Report Delivery
- Completar: template → Qdrant → CEO MIX → TTS → Telegram
- Validado quando cliente recebe audio com relatorio

### Slice 4: Social Publishing Pipeline
- Completar: calendar → n8n workflow → post published
- Validado quando post aparece na rede social

### Slice 5: Brand Consistency Engine
- Completar: image upload → llava → brand extraction → Qdrant
- Validado quando CEO MIX extrai brand guide de imagens

---

## Tasks

1. **Voice Briefing Skill** — `voice-briefing.py`
   - Accepts: audio file path
   - Calls: wav2vec2 :8201 → Qdrant search → copy generation
   - Returns: transcription + copy draft + TTS preview

2. **Sub-agent CREATIVE** — workspace + SOUL.md
   - Copywriting: AIDA, PAS, headlines
   - Brand voice adaptation
   - Integration: Qdrant brand_guide

3. **Sub-agent DESIGN** — workspace + SOUL.md
   - Briefs visuais: paleta, fontes, composicao
   - Image analysis via llava
   - Integration: Qdrant brand_guide

4. **Sub-agent SOCIAL** — workspace + SOUL.md
   - Calendario editorial
   - Trend analysis
   - Integration: n8n workflow

5. **Sub-agent PROJECT** — workspace + SOUL.md
   - Gestao de timeline
   - Status reports
   - Integration: Qdrant campaigns

6. **Voice Report Generator** — `voice-report.py`
   - Aggregates: campaigns, metrics, next steps
   - Generates: TTS-ready summary
   - Delivers: via Telegram audio

7. **n8n Social Workflow** — update existing
   - Trigger: campaign approved
   - Action: publish to social networks
   - Confirm: via Telegram

8. **Brand Guide Extractor** — `brand-extractor.py`
   - Accepts: image(s)
   - Calls: llava for analysis
   - Extracts: colors, fonts, tone, style
   - Stores: in Qdrant brand_guide

---

## Verification Checklist

Before each phase:
- [ ] ZFS snapshot
- [ ] Smoke test passes
- [ ] Logs reviewed
- [ ] Client approves

After each phase:
- [ ] Feature works via Telegram
- [ ] Qdrant data correct
- [ ] No secrets exposed
- [ ] Governance respected

---

## Timeline Suggestion

| Semana | Foco |
|--------|------|
| 1 | Voice Briefing — audio → copy end-to-end |
| 2 | Sub-agents CREATIVE + DESIGN operational |
| 3 | Voice Reports + SOCIAL calendar |
| 4 | n8n automation + PROJECT manager |
| 5 | Brand Guide Engine + llava integration |

---

## Resources

- 1x developer (will)
- OpenClaw bot (existing)
- Qdrant (existing)
- LiteLLM + Ollama (existing)
- n8n (existing)
- TTS Bridge (existing)
