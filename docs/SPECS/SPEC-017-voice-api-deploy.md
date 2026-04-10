# SPEC-017: Voice API — Deploy via Coolify CLI (No Dashboard)

**Status:** SPEC
**Created:** 2026-04-09
**Author:** will + Claude Code

---

## Resumo

Deploy do `voice-api.py` (STT Bridge) no Coolify via CLI — sem dashboard. secrets no Infisical, subdomain via Cloudflare Tunnel (Terraform), tudo programmatico.

---

## Arquitetura Alvo

```
OpenClaw Container
       │
       │ HTTP POST /v1/audio/transcriptions
       │
       ▼
voice-api (:8202) ← Docker container em Coolify
   rede: qgtzrmi6771lt8l7x8rqx72f (mesma do OpenClaw)
       │
       │ proxy audio
       ▼
whisper-api (:8201) ← processo nativo no host
       │
       ▼
texto PT-BR → Ollama PT-BR enhancement (opcional)
```

---

## Ficheiros a Criar

### 1. `voice-api.py` — STT Bridge (já criado)
`docs/OPERATIONS/SKILLS/voice-api.py`

### 2. `voice-api.dockerfile`
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
COPY docs/OPERATIONS/SKILLS/voice-api.py /app/voice-api.py
WORKDIR /app
CMD ["python3", "voice-api.py"]
```

### 3. `voice-api.compose.yml`
```yaml
services:
  voice-api:
    build: .
    container_name: zappro-voice-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:8202:8202"
    environment:
      - PORT=8202
      - WHISPER_API=${WHISPER_API}
      - OLLAMA_HOST=${OLLAMA_HOST}
      - OLLAMA_MODEL=${OLLAMA_MODEL}
    networks:
      - qgtzrmi6771lt8l7x8rqx72f
```

### 4. Infisical Secrets
| Secret | Valor |
|--------|-------|
| `VOICE_API_WHISPER_API` | `http://10.0.19.1:8202` |
| `VOICE_API_OLLAMA_HOST` | `http://10.0.2.4:11434` |
| `VOICE_API_OLLAMA_MODEL` | `llama3-portuguese-tomcat-8b-instruct-q8:latest` |

### 5. Deploy via Coolify CLI

```bash
# Auth
COOLIFY_TOKEN=$(cat /srv/ops/secrets/coolify.service-token)
COOLIFY_URL=http://localhost:8000

# Create new application
APP=$(curl -s -X POST "${COOLIFY_URL}/api/v1/applications" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "zappro-voice-api",
    "fqdn": "voice-api.zappro.site",
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
    \"dockerfile\": \"$(cat voice-api.dockerfile | base64 -w0)\",
    \"environment_variables\": {
      \"WHISPER_API\": \"http://10.0.19.1:8202\",
      \"OLLAMA_HOST\": \"http://10.0.2.4:11434\",
      \"OLLAMA_MODEL\": \"llama3-portuguese-tomcat-8b-instruct-q8:latest\"
    }
  }"
```

### 6. Cloudflare Tunnel (Terraform)

```hcl
resource "cloudflare_record" "voice_api" {
  zone_id = var.cloudflare_zone_id
  name    = "voice-api"
  value   = "voice-api.zappro.site"
  type    = "CNAME"
  proxied = true
}

resource "cloudflare_tunnel" "voice_api" {
  name = "voice-api"
}

resource "cloudflare_tunnel_route" "voice_api" {
  tunnel_id = cloudflare_tunnel.voice_api.id
  zone_id   = var.cloudflare_zone_id
  hostname  = "voice-api.zappro.site"
}
```

---

## Auto-Deploy (Gitea Actions → Coolify)

```yaml
# .gitea/workflows/voice-api.yml
on:
  push:
    paths:
      - docs/OPERATIONS/SKILLS/voice-api.py

jobs:
  deploy:
    runs-on:一团
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Coolify
        env:
          COOLIFY_TOKEN: ${{ secrets.COOLIFY_TOKEN }}
        run: |
          curl -X POST "http://localhost:8000/api/v1/deployments" \
            -H "Authorization: Bearer $COOLIFY_TOKEN" \
            -H "Content-Type: application/json" \
            --data '{
              "application_id": "${{ vars.COOLIFY_VOICE_API_ID }}",
              "dockerfile": "'"$(base64 -w0 < voice-api.dockerfile)"'"
            }'
```

---

## Acceptance Criteria

| # | Critério | Teste |
|---|----------|-------|
| AC-1 | voice-api responde em `:8202` | `curl http://localhost:8202/health` → `{"status":"ok"}` |
| AC-2 | OpenClaw consegue chamar voice-api | `docker exec openclaw curl -sf http://10.0.19.x:8202/health` |
| AC-3 | subdomain `voice-api.zappro.site`resolve | `curl -sf https://voice-api.zappro.site/health` |
| AC-4 | Transcription funciona | `curl -X POST :8202/v1/audio/transcriptions -F "file=@audio.wav" -F "model=wav2vec2"` |
| AC-5 | Ollama enhancement funciona | resposta inclui "ENTENDI:" |

---

## Referências

- `docs/OPERATIONS/SKILLS/voice-api.py`
- `docs/OPERATIONS/SKILLS/tts-bridge.py` (mesmo padrão)
- `docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md`

---

**Data:** 2026-04-09
