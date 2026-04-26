# Skill: Kokoro TTS Health Check

**Purpose:** Verificar salud do Kokoro TTS (text-to-speech)
**Complexity:** Low
**Risk:** Read-only
**When to Use:** Check regular, antes de gerar áudio, após problemas de GPU

## Kokoro Info

- **Container:** `zappro-kokoro` (Docker)
- **Image:** `ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2`
- **Port internal:** `8880`
- **Port exposed:** `127.0.0.1:8012` (nginx proxy: `localhost:4001`)
- **Redis:** `zappro-redis` (cache de vozes)
- **Tipo:** Docker container + Python

## Procedure

### 1. Container Status

```bash
docker ps --filter "name=kokoro" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Expected:** `Up` ou `Up (healthy)` | **FAIL:** `Exited`, `Created`

### 2. Container Health

```bash
docker inspect zappro-kokoro --format '{{.State.Health.Status}}' 2>/dev/null
```

**Expected:** `healthy` | **FAIL:** `starting`, `unhealthy`

### 3. API Health

```bash
curl -s http://localhost:8012/health 2>&1
```

**Expected:** `{"status":"healthy"}` | **FAIL:** connection refused, error

### 4. List Available Voices

```bash
curl -s http://localhost:8012/v1/audio/voices 2>&1 | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if isinstance(d, list):
        print(f'Voices: {len(d)}')
        [print(f'  {v.get(\"name\",\"?\")} ({v.get(\"lang\",\"?\")})') for v in d[:5]]
    else:
        print(d)
except: print('Raw:', sys.stdin.read()[:200])
"
```

### 5. Test TTS (quick)

```bash
curl -s -X POST http://localhost:8012/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"test","voice":"af_bella"}' \
  --output /tmp/test-kokoro.wav 2>&1 && \
ls -lh /tmp/test-kokoro.wav && echo "✅ TTS OK" || echo "🔴 TTS FAIL"
```

### 6. Redis (voice cache)

```bash
docker exec zappro-redis ping 2>&1
```

**Expected:** `PONG` | **FAIL:** connection refused

## Output Format

```
KOKORO TTS HEALTH CHECK — $(date -u '+%Y-%m-%d %H:%M UTC')
=============================================================
CONTAINER:   ✅ zappro-kokoro Up 9h (healthy)
HEALTH:      ✅ {"status":"healthy"}
VOICES:      ✅ 20+ voices available
TTS TEST:    ✅ /tmp/test-kokoro.wav (23KB)
REDIS:       ✅ PONG
RESULTADO:   ✅ SAUDÁVEL
```

## Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Container Exited | GPU CDI unavailable | `docker start zappro-kokoro` + verificar nvidia-smi |
| Connection refused (8012) | Container down | `docker start zappro-kokoro` |
| Empty voices list | API ainda a inicializar | Wait 10s |
| TTS slow | Redis down | Verificar `zappro-redis` |
| 401/403 no endpoint | Nginx proxy sem rota | Verificar `coolify-proxy` ou nginx local |

## See Also

- `ollama-health-check.md` — Ollama (para contexto VRAM partilhada)
- `litellm-health-check.md` — LiteLLM proxy
