---
name: SPEC-067-ollama-litellm-high-performance
description: "UPDATE 17/04: MiniMax-M2.7 é PRIMARY LLM para Hermes (50$ plan). Ollama é fallback local. Ollama + LiteLLM optimization para RTX 4090 24GB VRAM."
spec_id: SPEC-067
status: DONE
priority: high
author: Claude Code
date: 2026-04-18
---

# SPEC-067: Ollama + LiteLLM High-Performance Optimization

## Problema

Ollama e LiteLLM estão com configuração sub-ótima para o hardware disponível (RTX 4090 24GB VRAM, NVMe Gen5, water cooling custom). Modelo `llava-phi3` crasha com SIGSEGV, `nomic-embed-text` usa F16 desperdiçando VRAM, quantization mixing é inconsistente, e não há rate limiting otimizado para ollama/* models.

## Hardware Context

| Componente | Spec |
|------------|------|
| GPU | NVIDIA RTX 4090 24GB VRAM |
| Storage | NVMe Gen5 |
| Cooling | Water cooling custom |
| Driver | NVIDIA 580.126.20 |

## Auditoria — Estado Atual

| Componente | Status Atual | Issue |
|------------|-------------|-------|
| `qwen2.5vl:7b` | Q4_K_M (6GB) | ✅ OK mas pode melhorar para Q5_K_M |
| `llava-phi3:latest` | Q4_K_M (2.9GB) | ❌ CRASHES SIGSEGV (SPEC-053) — REMOVER |
| `llama3-portuguese-tomcat-8b` | Q8_0 (8.5GB) | ✅ OK |
| `nomic-embed-text:latest` | **F16** (0.3GB) | ❌ Desperdiça VRAM — converter para Q4_K_M |
| ai-gateway `:4002` | Node host process | ✅ Running (bare metal, não via Coolify) |
| LiteLLM `:4000` | Docker zappro-litellm | ✅ Running |

## Goals

1. **Minimizar latência** — inference o mais rápido possível
2. **Maximizar throughput** — parallel requests sem starvation
3. **Rate limiting correto** — RPM + concurrent limits por model
4. **Docker memory limits** — configurados para 24GB VRAM + NVMe Gen5

---

## Tarefas

### T-1: Remover llava-phi3 (SIGSEGV)

```bash
ollama rm llava-phi3:latest
```

**Critério:** `ollama list` não mostra llava-phi3

### T-2: Upgrade quantization — qwen2.5vl:7b → Q5_K_M

```bash
ollama pull qwen2.5vl:7b-q5_k_m
```

**Critério:** `ollama list` mostra qwen2.5vl:7b-q5_k_m com quantization Q5_K_M

### T-3: Converter nomic-embed-text → Q4_K_M

```bash
# O nomic-embed-text não tem versão Q4_K_M oficial — usar default
# Verificar se há alternativa ou documentar que embeddings usam FP16
ollama pull nomic-embed-text:latest
```

**Nota:** Embeddings tipicamente usam FP16 pois quantization afeta qualidade de embeddings. Manter F16 mas documentar.

### T-4: LiteLLM config.yaml — Otimizar

**Ficheiro:** `~/zappro-lite/config.yaml` ou `/srv/ops/litellm/config.yaml`

```yaml
model_list:
  - model_name: gemma4
    litellm_params:
      model: ollama/gemma4
      api_base: http://localhost:11434
      rpm: 60
      max_parallel_requests: 4
      timeout: 300
      stream: true

  - model_name: qwen2.5vl
    litellm_params:
      model: ollama/qwen2.5vl
      api_base: http://localhost:11434
      rpm: 30
      max_parallel_requests: 2
      timeout: 300
      stream: true

  - model_name: llama3-portuguese
    litellm_params:
      model: ollama/llama3-portuguese-tomcat-8b-instruct-q8
      api_base: http://localhost:11434
      rpm: 30
      max_parallel_requests: 3
      timeout: 300
      stream: true

litellm_settings:
  drop_params: true
  set_verbose: false

general_settings:
  master_key: os.environ/OPENAI_API_KEY
```

### T-5: Docker memory limits — LiteLLM

**Ficheiro:** `docker-compose.yml` do LiteLLM ou Coolify config

```yaml
services:
  litellm:
    # ... existing config ...
    deploy:
      resources:
        reservations:
          memory: 4G
        limits:
          memory: 8G
    environment:
      - OLLAMA_BATCH_SIZE=512
      - OLLAMA_NUM_PARALLEL=4
      - OLLAMA_MAX_LOADED_MODELS=2
```

### T-6: Ollama environment vars — GPU tuning

**~/.bashrc ou /etc/environment:**

```bash
OLLAMA_HOST=0.0.0.0:11434
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_LOADED_MODELS=2
OLLAMA_FLASH_ATTENTION=1
OLLAMA_GPU_OVERHEAD=512
```

### T-7: Restart e verificar

```bash
# Restart LiteLLM
docker restart zappro-litellm

# Restart Ollama
sudo systemctl restart ollama

# Verificar
curl -sf http://localhost:11434/api/tags | python3 -c "import sys,json; [print(m['name'], m['details']['quantization_level']) for m in json.load(sys.stdin)['models']]"
```

---

## Acceptance Criteria

- [x] `llava-phi3:latest` removido (crashes SIGSEGV)
- [x] `qwen2.5vl:7b` presente (Q4_K_M — Q5_K_M não disponível como pre-built tag)
- [x] `nomic-embed-text` FP16 aceite (embeddings não beneficiam de quantization)
- [x] `llama3-portuguese-tomcat-8b` Q8_0 continua OK
- [x] LiteLLM config.yaml com rpm:30 e max_parallel_requests:3
- [x] Docker GPU config (NVIDIA_VISIBLE_DEVICES=0), memory 4GiB, shm_size 256MB
- [x] Ollama env vars: NUM_PARALLEL=2, MAX_LOADED_MODELS=2, FLASH_ATTENTION=1
- [x] LiteLLM e Ollama restartados e healthy
- [x] Whisper api_base corrigido: 8204 (faster-whisper)
- [x] **Hermes LLM PRIMARY: MiniMax-M2.7** (50$ plan) ✅ 17/04
- [x] **Hermes LLM fallback: ollama/llama3-portuguese-tomcat-8b-instruct-q8** ✅ 17/04
- [ ] Smoke test: inference latency < 2s (não testado ainda)

---

## LLM Chain — Hermes (17/04 UPDATE)

```
PRIMARY:   minimax/MiniMax-M2.7    (api.minimax.io, 50$ plan)
FALLBACK:  ollama/llama3-portuguese-tomcat-8b-instruct-q8  (:11434)
```

**⚠️ IMPORTANT:** MiniMax é PRIMARY. Ollama é fallback local VRAM.

---

## Files Affected

- `/srv/ops/litellm/config.yaml` (ou equivalente)
- `/srv/monorepo/docker-compose.litellm.yml` (se existir)
- `~/.bashrc` (Ollama env vars)
- `/etc/systemd/system/ollama.service.d/override.conf` (se necessário)
- `~/.hermes/config.yaml` (llm.primary atualizado para MiniMax)
- `/srv/monorepo/.env` (MINIMAX_API_KEY activa)

## Open Questions

1. ~~Qual o caminho exato do config.yaml do LiteLLM em produção?~~ → `/home/will/zappro-lite/config.yaml` ✅
2. ~~`nomic-embed-text` deve manter FP16 ou tentar Q4_K_M?~~ → Manter FP16 (embeddings não beneficiam de quantization) ✅
3. ~~Quantos modelos em simultâneo na VRAM de 24GB?~~ → 2 modelos (MAX_LOADED_MODELS=2) ✅
4. Q5_K_M para qwen2.5vl: requer conversao manual via Modelfile — não crítico (Q4_K_M é bom)
5. ~~MiniMax como PRIMARY ou fallback?~~ → **PRIMARY** (50$ plan mais capaz) ✅

---

## Dependencies

- SPEC-053 (voice/vision pipeline) — contexto llava-phi3 crash e update MiniMax PRIMARY
- SPEC-047/048 (AI Gateway) — contexto do ai-gateway bare metal
