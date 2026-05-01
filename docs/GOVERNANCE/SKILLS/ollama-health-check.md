# Skill: Ollama Health Check

**Purpose:** Verificar salud do Ollama (LLM local + embeddings)
**Complexity:** Low
**Risk:** Read-only (apenas consultas HTTP e leitura de processos)
**When to Use:** Check regular, antes de pedir LLM, após problemas de VRAM

## Ollama Info

- **Endpoint:** `localhost:11434`
- **Tipo:** Service systemd (`ollama.service`)
- **VRAM:** GPU partilhada com outros containers
- **Models:** gemma3:27b-it-qat, shieldgemma:9b, nomic-embed-text

## Procedure

### 1. Service Status

```bash
systemctl is-active ollama
systemctl status ollama --no-pager
```

**Expected:** `active (running)` | **FAIL:** `inactive` ou `failed`

### 2. API Health

```bash
curl -s http://localhost:11434/api/tags 2>&1 | python3 -c "
import json,sys
d=json.load(sys.stdin)
models = d.get('models',[])
print(f'Models loaded: {len(models)}')
for m in models:
    size_gb = m.get('size',0)/1e9
    print(f'  {m[\"name\"]} ({size_gb:.1f}GB)')
"
```

**Expected:** ≥1 model | **FAIL:** empty array ou connection refused

### 3. VRAM Usage

```bash
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader
```

**Reference:**
- gemma3:27b-it-qat: ~18GB VRAM
- shieldgemma:9b: ~5GB VRAM
- nomic-embed-text: ~274MB

### 4. Loaded Models (which are in VRAM now)

```bash
curl -s http://localhost:11434/api/ps 2>&1 | python3 -c "
import json,sys
d=json.load(sys.stdin)
models = d.get('models',[])
if models:
    print('Models in VRAM:')
    for m in models:
        print(f'  {m[\"name\"]}')
else:
    print('Nenhum modelo em VRAM (lazy loading)')
"
```

### 5. Test Generate (lightweight)

```bash
curl -s http://localhost:11434/api/generate \
  -d '{"model":"nomic-embed-text","prompt":"test","stream":false}' \
  2>&1 | python3 -c "import json,sys; d=json.load(sys.stdin); print('✅ Generate OK' if 'embedding' in str(d) or d.get('done') else '🔴 FAIL')"
```

## Output Format

```
OLLAMA HEALTH CHECK — $(date -u '+%Y-%m-%d %H:%M UTC')
=====================================================
SERVICE:     ✅ active (running)
MODELS:      ✅ 3 loaded (gemma3:27b, shieldgemma, nomic)
VRAM:        19.2GB used / 24.0GB free
IN VRAM:     gemma3:27b-it-qat
GENERATE:    ✅ OK
RESULTADO:   ✅ SAUDÁVEL
```

## Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Connection refused | Ollama stopped | `sudo systemctl start ollama` |
| Empty models list | Service starting | Wait 10s, retry |
| OOM errors | VRAM full | Stop other GPU containers |
| 404 on /api/generate | Model not in VRAM | `curl -X POST http://localhost:11434/api/pull -d '{"name":"gemma3:27b-it-qat"}'` |

## See Also

- `litellm-health-check.md` — LiteLLM proxy (uses Ollama)
- `kokoro-health-check.md` — Kokoro TTS
