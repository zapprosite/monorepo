---
archived: true
superseded_by: SPEC-009 (wav2vec2 canonical) + SPEC-027
see_also:
  - SPEC-009, SPEC-027
---

> ⚠️ ARCHIVED — Superseded by [SPEC-024](../SPEC-024.md) and related canonical specs.

# SPEC-018: wav2vec2 como Deepgram Proxy (STT PT-BR Local)

**Status:** COMPLETED
**Created:** 2026-04-09
**Author:** will + Claude Code

---

## Deployment Status

| Field | Value |
|-------|-------|
| Container | zappro-wav2vec2-proxy (running) |
| Network | qgtzrmi6771lt8l7x8rqx72f |
| IP | 10.0.19.9 |
| Port | 8203 |
| Status | OPERATIONAL |

---

## Resumo

O OpenClaw usa Deepgram para STT mas Deepgram não tem bom suporte a PT-BR. Em vez de usar Deepgram cloud, criamos um **proxy** que faz o wav2vec2 local parecer a API do Deepgram. O OpenClaw pensa que está a chamar Deepgram, mas na realidade está a usar STT local com wav2vec2 + Ollama PT-BR enhancement.

---

## Arquitetura

```
OpenClaw Container (qgtzrmi6771lt8l7x8rqx72f)
       │
       │ /etc/hosts: api.deepgram.com → 10.0.19.9
       ▼
wav2vec2-deepgram-proxy (:8203) ← Container Docker em qgtzrmi6771lt8l7x8rqx72f
       │ IP: 10.0.19.9
       │
       │ POST /v1/listen?model=nova-3&language=pt-BR (Deepgram format)
       │ ↓ converte audio
       │ POST /v1/audio/transcriptions (OpenAI Whisper format)
       ▼
whisper-api (:8201) ← wav2vec2 container (IP: 10.0.19.8)
       │
       │ ↓ transcricao PT-BR
       ▼
texto → Ollama PT-BR enhancement (llama3-portuguese-tomcat-8b-instruct-q8)
```

---

## Ficheiros

### 1. `wav2vec2-deepgram-proxy.py`
`docs/OPERATIONS/SKILLS/wav2vec2-deepgram-proxy.py`

Implementa a API do Deepgram (`POST /v1/listen`) e faz proxy para o whisper-api (wav2vec2).

**Endpoints:**
- `GET /health` → `{"status": "ok"}`
- `POST /v1/listen?model=nova-3&language=pt-BR` → Deepgram JSON format

**Response format (Deepgram):**
```json
{
  "results": {
    "channels": [{
      "alternatives": [{
        "transcript": "texto transcrito",
        "confidence": 0.99
      }]
    }]
  }
}
```

### 2. `wav2vec2-deepgram-proxy.dockerfile`
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
COPY docs/OPERATIONS/SKILLS/wav2vec2-deepgram-proxy.py /app/proxy.py
WORKDIR /app
CMD ["python3", "proxy.py"]
```

### 3. Docker Compose
```yaml
services:
  wav2vec2-proxy:
    build: .
    container_name: zappro-wav2vec2-proxy
    restart: unless-stopped
    ports:
      - "8203:8203"
    environment:
      - PORT=8203
      - WHISPER_API=http://10.0.19.8:8201
      - OLLAMA_HOST=http://10.0.19.1:11434
      - OLLAMA_MODEL=llama3-portuguese-tomcat-8b-instruct-q8:latest
    networks:
      - qgtzrmi6771lt8l7x8rqx72f

networks:
  qgtzrmi6771lt8l7x8rqx72f:
    external: true
```

---

## Configuração OpenClaw

### Passo 1: Adicionar Extra Hosts no Coolify

No Coolify UI, ir a:
- OpenClaw Service → Settings → Advanced
- Adicionar em "Extra Hosts":
```
api.deepgram.com=10.0.19.9
```

### Passo 2: Restart do OpenClaw

Após adicionar Extra Hosts, fazer rebuild/restart do container OpenClaw.

### Verificação
```bash
# Dentro do container OpenClaw:
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f cat /etc/hosts | grep deepgram
# Deve mostrar: 10.0.19.9 api.deepgram.com

# Testar conectividad:
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f curl -sf http://api.deepgram.com:8203/health
```

---

## Deploy via Coolify CLI

```bash
# Build e run
cd /srv/monorepo

# Criar app no Coolify
COOLIFY_TOKEN=$(cat /srv/ops/secrets/coolify.service-token)
COOLIFY_URL=http://localhost:8000

APP=$(curl -s -X POST "${COOLIFY_URL}/api/v1/applications" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "zappro-wav2vec2-proxy",
    "fqdn": "wav2vec2-proxy.zappro.site",
    "gitRepository": null,
    "buildPack": "dockerfile"
  }')
APP_ID=$(echo "$APP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

# Deploy from Dockerfile
curl -s -X POST "${COOLIFY_URL}/api/v1/deployments" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"application_id\": \"$APP_ID\",
    \"dockerfile\": \"$(cat docs/OPERATIONS/SKILLS/wav2vec2-deepgram-proxy.dockerfile | base64 -w0)\",
    \"environment_variables\": {
      \"PORT\": \"8203\",
      \"WHISPER_API\": \"http://10.0.19.8:8201\",
      \"OLLAMA_HOST\": \"http://10.0.19.1:11434\",
      \"OLLAMA_MODEL\": \"llama3-portuguese-tomcat-8b-instruct-q8:latest\"
    }
  }"
```

---

## Teste

```bash
# Test local
python3 docs/OPERATIONS/SKILLS/wav2vec2-deepgram-proxy.py &
sleep 2

# Health
curl http://localhost:8203/health

# Transcription
curl -X POST "http://localhost:8203/v1/listen?model=nova-3&language=pt-BR" \
  -H "Authorization: Token test" \
  -H "Content-Type: audio/wav" \
  --data-binary @audio.wav
```

---

## Verificação

### Status: ✅ IMPLEMENTADO (2026-04-09)

1. ✅ Health: `curl http://localhost:8203/health` → `{"status":"ok","service":"wav2vec2-deepgram-proxy"}`
2. ✅ Proxy IP: `10.0.19.9:8203` (mesma network que OpenClaw)
3. ✅ Transcription funciona e retorna formato Deepgram
4. ✅ Enhancement PT-BR via Ollama funciona

### Verified Tests (2026-04-09)

| Test | Command | Result |
|------|---------|--------|
| Direct whisper-api | `curl http://localhost:8201/v1/audio/transcriptions` | WORKS |
| Proxy with chunked encoding | `curl -X POST http://localhost:8203/v1/listen?model=nova-3&language=pt-BR` | WORKS |
| Ollama PT-BR enhancement | `llama3-portuguese-tomcat-8b-instruct-q8` | WORKS |

### Teste Final
```bash
# Direct test from OpenClaw container:
docker exec openclaw curl -X POST "http://api.deepgram.com:8203/v1/listen?model=nova-3&language=pt-BR" \
  -H "Authorization: Token test" \
  -H "Content-Type: audio/mpeg" \
  --data-binary "@/tmp/test.mp3"
# Result: ENTENDI: O áudio é uma pessoa falando sobre um teste...
```

### Pendente
- [ ] Configurar Extra Hosts no Coolify UI para tornar `/etc/hosts` permanente

---

## Alternativas Consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Groq Whisper | Funciona bem PT-BR | Não suportado pelo OpenClaw |
| Deepgram cloud | Funciona com `language=pt-BR` | API key exposta, custo |
| LiteLLM proxy | Std. interface | Não suporta STT nativamente |
| **wav2vec2-proxy** | Local, PT-BR nativo, gratuito | Requer /etc/hosts hack |

---

## Data: 2026-04-09
