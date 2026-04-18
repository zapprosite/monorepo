# SPEC-076: Voice Clone Evaluation — Kokoro → F5-TTS Surgical Swap

## Objective

Avaliar se F5-TTS (zero-shot voice cloning) com voice clone da voz real do utilizador substitui Kokoro para TTS PT-BR. Swap cirúrgico apenas se qualidade for superior.

## Motivation

- Kokoro usa vozes pré-fabricadas (pf_dora/pm_santa) — não é a voz real do utilizador
- F5-TTS permite zero-shot voice cloning com 3-10s de reference audio
- **Research 18/04/2026:** F5-TTS > XTTS v2 > Kokoro (benchmark)

## Research Findings

| Modelo | Quality | VRAM | PT-BR | Status | License |
|--------|---------|------|-------|--------|---------|
| **F5-TTS** | 8/10 ✅ | ~4GB | Zero-shot | Active 2026 | CC-BY-NC-4.0 |
| Qwen3-TTS | 7/10 | 0.6-1.7B | ✅ | New Jan/2026 | Apache 2.0 |
| XTTS v2 | 7.5/10 | ~4GB | ✅ | ⚠️ Coqui deprecated | MPL-2.0 |
| Kokoro | 6/10 | ~1GB | Pre-made | ✅ Working | - |
| Fish Speech | 7.5/10 | ~6-8GB | Limited | Active | Apache 2.0 |

**F5-TTS wins** — zero-shot, best quality per benchmarks, active 2026, PyTorch 2.5.1 compatible.

## Voice Samples Available

| File | Duration | Sample Rate | Quality |
|------|----------|-------------|---------|
| `will_voice_ZapPro.wav` | 28.2s | 48 kHz | ✅ Ideal (≥30s recommended) |
| `will_voice_Jarvis_home_lab.wav` | 16.8s | 48 kHz | ⚠️ Short but usable (3-10s minimum) |

## Phase 1 — Install F5-TTS

```bash
# GhostTalker (recommended — zero-shot, best quality)
git clone https://github.com/shantoshdurai/GhostTalker
cd GhostTalker
# Uses PyTorch 2.5.1 + CUDA 12.1
pip install f5-tts
# Verify
python -c "from f5_tts import F5TTS; print('F5-TTS OK')"
```

## Phase 2 — Generate Reference Samples (Kokoro)

Using existing Kokoro TTS Bridge on `:8013`:

```bash
curl -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Olá, eu sou o assistente de voz do Jarvis. Como posso ajudar hoje?",
    "voice": "pf_dora",
    "response_format": "wav"
  }' -o kokoro_pf_dora_test.wav
```

## Phase 3 — Generate F5-TTS Clone Samples

```python
import torch
from f5_tts import F5TTS

model = F5TTS()
model.load_model()

reference_audio = "/srv/monorepo/will_voice_ZapPro.wav"
reference_text = "Reference transcription of the audio"

# Test 1: Short phrase
model.generate(
    text="Olá, eu sou o assistente de voz do Jarvis. Como posso ajudar hoje?",
    ref_audio=reference_audio,
    ref_text=reference_text,
    output_path="/srv/monorepo/f5tts_zappro_test.wav"
)

# Test 2: Longer paragraph
model.generate(
    text="Este é um teste de síntese de voz com clonagem.",
    ref_audio=reference_audio,
    ref_text=reference_text,
    output_path="/srv/monorepo/f5tts_zappro_para.wav"
)
```

## Phase 4 — Subjective Comparison

Compare os seguintes atributos (escala 1-5):
- **Naturalidade**: soa como voz humana natural?
- **Timbre**: mantém o timbre do reference audio?
- **Prosódia**: entonação e ritmo naturais?
- **Clareza**: palavras perceptíveis?
- **Artefactos**: ruidos, clicks, distorções?

## Phase 5 — Surgical Swap (if F5-TTS superior)

Changes to `apps/hermes-agency/`:
1. Replace Kokoro TTS calls with F5-TTS API
2. Remove Kokoro TTS Bridge dependency (`:8013`)
3. Keep Kokoro as fallback if F5-TTS fails
4. Update `TTS_BRIDGE_URL` env var or deprecate

## Success Criteria

| Criteria | Threshold |
|----------|-----------|
| F5-TTS clone quality | ≥ 4/5 in all attributes |
| F5-TTS latency | ≤ 7s for short phrase (GPU) |
| Subjective preference | Strictly preferred over Kokoro |
| VRAM usage | ≤ 6GB for F5-TTS |

## Status (2026-04-18 18:30)

- ✅ F5-TTS venv created at `.f5tts-venv/` (4.3GB)
- ✅ f5-tts 1.1.17 + torch 2.5.1+cu121 installed
- ✅ Kokoro samples: 7 files generated
- ⚠️ F5-TTS generation process: killed multiple times (API mismatch — use `infer()` not `generate()`)
- ⏳ Awaiting user decision on next approach

## Technical Notes

**F5-TTS API (v1.1.x):**
```python
from f5_tts.api import F5TTS
model = F5TTS(device="cuda")
wav, sr = model.infer(
    ref_file="/srv/monorepo/will_voice_ZapPro.wav",
    ref_text="",  # auto-transcribe with whisper
    gen_text="O rato roeu a roupa do rei de Roma.",
    remove_silence=True,
    speed=1.0,
)
```

**NOT** `generate()` — use `infer()`.

## Acceptance Criteria

- [x] F5-TTS installed (venv ready)
- [x] Kokoro reference samples generated (7 files)
- [ ] F5-TTS clone sample generated (ZapPro) — BLOCKED by process kill
- [ ] Subjective comparison documented
- [ ] If passed: surgical swap in hermes-agency
- [ ] If failed: document findings and keep Kokoro

## Open Questions

1. Is 28s sample (ZapPro) sufficient or should we use Jarvis 16.8s + something else?
2. Should Kokoro remain as fallback after swap?
3. CC-BY-NC-4.0 license acceptable for commercial use?

## Related

- SPEC-053: Hermes Voice+Vision (Kokoro integration)
- SPEC-048: OpenAI Facade (TTS bridge)
- GhostTalker: https://github.com/shantoshdurai/GhostTalker (F5-TTS zero-shot)
- voice-ai-agent: https://github.com/asainov1/voice-ai-agent (F5-TTS benchmarks)
