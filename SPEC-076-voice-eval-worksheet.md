# SPEC-076 Voice Clone — A/B Evaluation Worksheet

## Samples to Compare

### Kokoro (Baseline)
- kokoro_pf_dora_trava.wav — pf_dora —rava-línguas
- kokoro_pm_santa_trava.wav — pm_santa —rava-línguas
- kokoro_pf_dora_frase.wav — pf_dora — AI phrase
- kokoro_pm_santa_frase.wav — pm_santa — AI phrase

### F5-TTS (Clone)
- f5tts_zappro_trava.wav — ZapPro 28s reference —rava-línguas
- f5tts_zappro_frase.wav — ZapPro 28s reference — AI phrase
- f5tts_jarvis_trava.wav — Jarvis 16s reference —rava-línguas

## How to Listen

```bash
# Kokoro samples
ffplay -nodisp -autoexit /srv/monorepo/kokoro_pf_dora_trava.wav

# F5-TTS samples (after generation)
ffplay -nodisp -autoexit /srv/monorepo/f5tts_zappro_trava.wav
```

## Scoring (1-5)

| Sample | Naturalidade | Timbre | Prosódia | Clareza | Artefactos |
|--------|-------------|--------|----------|---------|------------|
| kokoro_pf_dora_trava | ? | N/A | ? | ? | ? |
| f5tts_zappro_trava | ? | ? | ? | ? | ? |

## Decision

- [ ] F5-TTS ≥ 4/5 overall → SWAP Kokoro → F5-TTS
- [ ] F5-TTS < 4/5 → Keep Kokoro
