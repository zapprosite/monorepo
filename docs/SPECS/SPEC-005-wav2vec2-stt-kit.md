# SPEC-005: wav2vec2 STT Kit — PT-BR Speech-to-Text

## Status: PROTEGIDO — NÃO ALTERAR

## Visão Geral

Kit de transcrição de voz brasileira para o homelab. **Este kit é intocável** — qualquer alteração requer aprovação executiva.

---

## Arquitetura

```
OpenClaw Bot / Voice Pipeline
    │
    └─► wav2vec2 STT (port 8201)
            │
            └─► jonatasgrosman/wav2vec2-large-xlsr-53-portuguese
                    ├── Type: STT (Speech-to-Text)
                    ├── Language: PT-BR Native
                    ├── Downloads: 5.8M+
                    └── VRAM: ~2GB
```

---

## wav2vec2 STT — Especificações

| Atributo | Valor |
|----------|-------|
| **Model ID** | jonatasgrosman/wav2vec2-large-xlsr-53-portuguese |
| **HF Path** | /home/will/.cache/huggingface/hub/models--jonatasgrosman--wav2vec2-large-xlsr-53-portuguese |
| **API** | OpenAI-compatible `/v1/audio/transcriptions` |
| **Port** | `0.0.0.0:8201` |
| **VRAM** | ~2GB (GPU) |
| **Language** | PT-BR Native |

### Voices PT-BR

| Voice ID | Tipo | Uso |
|----------|------|-----|
| `wav2vec2-ptbr` | STT | **PADRÃO** — transcrição PT-BR |

---

## Diferença STT vs TTS

```
TTS = Text-to-Speech = Kokoro (texto → áudio)
STT = Speech-to-Text = wav2vec2 (áudio → texto)

Pipeline Completo:
  Microfone → STT (wav2vec2) → Texto → LLM (gemma2-9b-it) → Texto Corrigido → TTS (Kokoro pm_santa) → Áudio
```

---

## Regras de Proteção (GUARDRAILS)

### ⚠️ PROIBIDO — LLM NUNCA PODE IGNORAR

1. **Modelo wav2vec2** — `jonatasgrosman/wav2vec2-large-xlsr-53-portuguese` é IMUTÁVEL
   - NUNCA substituir por Whisper ou outro STT
   - NUNCA desativar ou parar o serviço

2. **API Endpoint** — `http://localhost:8201/v1/audio/transcriptions` é OFICIAL
   - OpenClaw usa esta porta
   - NUNCA mudar porta sem aprovação

3. **Substituição PROIBIDA** — wav2vec2 NÃO pode ser trocado por:
   - Whisper (any variant)
   - Coqui STT
   - Silero STT
   - Deepgram (cloud substituindo local — Proxy Deepgram via wav2vec2-proxy :8203 é o path correto)

### ⚠️ REQUER APROVAÇÃO

- Upgrade de modelo wav2vec2
- Mudança de porta
- Modificação de parâmetros de sample rate
- Adicionar cache Redis

---

## Workflow — Quando Usar Este Kit

```
Quando receber task de VOZ/STT:
1. Usar wav2vec2-ptbr na porta 8201
2. API: POST /v1/audio/transcriptions
3. NUNCA sugerir Whisper como替代
```

---

## Teste de Sanidade

```bash
# Health check
curl -s http://localhost:8201/health

# Teste transcrição
curl -s -X POST http://localhost:8201/v1/audio/transcriptions \
  -F "file=@/tmp/test.wav" | python3 -m json.tool
```

---

## VRAM

- wav2vec2 GPU: ~2GB
- Kokoro GPU: ~0.5GB
- Total com whisper-api + gemma2-9b-it: ~20GB / 24GB

---

## Referências

- Skill: `/srv/monorepo/docs/OPERATIONS/SKILLS/wav2vec2-health-check.md` (a criar)
- SPEC: `/srv/monorepo/docs/SPECS/SPEC-004-kokoro-tts-kit.md`
- GUARDRAILS: `/srv/monorepo/docs/GOVERNANCE/GUARDRAILS.md`

---

**PROTEGIDO**: Alterações neste documento requerem aprovação de will-zappro.
