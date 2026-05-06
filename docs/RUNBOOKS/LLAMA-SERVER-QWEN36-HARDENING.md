# Runbook — Llama Server Qwen 3.6 Hardened

**Data:** 2026-05-06
**Escopo:** `llama-qwen36.service`, `nomic-embed-cpu.service`, LiteLLM `:4018`

## Objetivo

Operar `Qwen3.6-27B-UD-Q4_K_XL` com throughput alto e previsível em host com:

- RTX 4090 24GB
- Ryzen 9 7900X
- 32GB RAM
- NVMe Gen5

Com sobra máxima para KV cache, sem swap agressivo e sem WebUI exposta.

## Base técnica

Referência primária: `ggml-org/llama.cpp` `tools/server/README.md` consultado em 2026-05-06.

Flags confirmadas na build local `llama.cpp version 9037`:

- `--threads`
- `--threads-batch`
- `--ctx-size`
- `--batch-size`
- `--ubatch-size`
- `--parallel`
- `--cont-batching`
- `--flash-attn`
- `--fit`
- `--fit-target`
- `--cache-type-k`
- `--cache-type-v`
- `--metrics`
- `--slots`
- `--no-webui`
- `--timeout`
- `--reasoning-format`

## Perfil aplicado

### Qwen 3.6 GPU

- `ctx-size nominal=16384`
- `ctx-size efetivo atual=8192` via `--fit`
- `threads=12`
- `threads-batch=24`
- `parallel=2`
- `cont-batching=on`
- `batch-size=2048`
- `ubatch-size=512`
- `flash-attn=on`
- `fit=on`
- `fit-target=2048`
- `fit-ctx=8192`
- `cache-type-k=q8_0`
- `cache-type-v=q8_0`
- `metrics=on`
- `slots=on`
- `webui=off`
- `presence_penalty` ainda não foi forçado; a doc oficial da Qwen sugere `1.5` para quantizados, mas isso deve ser validado em benchmark de código antes de virar default global

### Nomic CPU

- `ctx-size nominal=8192`
- `ctx-size efetivo atual=2048`
- `threads=8`
- `threads-batch=16`
- `parallel=2`
- `batch-size=2048`
- `ubatch-size=512`
- `embedding=on`
- `metrics=on`
- `slots=on`
- `webui=off`

## Racional

### Por que `16384` no Qwen

O host atual tem 32GB RAM e já mostrava swap ativo. `24576` consumia RAM demais e reduzia a folga do KV cache sob concorrência. `16384` foi usado como alvo, mas o `--fit` reduziu o runtime para `8192`, que é o valor estável atual com maior sobra para KV cache e batching contínuo.

Isso deixa mais memória livre para:

- KV cache útil
- batching contínuo
- LiteLLM
- SO e page cache do NVMe

### Por que `parallel=2`

Com 32GB RAM, `4` slots automáticos eram agressivos demais para um 27B. `2` dá concorrência suficiente sem esmagar contexto por slot nem inflar fragmentação.

### Por que `batch=2048` e `ubatch=512`

É um ponto conservador e rápido para 4090. Sobe throughput de prompt sem empurrar o host para instabilidade.

### Por que `no-webui`

O backend canônico é LiteLLM. WebUI no backend local só aumenta superfície de ataque e ruído operacional.

## Hardening de serviço

Aplicado via `systemd override.conf`:

- `NoNewPrivileges=yes`
- `PrivateTmp=yes`
- `ProtectControlGroups=yes`
- `ProtectKernelModules=yes`
- `ProtectKernelTunables=yes`
- `RestrictSUIDSGID=yes`
- `LockPersonality=yes`
- `MemoryDenyWriteExecute=yes`
- `RestrictRealtime=yes`
- `RemoveIPC=yes`
- `UMask=0077`

## Smoke tests

```bash
curl -sf http://localhost:8001/health
curl -sf http://localhost:8001/props | jq '{slots:.total_slots,ctx:.default_generation_settings.n_ctx,metrics:.endpoint_metrics,webui:.webui}'
curl -sf http://localhost:8002/health
curl -sf http://localhost:8002/props | jq '{slots:.total_slots,ctx:.default_generation_settings.n_ctx,metrics:.endpoint_metrics,webui:.webui}'
```

## Canonical stack

- `llama.cpp / llama-server` é o caminho principal local.
- `Qwen3.6-27B-UD-Q4_K_XL` em `:8001` é o LLM canônico.
- `nomic-embed-cpu` em `:8002` roda sem VRAM (`-ngl 0`).
- `LiteLLM :4018` é o único gateway LLM canônico.
- `Ollama :11434` fica apenas como backup manual.
- `vLLM` saiu do plano principal em `2026-05-06`; `:4020` deve permanecer livre.

## Teste via Nexus

```bash
set -a
source /srv/monorepo/.env >/dev/null 2>&1
export LITELLM_URL=http://localhost:4018
export NEXUS_LOCAL_CODE=nexus-local-code
export NEXUS_LOCAL_FAST=nexus-auto
set +a

nexus classify "validate local llama-server routing" -f /srv/nexus/nexus/executor.py
nexus run -d "reply exactly ok" -f /srv/nexus/nexus/executor.py
```

## Regras operacionais

- `:8001` e `:8002` continuam privados.
- Gateway de produção continua sendo LiteLLM `:4018`.
- Ollama não volta para o caminho crítico de chat/code.
- `vLLM` permanece arquivado e não canônico; só pode voltar com novo A/B e decisão explícita.
- Se swap crescer sob carga, reduzir `ctx-size` do Qwen para `12288`.
- Auditoria em `2026-05-06`: para o hardware atual, os principais ganhos já aplicados em `llama-server` foram `flash-attn`, `continuous batching`, `slots`, `metrics`, `fit`, `KV q8_0`, `webui off` e hardening do `systemd`.

## Fronteira não aplicada

Itens conhecidos em `2026-05-06` que podem render mais throughput, mas não entram no perfil estável atual:

- `speculative decoding` com modelo drafter dedicado
- forks/patches como `TurboQuant` para KV cache mais agressivo
- contextos muito acima de `8192` em host com `32GB RAM`
- `vLLM` como substituição direta do `llama-server` sem A/B formal

Motivo: aumentam complexidade, risco de regressão ou dependem de pesos/modelos extras fora do stack atual canônico.
- Se o host ficar mais folgado no futuro, testar `fit-target=1536` para tentar recuperar mais contexto sem sacrificar estabilidade.
