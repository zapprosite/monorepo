---
name: SPEC-072-tts-ptbr-gpu24gb-upgrade
description: "SRE Review (18/04/2026): Upgrade TTS PT-BR para F5-TTS Voice Cloning (XTTS-v2 deprecated — Coqui shutdown). Kokoro as fallback. VRAM guard, dual provider. See SPEC-076 for F5-TTS evaluation."
status: IN_PROGRESS
priority: high
author: William Rodrigues / SRE Review
date: 2026-04-18
deadline: 2026-04-25
specRef: SPEC-009, SPEC-027, SPEC-053
---

# SPEC-072: TTS PT-BR Upgrade — XTTS-v2 Voice Cloning

## SRE Review (18/04/2026)

**Revisor:** Claude Code (SRE perspective)
**Resultado:** RESEARCH → IN_PROGRESS (após correção arquitetural)

---

## 1. CONTEXT & PROBLEM STATEMENT

**Situação Atual:**
- **TTS:** Kokoro-82M via TTS Bridge `:8013`
- **Vozes:** `pm_santa` (masculino), `pf_dora` (feminino)
- **GPU:** 24GB VRAM (RTX 4090) — ~20GB livre após STT
- **Problema:** Qualidade "robótica" em frases longas, pronúncia PT-BR imperfeita
- **Ports:** `:8013` (bridge), `:8020` (reservada para XTTS)

**Objetivo:**
Melhorar qualidade TTS PT-BR mantendo 100% local, open-source, e rodando na GPU existente.

---

## 2. ARCHITECTURE CORRECTION

### ⚠️ CRITICAL: Kokoro ≠ XTTS-v2

**Kokoro** é um TTS Bridge com vozes pré-definidas (`pm_santa`, `pf_dora`):
```
texto → Kokoro Bridge :8013 → voz pré-carregada
```

**XTTS-v2** é um voice cloning que precisa de reference audio:
```
texto + speaker_wav.wav → XTTS-v2 :8020 → áudio clonado
```

XTTS-v2 **não tem vozes** `pm_santa`/`pf_dora` — ele **clona** vozes a partir de 3-5s de áudio de referência.

### Solução: Dual TTS Provider

```
apps/ai-gateway/src/routes/audio-speech.ts
       │
       ├── TTS_BRIDGE_PRIMARY=xtts   → XTTS-v2 :8020
       │         └── speaker_wav: /srv/data/tts/voices/pf_dora_ref.wav
       │
       └── TTS_BRIDGE_FALLBACK=kokoro → Kokoro :8013
                   └── voice: pf_dora (pré-definida)

Fallback: tenta XTTS, se falhar → Kokoro (log warning)
```

---

## 3. REFERENCE AUDIO REQUIREMENT

### 3.1 Como Obter Reference Audio

XTTS-v2 precisa de **3-5 segundos** de áudio da voz real para clonar.

**Opção A — Gravar de Novo (Recomendado):**
```bash
# Gravar com Kokoro actual (já temos vozes)
python3 -c "
import requests, json
text = 'Olá, eu sou a pf_dora. Esta voz vai ser usada como referência para XTTS.'
resp = requests.post('http://localhost:8013/v1/audio/speech',
    json={'model':'kokoro','input':text,'voice':'pf_dora','response_format':'wav'},
    timeout=30)
if resp.status_code == 200:
    with open('/srv/data/tts/voices/pf_dora_ref.wav', 'wb') as f:
        f.write(resp.content)
    print('pf_dora reference saved')
"
```

**Opção B — Usar Áudio Existente:**
Se tens gravações reais das vozes `pm_santa`/`pf_dora`, usar essas.

### 3.2 Voice Manifest

```json
// /srv/data/tts/voices/manifest.json
{
  "voices": {
    "pf_dora": {
      "provider": "xtts",
      "ref_wav": "/srv/data/tts/voices/pf_dora_ref.wav",
      "lang": "pt-br"
    },
    "pm_santa": {
      "provider": "xtts",
      "ref_wav": "/srv/data/tts/voices/pm_santa_ref.wav",
      "lang": "pt-br"
    }
  }
}
```

---

## 4. IMPLEMENTAÇÃO

### Fase 1: Reference Audio (CRITICAL — Blocker)

| Step | Task | Status |
|------|------|--------|
| T1 | Gravar 3-5s de áudio `pf_dora` (via Kokoro) | PENDING |
| T2 | Gravar 3-5s de áudio `pm_santa` (via Kokoro) | PENDING |
| T3 | Guardar em `/srv/data/tts/voices/` | PENDING |
| T4 | Criar manifest.json | PENDING |

### Fase 2: XTTS-v2 Setup

| Step | Task | Status |
|------|------|--------|
| T5 | Verificar VRAM disponível (`nvidia-smi` > 4GB livre) | PENDING |
| T6 | Docker container XTTS-v2 em `:8020` | PENDING |
| T7 | Health check: `GET /health` → 200 | PENDING |
| T8 | Teste: `POST /tts` com `speaker_wav` | PENDING |

### Fase 3: Integration

| Step | Task | Status |
|------|------|--------|
| T9 | Criar `xtts_provider.py` no TTS Bridge | PENDING |
| T10 | Implementar fallback: XTTS → Kokoro | PENDING |
| T11 | Update `audio-speech.ts` com dual provider | PENDING |
| T12 | VRAM guard: verificar <4GB → falhar graceful | PENDING |

### Fase 4: Validation

| Step | Task | Status |
|------|------|--------|
| T13 | Benchmark: 10 frases XTTS vs Kokoro | PENDING |
| T14 | Smoke test: Hermes responde voz XTTS | PENDING |
| T15 | A/B test se possível | PENDING |

### Fase 5: Documentation

| Step | Task | Status |
|------|------|--------|
| T16 | Update SPEC-027 com XTTS-v2 | PENDING |
| T17 | Update PORTS.md (`:8020` XTTS-v2) | PENDING |
| T18 | Update IMMUTABLE-SERVICES.md | PENDING |

---

## 5. ⚠️ COQUI DEPRECIATION WARNING

**Coqui.ai shutdown announced 2025.** XTTS-v2 funciona mas Coqui não está mais ativo.

### Alternatives (ranked by recommendation)

| Model | Status | Quality | VRAM | License |
|-------|--------|---------|------|---------|
| **F5-TTS** | ✅ **RECOMMENDED** | 8/10 | ~4GB | CC-BY-NC-4.0 |
| **Fish Speech 1.4** | ✅ Active | 7.5/10 | 6-8GB | Apache 2.0 |
| **Parler-TTS** | ✅ Active | 8/10 | 4-6GB | Apache 2.0 |
| **XTTS-v2** (Coqui) | ⚠️ Deprecated | 7.5/10 | 3-4GB | MPL-2.0 |

**Recommendation (SPEC-076):** F5-TTS is now the primary recommendation for voice cloning. See [SPEC-076-xtts2-voice-clone.md](./SPEC-076-xtts2-voice-clone.md) for the evaluation protocol. F5-TTS outperforms XTTS-v2 in benchmarks and is actively maintained in 2026. Fish Speech as backup if F5-TTS fails.

---

## 6. VRAM CALCULATION

```
GPU Total:          24GB (RTX 4090)
STT (Whisper):      ~3GB (faster-whisper-medium)
XTTS-v2:            ~3-4GB
────────────────────────────────
Reserva:            ~15GB livre

Guard: torch.cuda.set_per_process_memory_fraction(0.80)
Se VRAM livre < 4GB → não iniciar XTTS, usar Kokoro
```

---

## 7. BENCHMARK CRITERIA

| Métrica | Kokoro (baseline) | XTTS-v2 (target) |
|---------|-------------------|-------------------|
| Qualidade PT-BR | 6/10 | 7.5/10 (+25%) |
| Latência (100 chars) | 0.3s | 0.5-1s |
| VRAM | 1-2GB | 3-4GB |
| Naturalidade | Robótica | Natural |

**Veredicto:** +25% qualidade por +2GB VRAM e +0.5s latência — **ACEITÁVEL**

---

## 8. FILES TO MODIFY

| Ficheiro | Acção |
|----------|--------|
| `apps/ai-gateway/src/routes/audio-speech.ts` | Dual TTS provider |
| `apps/ai-gateway/src/schemas.ts` | XTTS schema |
| `docker-compose.yml` | XTTS-v2 container |
| `/srv/data/tts/voices/*.wav` | Reference audio |
| `/srv/data/tts/voices/manifest.json` | Voice manifest |
| `docs/SPECS/SPEC-027-voice-pipeline-ptbr.md` | Update |
| `docs/INFRASTRUCTURE/PORTS.md` | Porta 8020 |
| `docs/GOVERNANCE/IMMUTABLE-SERVICES.md` | XTTS-v2 |

---

## 9. DEPENDENCIAS

- SPEC-009: TTS Bridge :8013 (Kokoro) — IMUTÁVEL
- SPEC-027: Voice pipeline canonical — IMUTÁVEL
- SPEC-053: STT (Whisper) — IMUTÁVEL
- VRAM: 24GB RTX 4090 — REQUIRED
- Reference audio: will_voice_ZapPro.wav (28.2s), will_voice_Jarvis_home_lab.wav (16.8s) — **USER'S OWN VOICE** — CLONE TEST

## 9.1 USER VOICE CLONE EVALUATION (SPEC-076)

**Objetivo:** Avaliar se XTTS 2 com voice clone da voz real do utilizador substitui Kokoro completamente.

**User voice samples (already provided):**
| File | Duration | Sample Rate | Status |
|------|----------|-------------|--------|
| `will_voice_ZapPro.wav` | 28.2s | 48kHz mono | ✅ Ideal (≥30s needed) |
| `will_voice_Jarvis_home_lab.wav` | 16.8s | 48kHz mono | ⚠️ Below threshold |

**Evaluation Protocol:**
1. Install XTTS v2 + PyTorch 2.5.1 (fix weights_only compat)
2. Generate Kokoro sample (pf_dora) — baseline
3. Generate XTTS clone with will_voice_ZapPro.wav reference
4. Subjective comparison: naturalidade, timbre, prosódia, artefactos
5. If XTTS clone ≥ 4/5 in all attributes → surgical swap Kokoro → XTTS
6. If failed → document findings, keep Kokoro

---

## 10. SUCCESS CRITERIA

- [ ] Reference audio `pf_dora` e `pm_santa` gravado (3-5s cada)
- [ ] XTTS-v2 container a correr em `:8020`
- [ ] Dual provider: XTTS primary, Kokoro fallback
- [ ] VRAM guard: não inicia se <4GB livre
- [ ] Qualidade subjectiva > 7/10 (não "robótica")
- [ ] Fallback funciona quando XTTS down
- [ ] Smoke test passa
- [ ] Docs atualizados

---

## 11. TEST PLAN

### Teste A: Voice Cloning Quality
```bash
# Gerar mesmo texto com Kokoro e XTTS
TEXT="Olá, tudo bem? Este é um teste de qualidade de voz PT-BR."

# Kokoro (baseline)
curl -X POST http://localhost:8013/v1/audio/speech \
  -d '{"model":"kokoro","input":"'$TEXT'","voice":"pf_dora"}' \
  -o /tmp/test_kokoro.mp3

# XTTS-v2 (novo)
curl -X POST http://localhost:8020/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"'$TEXT'","speaker_wav":"/srv/data/tts/voices/pf_dora_ref.wav"}' \
  -o /tmp/test_xtts.wav

# Comparar: ouvir ambos e avaliar
#Critério: menos robótico = XTTS melhor
```

### Teste B: Fallback
```bash
# Parar XTTS
docker stop xtts-v2

# Tentar gerar áudio (deve falhar para XTTS, funcionar com Kokoro)
curl -X POST http://localhost:8013/v1/audio/speech \
  -d '{"model":"xtts","input":"'$TEXT'","voice":"pf_dora"}' \
  -o /tmp/test_fallback.mp3

# Esperado: retorna áudio Kokoro, log: "XTTS failed, using Kokoro fallback"
```

---

## 12. ROLLOBACK PLAN

Se XTTS-v2 não passar no teste de qualidade:

```bash
# 1. Voltar a Kokoro only
export TTS_BRIDGE_PRIMARY=kokoro

# 2. Remover XTTS container
docker stop xtts-v2 && docker rm xtts-v2

# 3. Reverter audio-speech.ts
git checkout apps/ai-gateway/src/routes/audio-speech.ts

# 4. Done — Kokoro continua a funcionar normalmente
```

---

**Status:** IN_PROGRESS
**Next:** Gravar reference audio → Setup XTTS-v2 → Benchmark → Decide merge
