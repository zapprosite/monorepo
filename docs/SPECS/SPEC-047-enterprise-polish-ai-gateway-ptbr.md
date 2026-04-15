---
name: SPEC-047-enterprise-polish-ai-gateway-ptbr
description: Polimento enterprise do monorepo + gateway AI (LiteLLM/Ollama) com filtro PT-BR Llama disfarçado de OpenAI e TTS/STT canônicos via Coolify
status: PROPOSED
priority: high
author: Principal Engineer
date: 2026-04-13
deadline: 2026-04-15
specRef: SPEC-009, SPEC-018, SPEC-041, SPEC-046
---

# SPEC-047: Enterprise Polish — AI Gateway PT-BR (OpenAI-compatible facade)

> ⚠️ **SPEC-009 Audio Stack imutável** — STT wav2vec2 :8201 (via proxy Deepgram :8203). TTS Bridge :8013 (vozes `pm_santa`/`pf_dora`). NUNCA trocar.

> ⚠️ **Secrets** — `.env` é fonte canónica ÚNICA. Infisical foi PRUNED (legacy). Proibido Infisical SDK em qualquer código. Proibido hardcode de tokens/keys.

---

## Objective

Elevar o monorepo ao nível enterprise (15/04/2026) consolidando:

1. **AI Gateway OpenAI-compatível** — Fachada única `/v1/chat/completions`, `/v1/audio/speech`, `/v1/audio/transcriptions` servindo clientes externos (Cursor, SDKs OpenAI) enquanto internamente roteia para LiteLLM/Ollama/TTS Bridge/wav2vec2-proxy.
2. **Filtro PT-BR via Llama** — Pipeline obrigatório: resposta do LLM primário → `llama3-portuguese-tomcat-8b-instruct-q8` (Ollama) → normaliza/traduz/limpa → cliente. Latência alvo <400ms overhead.
3. **Disfarce OpenAI** — Headers e schemas 100% compatíveis (`model: "gpt-4o"` aceito como alias). `x-ai-gateway-upstream` apenas em debug.
4. **Coolify polish** — Todos os serviços declarados em docker-compose com labels Coolify, secrets via `.env` sync, health checks, resource limits.
5. **Hardcode zero** — Auditoria completa (`/sec`), nenhum secret in-code, todos via `process.env`.

---

## Scope

### In

- Novo serviço `apps/ai-gateway` (Fastify + tRPC) na porta `4002`
- Middleware de filtro PT-BR (Ollama Llama PT-BR q8)
- Schema OpenAI completo (Zod) para chat/audio
- Coolify deployment manifest (`apps/ai-gateway/docker-compose.yml`)
- `.env` completo com variáveis abaixo (fonte canónica única — Infisical pruned)
- `/sec` audit + pre-commit hook
- Smoke tests `smoke-tests/ai-gateway-openai-compat.sh`
- **Hermes polish** (incorpora SPEC-046 pendente):
  - `HERMES_GATEWAY_URL` corrigido (`10.0.5.2` → `127.0.0.1:8642` — é localhost-bound)
  - `/health` endpoint já OK (`{"status":"ok","platform":"hermes-agent"}`)
  - Adicionar endpoint `GET /ready` (validação downstream: LiteLLM + TTS + STT)
  - Systemd hardening: `Restart=always`, `StartLimitBurst=5`, `MemoryMax=1G`
  - Logs estruturados JSON → Loki (tag `service=hermes`)
  - Smoke `smoke-tests/smoke-hermes-ready.sh` validando `/health` + `/ready`
  - Terraform tunnel ingress já aponta `hermes.zappro.site → localhost:8642` (SPEC-039 consolidado)

### Out

- Mudar motor STT/TTS (SPEC-009 imutável)
- Trocar LiteLLM (continua :4000 proxy backend)
- Treinar modelo novo

---

## Tech Stack

| Componente   | Tecnologia                                       | Porta | Notas                 |
| ------------ | ------------------------------------------------ | ----- | --------------------- |
| AI Gateway   | Fastify + Zod + ofetch                           | 4002  | Facade OpenAI         |
| LLM upstream | LiteLLM :4000 (minimax/ollama/qwen)              | 4000  | Existente             |
| PT-BR filter | Ollama `llama3-portuguese-tomcat-8b-instruct-q8` | 11434 | GPU homelab           |
| STT          | wav2vec2-proxy :8203 → whisper-api :8201         | 8203  | SPEC-018              |
| TTS          | TTS Bridge :8013 → Kokoro :8880                  | 8013  | pm_santa/pf_dora      |
| Deploy       | Coolify                                          | 8000  | docker-compose labels |
| Secrets      | `.env` (canonical)                               | —     | `process.env` apenas  |

---

## Architecture

```
Cliente OpenAI SDK
  │ POST /v1/chat/completions
  ▼
ai-gateway :4002  ── valida schema OpenAI ──▶ LiteLLM :4000 ──▶ MiniMax/Ollama
  │                                                │
  │  resposta EN/mixed                             ▼
  └─── Llama PT-BR filter (Ollama) ──▶ resposta PT-BR normalizada ──▶ cliente

Cliente OpenAI SDK audio
  │ POST /v1/audio/speech      ──▶ TTS Bridge :8013 (pm_santa)
  │ POST /v1/audio/transcriptions ──▶ wav2vec2-proxy :8203
```

---

## Env Vars (canonical `.env`)

| Variável                | Tipo   | Fonte     | Status                                    |
| ----------------------- | ------ | --------- | ----------------------------------------- |
| `LITELLM_LOCAL_URL`     | URL    | existente | ✅                                        |
| `LITELLM_MASTER_KEY`    | secret | `.env`    | ✅                                        |
| `TTS_BRIDGE_URL`        | URL    | existente | ✅                                        |
| `COOLIFY_URL`           | URL    | existente | ✅                                        |
| `COOLIFY_API_KEY`       | secret | existente | ✅                                        |
| `OLLAMA_MODEL`          | string | existente | ✅                                        |
| `OLLAMA_URL`            | URL    | **criar** | `http://localhost:11434`                  |
| `STT_PROXY_URL`         | URL    | **criar** | `http://localhost:8203`                   |
| `PTBR_FILTER_MODEL`     | string | **criar** | `llama3-portuguese-tomcat-8b-instruct-q8` |
| `AI_GATEWAY_PORT`       | int    | **criar** | `4002`                                    |
| `AI_GATEWAY_FACADE_KEY` | secret | **gerar** | random 32-byte hex                        |

> Secrets novos: gerar via `openssl rand -hex 32` e adicionar diretamente ao `.env` (fonte canónica única) + placeholder no `.env.example`. Nunca committar o valor real (`.env` já em `.gitignore`).

---

## Deliverables

1. `apps/ai-gateway/` — Fastify app + router + PT-BR filter middleware
2. `apps/ai-gateway/docker-compose.yml` — Coolify-ready
3. `packages/shared/src/schemas/openai-compat.ts` — Zod schemas
4. `.env.example` — novas variáveis documentadas
5. `smoke-tests/ai-gateway-openai-compat.sh` — valida `curl` igual OpenAI
6. `docs/ADRs/ADR-002-ai-gateway-facade.md` — decisão arquitetural
7. Pre-commit: `/sec` (secrets-audit) obrigatório

---

## Acceptance Criteria

- [ ] `curl https://ai.zappro.site/v1/chat/completions -H "Authorization: Bearer $AI_GATEWAY_FACADE_KEY" -d '{"model":"gpt-4o","messages":[...]}'` retorna resposta PT-BR válida em <3s p95
- [ ] Audio endpoints retornam mp3 (TTS) e JSON (STT) com schema OpenAI idêntico
- [ ] `pnpm turbo typecheck lint test` verde
- [ ] `/sec` audit: 0 secrets hardcoded
- [ ] Coolify deploy green (health `/health` 200)
- [ ] Smoke test `smoke-tests/ai-gateway-openai-compat.sh` pass
- [ ] Llama PT-BR filter overhead <400ms p95
- [ ] Deploy completo até **2026-04-15**

---

## Risks & Mitigation

| Risco                      | Mitigação                                                               |
| -------------------------- | ----------------------------------------------------------------------- |
| Latência Llama filter alta | Cache LRU por hash(response); skip filter se `Accept-Language` != pt-BR |
| Schema drift OpenAI        | Snapshot tests contra OpenAI SDK oficial                                |
| Secret leak                | `/sec` no pre-commit + `secrets-audit` cron                             |
| SPEC-009 violation         | PR review obrigatório; CI valida ausência de Kokoro direto              |

---

## Rollout

1. PR `feature/spec-047-ai-gateway` — scaffold + schemas
2. PR `feature/spec-047-ptbr-filter` — middleware + cache
3. PR `feature/spec-047-coolify` — deploy manifest
4. Smoke tests em staging (ai-staging.zappro.site)
5. Cutover produção `ai.zappro.site` + Cloudflare tunnel
6. Remover legacy/duplicate endpoints

---

## References

- SPEC-009 — OpenClaw audio stack
- SPEC-018 — wav2vec2-deepgram-proxy
- SPEC-041 — Monorepo polish (base)
- SPEC-046 — Hermes agent improvements
- ADR-001 — `.env` canonical source (Infisical pruned 2026-04-13)
