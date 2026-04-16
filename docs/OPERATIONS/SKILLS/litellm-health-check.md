# Skill: LiteLLM Health Check

**Purpose:** Verificar salud do LiteLLM (proxy LLM — Ollama + OpenRouter)
**Complexity:** Low
**Risk:** Read-only
**When to Use:** Check regular, antes de benchmarking, após mudanças de config

## LiteLLM Info

- **Endpoint:** `localhost:4000` (direct)
- **Tipo:** Docker container (`zappro-litellm`) via docker-compose
- **Container rede:** `zappro-lite_default` (mesma do wav2vec2, Ollama, Kokoro)
- **Config:** `/home/will/zappro-lite/config.yaml`
- **Models:** whisper-1 (STT/faster-whisper), tts-1 (TTS/Kokoro), qwen2.5vl:7b (Vision), Gemma4-12b-it (LLM PT-BR), embedding-nomic
- **Database:** PostgreSQL via `zappro-litellm-db` container (persistência de keys/costs)
- **DB Connection:** `postgresql://litellm:litellm_pass_2026@zappro-litellm-db:5432/litellm`

## Procedure

### 1. Process Status

```bash
ps aux | grep litellm | grep -v grep
```

**Expected:** linha com `litellm --config ...` | **FAIL:** vazio

### 2. Port Listening

```bash
ss -tlnp | grep 4000
```

**Expected:** `127.0.0.1:4000` | **FAIL:** sem output

### 3. API Health (com mock key)

```bash
curl -s -H "Authorization: Bearer sk-test" http://localhost:4000/health 2>&1
```

**Possible responses:**

- `{"status":"ok","models":[...]} ` → ✅ OK
- `{"error":{"message":"No connected db.",...}}` → ⚠️ DB error mas funcional (sem persistence)
- Connection refused → 🔴 LiteLLM down

### 4. List Models

```bash
curl -s -H "Authorization: Bearer sk-test" http://localhost:4000/model/list 2>&1 | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data = d.get('data', d.get('models', []))
    if isinstance(data, list):
        print(f'Models: {len(data)}')
        [print(f'  {m.get(\"model_name\", m.get(\"model_name\", \"?\"))}') for m in data[:5]]
    else:
        print(d)
except: print(sys.stdin.read()[:200])
"
```

### 5. Test Completion (Ollama fallback)

```bash
curl -s -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test" \
  -d '{"model":"gemma3-27b","messages":[{"role":"user","content":"hi"}],"max_tokens":5}' \
  2>&1 | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('choices'):
        print('✅ gemma3-27b via Ollama OK')
    elif 'error' in d:
        print('🔴 Error:', d['error'].get('message','')[:100])
except: print('🔴 FAIL:', sys.stdin.read()[:100])
"
```

### 6. Test OpenRouter (se Ollama down)

```bash
curl -s -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test" \
  -d '{"model":"nemotron-3-super","messages":[{"role":"user","content":"hi"}],"max_tokens":5}' \
  2>&1 | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('choices'): print('✅ OpenRouter fallback OK')
    elif 'error' in d: print('🔴 Error:', d['error'].get('message','')[:80])
except: print(sys.stdin.read()[:100])
"
```

## Output Format

```
LITELLM HEALTH CHECK — $(date -u '+%Y-%m-%d %H:%M UTC')
=========================================================
PROCESS:     ✅ litellm pid=1771726
PORT:         ✅ 127.0.0.1:4000
NGINX:        ✅ 127.0.0.1:4004 (rate-limited proxy)
HEALTH:       ✅ OK (no_db normal)
MODELS:       ✅ 6 configured
OLLAMA TEST:  ✅ gemma3-27b OK
RESULTADO:    ✅ SAUDÁVEL
```

### 7. Rate-Limited Proxy Test (nginx on :4004)

```bash
# Teste rate limiting - primeiros 5-6 devem passar, depois 503
count=0; limited=0
for i in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:4004/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer [LITELLM_API_KEY]" \
    -d '{"model":"gemma3-27b","messages":[{"role":"user","content":"hi"}],"max_tokens":5}')
  count=$((count+1))
  if [ "$code" = "503" ]; then limited=$((limited+1)); fi
  sleep 0.3
done
echo "Rate limited (503): $limited / $count"
```

**Expected:** Primeiros 5-6 = 200, depois 503. Se todos 200 = rate limiting não funciona.

## Common Failures

| Symptom            | Cause                       | Fix                                              |
| ------------------ | --------------------------- | ------------------------------------------------ |
| Connection refused | Process down                | `sudo systemctl start litellm` ou reiniciar venv |
| 401 auth error     | API key wrong               | Verificar `sk-test` ou key real                  |
| Ollama timeout     | Ollama não responde         | Verificar `ollama-health-check.md`               |
| all fallbacks fail | OpenRouter API key inválido | Verificar `OPENROUTER_API_KEY` no .env           |

## See Also

- `ollama-health-check.md` — Ollama (upstream de LiteLLM)
- `kokoro-health-check.md` — Kokoro TTS
