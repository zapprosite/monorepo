# SPEC-004: Kokoro TTS Kit — PT-BR Voice Synthesis

## Status: PROTEGIDO — NÃO ALTERAR

## Visão Geral

Kit de síntese de voz brasileira para o homelab. **Este kit é intocável** — qualquer alteração requer aprovação executiva.

---

## Arquitetura

```
OpenClaw Bot
    │
    ├─► Kokoro TTS (port 8012)
    │       │
    │       └─► pm_santa  (PT-BR Masculino) ← USAR SEMPRE
    │       └─► pf_dora   (PT-BR Feminino) ← fallback
    │
    └─► LiteLLM Proxy (port 4000)
            │
            └─► Transforma Kokoro em OpenAI TTS compatible
```

---

## Kokoro TTS — Especificações

| Atributo | Valor |
|----------|-------|
| **Container** | `zappro-kokoro` |
| **Image** | `ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2` |
| **Port** | `127.0.0.1:8012` |
| **Rede** | `zappro-lite` |
| **API** | OpenAI-compatible `/v1/audio/speech` |
| **Redis Cache** | `zappro-redis` (port 6379) |

### Voices PT-BR

| Voice ID | Tipo | Uso |
|----------|------|-----|
| `pm_santa` | Masculino | **PADRÃO** — pipeline de voz |
| `pf_dora` | Feminino | Fallback / alternativo |

---

## LiteLLM Integration (OpenClaw Compatibility)

### Problema
OpenClaw espera API OpenAI TTS (`/v1/audio/speech`). Kokoro implementa o mesmo endpoint — **é compatível nativamente**.

### Configuração LiteLLM

```yaml
# /srv/ops/litellm/config.yaml
model_list:
  - model_name: kokoro-tts
    litellm_params:
      model: kokoro/local
      api_base: http://localhost:8012/v1
      rpm: 10
      tts_response_format: wav
```

### Transformação OpenAI → Kokoro

| OpenClaw Request | LiteLLM Route | Kokoro Endpoint |
|-----------------|---------------|-----------------|
| `model: kokoro` | `kokoro-tts` | `http://localhost:8012/v1/audio/speech` |
| `voice: pm_santa` | Pass-through | `pm_santa` |

---

## Regras de Proteção (GUARDRAILS)

### ⚠️ PROIBIDO — LLM NUNCA PODE IGNORAR

1. **Imagem do container** — `ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2` é IMUTÁVEL
   - `chattr +i` no docker-compose.yml
   - Qualquer upgrade deve ser aprovado por will-zappro

2. **Vozes PT-BR** — `pm_santa` e `pf_dora` são INVIOLÁVEIS
   - NUNCA sugerir substituição por outro TTS
   - NUNCA remover ou modificar vozes
   - LLM que sugerir "vamos trocar" = VIOLAÇÃO

3. **Porta** — `127.0.0.1:8012` é a porta oficial do Kokoro

4. **Redis cache** — `zappro-redis` deve estar sempre online

5. **Substituição PROIBIDA** — Kokoro NÃO pode ser trocado por:
   - Coqui TTS
   - Silero TTS
   - StyleTTS
   - XTensa
   - Qualquer outro TTS

### ⚠️ REQUER APROVAÇÃO

- Upgrade de versão do Kokoro
- Adição de novas vozes PT-BR
- Mudança de porta ou endpoint
- Modificação de parâmetros de qualidade
- Adicionar wav2vec2 como STT (requer accuracy test primeiro)

---

## Workflow — Quando Usar Este Kit

```
Quando receber task de VOZ/TTS:
1. Usar Kokoro (pm_santa) — PADRÃO
2. Se feminina necessária → pf_dora
3. Se não funcionar → verificar liteLLM config
4. NUNCA substituir por outro TTS sem aprovação
```

---

## Teste de Sanidade

```bash
# Health check
curl -s http://localhost:8012/health

# Teste pm_santa
curl -s -X POST http://localhost:8012/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste","voice":"pm_santa"}' \
  -o /tmp/test.wav && echo "OK"

# Teste pf_dora
curl -s -X POST http://localhost:8012/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste","voice":"pf_dora"}' \
  -o /tmp/test2.wav && echo "OK"
```

---

## VRAM

- Kokoro GPU: ~300-500MB ( ONNX, leve)
- Total com whisper + gemma2-9b-it: ~20GB / 24GB

---

## Referências

- Skill: `/srv/monorepo/docs/OPERATIONS/SKILLS/kokoro-health-check.md`
- ADR: `/srv/monorepo/docs/ADRs/20260404-voice-dev-pipeline.md`
- LiteLLM: `/srv/ops/litellm/config.yaml`

---

**PROTEGIDO**: Alterações neste documento requerem aprovação de will-zappro.
