# INCIDENT-2026-04-08: LiteLLM STT Route Network Isolation

**Data:** 2026-04-08
**Severidade:** 🔴 HIGH
**Tipo:** Infraestrutura / Network Isolation
**Status:** ✅ RESOLVIDO

---

## Sumário

Smoke test do voice pipeline (`pipeline-openclaw-voice.sh`) morria com **exit 137 (SIGKILL)** durante teste de STT via LiteLLM. O smoke test ficava travado indefinidamente no endpoint `/v1/audio/transcriptions` com modelo `whisper-1`, nunca completando.

---

## Timeline

| Hora | Evento |
|------|--------|
| 08:14 | wav2vec2 API inicia como processo nativo do host (`python3 wav2vec2_api.py`) na porta 8201 |
| 09:26 | Smoke test detecta problema — exit 137 no teste 2.3 (STT via LiteLLM) |
| 09:30 | Investigação começa — subprocess é morto por SIGKILL após timeout implícito |
| 09:35 | LiteLLM `/v1/audio/transcriptions` retorna timeout — endpoint nunca completa |
| 09:40 | Teste direto do wav2vec2 em `localhost:${WAV2VEC2_PORT:-8201}` funciona (0.8s) |
| 09:45 | LiteLLM em chat completions funciona — problema é específico do endpoint de audio |
| 09:50 | LiteLLM não recebe sequer o request — POST não aparece nos logs |
| 09:55 | Container LiteLLM não consegue TCP em `10.0.2.1:8201` (timeout) |
| 10:00 | Ping para `10.0.2.1` funciona do container — conectividade IP existe |
| 10:02 | wav2vec2 nativo morre, `whisper_api.py` ocupa porta 8201 |
| 10:05 | `whisper_api.py` morto, porta 8201 liberada |
| 10:06 | Container `zappro-wav2vec2` iniciado na network `zappro-lite_default` |
| 10:07 | Container wav2vec2 com modelo carregado no GPU — LiteLLM alcança via `http://wav2vec2:8201` |
| 10:10 | STT via LiteLLM funciona — HTTP 200, transcrição `"olá como vai você"` |
| 10:12 | Smoke test completo — 9/11 passed, 2 failures (OpenClaw Gateway已知 issue) |
| 10:15 | Fix `:ro` no volume do transformers cache removido (caching quebrado) |
| 10:18 | `wav2vec2-health-check.md` atualizado para refletir arquitetura containerizada |

---

## Root Cause

**Causa Raiz — 5 Porquês:**

1. **Por que o LiteLLM não consegue alcançar `10.0.2.1:8201`?** → Timeout no TCP handshake
2. **Por que só falha para portas 4000/8201?** → Portas de serviços nativos do host não expostas na bridge Docker
3. **Por que 8000 (Coolify) funciona mas 8201 não?** → Coolify é container Docker com porta mapeada na bridge; wav2vec2 é processo nativo Python
4. **Por que não é UFW genérico?** → Portas baixas (22, 80) e Docker (8000) funcionam do container
5. **Por que?** → O tráfego Docker bridge para portas de processos nativos do host em redes bridge (`br-67b37163c04b`) é interceptado/bloqueado de forma não convencional — diferente de portas expostas por containers Docker padrão

**Teste de conectividade do container LiteLLM (`zappro-litellm`):**

| Porta | Serviço | Do container |
|-------|---------|-------------|
| 22 | SSH | ✅ OK |
| 80 | HTTP | ✅ OK |
| 8000 | Coolify | ✅ OK (container Docker) |
| 4000 | LiteLLM (host) | ❌ TIMEOUT |
| ${WAV2VEC2_PORT:-8201} | wav2vec2 (host) | ❌ TIMEOUT |

**Padrão identificado:** portas de serviços **Docker** = OK. Portas de serviços **nativos do host** = TIMEOUT.

> **Nota:** Os valores de IP hardcoded (e.g. `10.0.2.1:8201`) sao valores historicos do incidente. Em producao, usar variaveis de ambiente: `${WAV2VEC2_HOST}`, `${WAV2VEC2_PORT}`, `${HOST_IP}`.

---

## O que Nos Impedia de Ver o Problema

| Sintoma | Por que era enganoso |
|--------|---------------------|
| `curl localhost:${WAV2VEC2_PORT:-8201}` funciona do host | O teste no host usa loopback, não passa pela bridge Docker |
| `ping 10.0.2.1` funciona do container | ICMP funciona (echo request/reply), mas TCP em portas específicas não |
| LiteLLM responde em chat completions | rotas Ollama/Kokoro usam IPs de containers Docker (`10.0.1.x`, `10.0.2.x`), não o IP do host |
| `docker ps` mostra LiteLLM rodando | container está no ar, mas a rota interna para `10.0.2.1:8201` é que estava quebrada |
| Exit 137 (SIGKILL) |bash timeout interno mata o curl que nunca completa, não é OOM como parecia |

---

## Lessons Learned

### O que aprendemos
- Container Docker em bridge mode não consegue TCP para portas de processos nativos do host em redes bridge arbitrárias, mesmo quando ping funciona
- A rota STT do LiteLLM para `10.0.2.1:8201` nunca funcionou em produção — o endpoint só parecia funcionar porque o smoke test era morto antes de demonstrar o erro
- Ollama e Kokoro funcionam porque são containers Docker com IPs na mesma bridge (`10.0.1.x`, `10.0.2.x`) — mesma subnet do LiteLLM

### O que poderia ter evitado
- Teste de conectividade de rede do container para serviços internos deveria estar no smoke test
- A rota STT nunca foi testada end-to-end antes (só funcionava "aparentemente" porque era matado por timeout)
- Ausência de health check específico para rotas LiteLLM → serviços internos

---

## Fixes Implementados

### 1. Containerização do wav2vec2
**Ficheiro:** `/home/will/zappro-lite/docker-compose.yml`

Adicionado serviço `wav2vec2` ao docker-compose com:
- GPU NVIDIA via `deploy.resources.reservations.devices`
- Network `zappro-lite_default` (mesma do LiteLLM)
- Volume mount do HuggingFace cache (modelo pré-carregado)
- Health check via curl
- Dependência do LiteLLM (`depends_on` com `condition: service_healthy`)

### 2. Atualização do config.yaml
**Ficheiro:** `/home/will/zappro-lite/config.yaml`

```yaml
# ANTES (hardcoded):
api_base: http://${HOST_IP}:${WAV2VEC2_PORT:-8201}/v1
# DEPOIS (containerizado):
api_base: http://${WAV2VEC2_HOST:-wav2vec2}:${WAV2VEC2_PORT:-8201}/v1
```

### 3. Dockerfile wav2vec2 rewrite
**Ficheiro:** `/home/will/Desktop/voice-pipeline/wav2vec2.dockerfile`

Rewritten com:
- Base `nvidia/cuda:12.4.1-runtime-ubuntu22.04`
- Python 3.11 + pip + torch GPU + transformers
- HEALTHCHECK CMD

### 4. Fix volume mount (simplify phase)
**Ficheiro:** `/home/will/zappro-lite/docker-compose.yml`

Removido `:ro` do volume do transformers cache — transformers precisa escrever para caching.

### 5. Documentação health-check atualizada
**Ficheiro:** `/srv/monorepo/docs/OPERATIONS/SKILLS/wav2vec2-health-check.md`

Atualizado para refletir arquitetura containerizada (processo host → container Docker).

---

## Prevenção Futura

- [ ] **Teste de conectividade Docker no smoke test** — adicionar passo que testa `docker exec zappro-litellm curl http://wav2vec2:8201/health` antes de testar rotas LiteLLM
- [ ] **Verificar todas as rotas LiteLLM** — todas as rotas (TTS, STT, VL, LLM) devem ser testadas end-to-end no smoke test, não apenas "funciona do host"
- [ ] **Documentar IPs de serviços internos** — todos os serviços que o LiteLLM routing deve alcançar devem ser containers Docker na mesma network
- [ ] **Health check integrado** — antes de usar `api_base` no LiteLLM, verificar que o target é alcançável do container LiteLLM

---

## Stack Final (Pós-Fix)

| Componente | Host Port | Container/Internal | Via LiteLLM | Status |
|------------|-----------|-------------------|-------------|--------|
| wav2vec2 STT | ${WAV2VEC2_EXPOSE_PORT:-8202} | ${WAV2VEC2_HOST:-wav2vec2}:${WAV2VEC2_PORT:-8201} | whisper-1 | ✅ |
| Kokoro TTS | — | ${KOKORO_HOST:-10.0.2.4}:${KOKORO_PORT:-8880} | tts-1 | ✅ |
| Ollama (VL) | — | ${OLLAMA_HOST:-10.0.1.1}:${OLLAMA_PORT:-11434} | qwen2.5-vl | ✅ |
| Ollama (LLM) | — | ${OLLAMA_HOST:-10.0.1.1}:${OLLAMA_PORT:-11434} | tom-cat-8b | ✅ |
| LiteLLM | ${LITELLM_PORT:-4000} | — | — | ✅ |

---

**Registrado:** 2026-04-08
**Autor:** will (Claude Code)
**Proxima revisão:** 2026-05-08 (+30 dias)
