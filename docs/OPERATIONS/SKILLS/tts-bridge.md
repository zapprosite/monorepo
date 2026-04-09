# TTS Bridge — Voice Access Control for Kokoro TTS

**Data:** 2026-04-08
**Autor:** will-zappro
**Status:** ✅ OPERACIONAL

---

## Propósito

O TTS Bridge é um proxy HTTP minimalista (Python stdlib) que filtra o acesso ao Kokoro TTS. Apenas duas vozes PT-BR naturais estão disponíveis: **pm_santa** (masculina) e **pf_dora** (feminina). Todas as outras vozes (67 total no Kokoro) retornam HTTP 400.

---

## Arquitetura

```
OpenClaw Bot
    │
    └─► TTS Bridge (:8013)
            │
            ├─ Validate voice: pm_santa ✓ → Kokoro :8880 → audio
            ├─ Validate voice: pf_dora ✓ → Kokoro :8880 → audio
            └─ Validate voice: [OTHER] ✗ → 400 Bad Request
```

**Redes:** `qgtzrmi6771lt8l7x8rqx72f` (OpenClaw) + `zappro-lite_default` (LiteLLM)
**IP do Bridge:** `10.0.19.5` (rede qgtzrmi) / `10.0.2.6` (rede zappro-lite)

---

## Endpoints

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check — `{"status": "ok", "service": "tts-bridge", "allowed_voices": ["pm_santa", "pf_dora"]}` |
| GET | `/v1/audio/voices` | Lista filtrada de vozes disponíveis |
| POST | `/v1/audio/speech` | Síntese TTS — valida voice, faz passthrough para Kokoro |

---

## Vozes Permitidas

| Voice ID | Tipo | Uso |
|----------|------|-----|
| `pm_santa` | Masculino PT-BR | **PADRÃO** — usado pelo OpenClaw |
| `pf_dora` | Feminino PT-BR | Fallback / alternativo |

---

## Vozes Bloqueadas

Todas as outras vozes Kokoro retornam HTTP 400:
- `af_*` (American Female) — 18 vozes bloqueadas
- `am_*` (American Male) — 12 vozes bloqueadas
- `bf_*`, `bm_*` (British) — 11 vozes bloqueadas
- `jf_*`, `zf_*`, `zm_*` (Japanese/Chinese) — 12 vozes bloqueadas
- etc.

---

## Verificação

### Health check
```bash
curl -sf http://localhost:8013/health
# {"status": "ok", "service": "tts-bridge", "allowed_voices": ["pm_santa", "pf_dora"]}
```

### Lista de vozes (filtrada)
```bash
curl -sf http://localhost:8013/v1/audio/voices
# {"voices": ["pm_santa", "pf_dora"], "note": "Only PT-BR natural voices are available"}
```

### Síntese pm_santa (deve funcionar)
```bash
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste de voz","voice":"pm_santa"}' \
  -o /tmp/test.mp3 -w "HTTP %{http_code}\n"
# HTTP 200
```

### Síntese pf_dora (deve funcionar)
```bash
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste de voz","voice":"pf_dora"}' \
  -o /tmp/test2.mp3 -w "HTTP %{http_code}\n"
# HTTP 200
```

### Voz bloqueada (deve retornar 400)
```bash
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste","voice":"af_sarah"}' \
  -w "HTTP %{http_code}\n"
# HTTP 400
# {"error": {"type": "invalid_request_error", "message": "Voice 'af_sarah' is not allowed. Available voices: pm_santa, pf_dora"}}
```

---

## Container

```yaml
container_name: zappro-tts-bridge
image: python:3.11-slim
ports:
  - "127.0.0.1:8013:8013"
networks:
  - qgtzrmi6771lt8l7x8rqx72f
  - zappro-lite_default
volumes:
  - /srv/monorepo/docs/OPERATIONS/SKILLS/tts-bridge.py:/app/tts-bridge.py:ro
command: python3 /app/tts-bridge.py
restart: unless-stopped
```

---

## Ficheiros

| Ficheiro | Descrição |
|----------|-----------|
| `docs/OPERATIONS/SKILLS/tts-bridge.py` | Script Python stdlib — zero dependencies |
| `docs/OPERATIONS/SKILLS/tts-bridge-docker-compose.yml` | Docker compose para deploy |
| `docs/OPERATIONS/SKILLS/tts-bridge.md` | Esta documentação |

---

## Integração com OpenClaw

O OpenClaw aponta para o TTS Bridge (não Kokoro direto):

**openclaw.json** (`messages.tts.openai`):
```json
{
  "apiKey": "sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1",
  "baseUrl": "http://10.0.19.5:8013/v1",
  "model": "tts-1",
  "voice": "pm_santa"
}
```

---

## Limitações

- O TTS Bridge é transparente — não retorna MP3 diretamente, faz stream do Kokoro
- Se o Bridge cair, OpenClaw não consegue fazer TTS (Kokoro direto continua a funcionar)
- O modelo no request deve ser `kokoro` (não `tts-1`) quando chamado via bridge

---

**Criado:** 2026-04-08
**Autoridade:** will-zappro
**Revisão:** semanal (2026-04-15)