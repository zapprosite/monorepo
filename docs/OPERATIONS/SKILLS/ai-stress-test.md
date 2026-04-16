# Skill: AI Stack Stress Test

**Purpose:** Stress test completo da AI stack — AI Router + Ollama + OpenRouter + LiteLLM
**Complexity:** Medium
**Risk:** Medium (stress test pode causar rate limiting temporário em APIs externas)
**When to Use:** Após mudanças de config, monthly health check, validação de rate limits e routing

---

## AI Stack Info

| Service       | Endpoint             | Model                                  | Rate Limit  |
| ------------- | -------------------- | -------------------------------------- | ----------- |
| **AI Router** | localhost:4005       | gemma4-12b-it (local), openrouter/free | N/A         |
| Ollama        | localhost:11434      | gemma4-12b-it                          | N/A (local) |
| OpenRouter    | openrouter.ai/api/v1 | nemotron-nano-9b-v2:free               | varies      |
| nginx proxy   | localhost:4004       | rate limited → :4000                   | 10 req/min  |
| LiteLLM       | localhost:4000       | gemma3-27b                             | 10 RPM      |
| Kokoro TTS    | localhost:8012       | af_bella                               | N/A (local) |

---

## Routing Logic (AI Router)

```
Query → AI Router (:4005)
  ├── len < 30 chars → local (Ollama gemma4-12b-it)
  ├── [complex, debug, architecture] → cloud-budget (OpenRouter free)
  ├── [production, security, incident] → cloud-reasoning (OpenRouter free)
  └── else → LLM-assisted classification
```

---

## Procedure

### 1. Preflight Check

```bash
# AI Router alive
curl -s http://localhost:4005/health

# Ollama alive
curl -s http://localhost:11434/api/tags | python3 -c "import json,sys; d=json.load(sys.stdin); [print(m['name']) for m in d.get('models',[])]"

# VRAM antes
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader
```

### 2. AI Router — Local Tier (Simple Query)

```bash
echo "=== AI Router: local tier (simple query) ==="
curl -s -X POST http://localhost:4005/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"2+2=?"}],"stream":false}'
```

**Expected:** Resposta rápida do Ollama local (~1-2s)

### 3. AI Router — Cloud Tier (Complex Query)

```bash
echo "=== AI Router: cloud tier (complex query) ==="
curl -s -X POST http://localhost:4005/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Debug this complex Python code with multiple files and architecture decisions"}],"stream":false}'
```

**Expected:** Resposta do OpenRouter free tier (~3-5s)

### 4. AI Router — Parallel Stress (10 requests local)

```bash
echo "AI Router stress test - 10 parallel simple queries..."
time for i in $(seq 1 10); do
  curl -s -X POST http://localhost:4005/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"Hi"}],"stream":false}' &
done
wait
echo "AI Router local: 10/10 completed"
```

### 5. Ollama Direct Stress (10 pedidos paralelos)

```bash
echo "Ollama direct stress test - 10 parallel requests..."
time for i in $(seq 1 10); do
  curl -s http://localhost:11434/api/chat \
-d '{"model":"gemma4-12b-it","messages":[{"role":"user","content":"Say HI"}],"stream":false}' &
done
wait
echo "Ollama direct: 10/10 completed"
```

### 6. nginx Rate Limit Proxy (4004 → 4000)

```bash
AUTH="Authorization: Bearer [LITELLM_API_KEY]"
MODEL='{"model":"gemma3-27b","messages":[{"role":"user","content":"Hi"}],"max_tokens":10}'

echo "nginx rate limit test (4004 → 4000)..."
count=0; limited=0
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:4004/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$MODEL")
  count=$((count+1))
  if [ "$code" = "429" ]; then limited=$((limited+1)); fi
  echo "Request $count: HTTP $code"
  sleep 0.5
done
echo "Rate limited (429): $limited / $count"
```

**Expected:** 429 após ~10 pedidos (RPM limit ativo no nginx)

### 7. OpenRouter Direct (via AI Router routing)

```bash
echo "OpenRouter via AI Router - 3 requests..."
for i in $(seq 1 3); do
  echo "Request $i:"
  time curl -s -X POST http://localhost:4005/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"Explain quantum computing in 2 sentences"}],"stream":false}' \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('model','?'), '|', d.get('choices',[{}])[0].get('message',{}).get('content','?')[:80])" 2>/dev/null || echo "parse error"
done
```

### 8. VRAM Check

```bash
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader
```

---

## Output Format

```
AI STACK STRESS TEST — $(date -u '+%Y-%m-%d %H:%M UTC')
=================================================================
AI ROUTER:    ✅ local tier OK | ✅ cloud tier OK
OLLAMA:       ✅ 10/10 OK (X seconds)
OPENROUTER:   ✅ responses OK (model: nemotron-nano-9b-v2:free)
NGINX RL:     ✅ rate limited: X/15 (429)
KOKORO TTS:   ✅ 5/5 OK (X seconds)
VRAM:         XMiB / 24564MiB used
=================================================================
RESULTADO:    ✅ SAUDÁVEL / ⚠️ RATE_LIMITED / 🔴 FAILED
```

---

## Routing Verification

Verificar logs do AI Router para confirmar routing:

```bash
# AI Router logs (se rodando em foreground)
# Olhar output de: /home/will/ai-router/start.sh

# Confirmar tier usado
curl -s -X POST http://localhost:4005/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Design a distributed system"}],"stream":false}' \
  2>&1 | grep -i "openrouter\|ollama\|model"
```

---

## Interpretação

| Result             | Significado                                              |
| ------------------ | -------------------------------------------------------- |
| AI Router local OK | Queries simples estão sendo respondidas por Ollama local |
| AI Router cloud OK | Queries complexas estão sendo roteadas para OpenRouter   |
| Ollama 10/10 OK    | Ollama aguenta carga local sem problemas                 |
| nginx 429 após ~10 | Rate limit do nginx proxy está a funcionar               |
| VRAM < 20GB        | Carga normal para gemma4-12b-it                          |

---

## Common Issues

| Symptom          | Cause                                    | Fix                                  |
| ---------------- | ---------------------------------------- | ------------------------------------ |
| AI Router 500    | Ollama timeout ou indisponível           | `curl localhost:11434/api/tags`      |
| AI Router slow   | Query classificada como cloud por engano | Ver logs de complexidade             |
| Ollama timeout   | Modelo a carregar                        | `ollama pull gemma4-12b-it`          |
| nginx always 429 | Rate limit muito agressivo               | Ajustar `burst` em nginx config      |
| OpenRouter 401   | API key inválida                         | Verificar OPENROUTER_API_KEY em .env |
| VRAM OOM         | Many models loaded                       | `ollama ps` para ver modelos         |

---

## See Also

- `ollama-health-check.md` — Ollama detalhado
- `litellm-health-check.md` — LiteLLM detalhado
- `kokoro-health-check.md` — Kokoro TTS detalhado
- AI Router: `/home/will/ai-router/router.py`
