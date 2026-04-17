# Pipeline — SPEC-047 Enterprise Polish AI Gateway PT-BR

**Deadline:** 2026-04-15
**SPEC:** [SPEC-047](SPEC-047-enterprise-polish-ai-gateway-ptbr.md)

## Phase -1 — Infisical Prune Remediation (blocking)

- [ ] TM00 — Scan full repo: `grep -rn "INFISICAL\|Infisical\|infisical\.getSecret\|infisical run" apps/ packages/ scripts/`
- [ ] TM01 — `apps/web/src/auth.js` — remover qualquer import/uso de Infisical, substituir por `process.env`
- [ ] TM02 — `packages/env/src/index.ts` — remover SDK Infisical, manter apenas parser `.env` + Zod validation
- [ ] TM03 — `packages/env/.env.example` — limpar referências a `INFISICAL_*`
- [ ] TM04 — `scripts/bootstrap-check.sh` — remover checks de Infisical, validar apenas `.env`
- [ ] TM05 — `scripts/cursor-loop-research-minimax.sh` — remover `infisical run` wrapper, usar `set -a; source .env; set +a`
- [ ] TM06 — `pnpm remove @infisical/sdk infisical-node` em todos workspaces
- [ ] TM07 — Atualizar CI workflows (`.github/workflows/`, `.gitea/workflows/`) — remover `infisical` steps, usar env vars diretos
- [ ] TM08 — `/sec` audit pós-remediation — 0 Infisical references

## Phase 0 — Pre-flight (blocking)

- [ ] T000 — Ler SPEC-009 + SPEC-018 + `.claude/rules/Hermes Agent-audio-governance.md`
- [ ] T001 — Auditar `.env` e inventariar secrets ausentes (`/sec`)
- [ ] T002 — Gerar `AI_GATEWAY_FACADE_KEY` via `openssl rand -hex 32` e adicionar a `.env` (fonte canónica única — Infisical pruned)
- [ ] T003 — Adicionar `OLLAMA_URL`, `STT_PROXY_URL`, `PTBR_FILTER_MODEL`, `AI_GATEWAY_PORT` em `.env` e `.env.example`

## Phase 1 — Schemas & Scaffold

- [ ] T100 — `packages/shared/src/schemas/openai-compat.ts` — Zod para chat/audio (request+response)
- [ ] T101 — `apps/ai-gateway/` scaffold Fastify (skill `backend-scaffold`)
- [ ] T102 — Router `/v1/chat/completions` (passthrough LiteLLM)
- [ ] T103 — Router `/v1/audio/speech` (passthrough TTS Bridge, voice default `pm_santa`)
- [ ] T104 — Router `/v1/audio/transcriptions` (passthrough wav2vec2-proxy)
- [ ] T105 — Auth middleware `Authorization: Bearer <AI_GATEWAY_FACADE_KEY>` (constant-time compare)

## Phase 2 — PT-BR Filter

- [ ] T200 — Middleware `ptbrFilter` chamando Ollama `PTBR_FILTER_MODEL` com prompt de normalização
- [ ] T201 — Cache LRU (hash SHA-256 do content, TTL 15min, max 512 entries)
- [ ] T202 — Bypass se `Accept-Language` não contém `pt`
- [ ] T203 — Métricas Prometheus: `ptbr_filter_latency_ms`, `ptbr_filter_cache_hits_total`

## Phase 3 — Coolify Deploy

> **Arquitectura corrigida:** ai-gateway é serviço interno gerido pelo Coolify (`coolify.zappro.site`).
> Sem novo subdomínio. `llm.zappro.site` → `:4000` (LiteLLM) mantém-se independente.

- [x] T300 — `apps/ai-gateway/Dockerfile` multi-stage ✅
- [x] T301 — `apps/ai-gateway/docker-compose.yml` Coolify-ready ✅
- [x] T302 — ~~subdomínio ai.zappro.site~~ **REMOVIDO** — serviço interno `:4002` sem exposição pública directa
- [x] T303 — Deploy Coolify via API ✅ (UUID `jo53d99erynvllgmga2s4h7o`, env vars injectados)
- [x] T304 — `curl http://localhost:4002/health` = 200 ✅ (smoke 5/5 pass)
- [ ] T305 — Build da imagem Docker funcional via Coolify (actualmente corre nativo com tsx; imagem precisa de fix no Dockerfile para build context)

## Phase 4 — Hardening & Tests

- [ ] T400 — `/sec` audit full repo (skill `secrets-audit`) — 0 findings
- [ ] T401 — Pre-commit hook `.husky/pre-commit` executa `/sec`
- [ ] T402 — Unit tests `apps/ai-gateway/test/*.test.ts` (vitest) — schemas, auth, cache
- [ ] T403 — Smoke test `smoke-tests/ai-gateway-openai-compat.sh` (OpenAI SDK official check)
- [ ] T405 — Smoke secrets validator `smoke-tests/smoke-env-secrets-validate.sh` (dry-run + `HEAL=1` + `ROTATE=1` paths) — integrar no CI pre-deploy
- [ ] T404 — Load test: 50 rps durante 60s, p95 <3s (skill `scalability`)

## Phase 5 — Docs & Governance

- [ ] T500 — `docs/ADRs/ADR-002-ai-gateway-facade.md`
- [ ] T501 — Atualizar `docs/SPECS/SPEC-INDEX.md`
- [ ] T502 — Atualizar `CLAUDE.md`: ai-gateway interno `:4002` via Coolify; `llm.zappro.site` = LiteLLM público; sem duplicação
- [ ] T503 — `/rr` code review holístico (skill `review-minimax`)

## Phase 5.5 — Hermes Polish (consolida SPEC-046 pendente)

- [ ] T550 — Corrigir `HERMES_GATEWAY_URL` para `http://127.0.0.1:8642` em `.env` / `.env.example` ✅ (feito 2026-04-15)
- [ ] T551 — Implementar `GET /ready` em hermes-agent: verifica LiteLLM `/models`, TTS Bridge `/health`, STT Proxy
- [ ] T552 — Systemd unit `hermes-agent.service` hardening: `Restart=always`, `StartLimitBurst=5`, `MemoryMax=1G`, `ProtectSystem=strict`
- [ ] T553 — Logs JSON estruturados (uvicorn `--log-config`) → Loki via Promtail tag `service=hermes`
- [ ] T554 — `smoke-tests/smoke-hermes-ready.sh` — valida `/health` (200) + `/ready` (200) + headers rate-limit do nginx frontend
- [ ] T555 — Dashboard Grafana `hermes-agent.json`: latency p50/p95, error rate, memory, rate-limit 429 count
- [ ] T556 — Atualizar `docs/SPECS/SPEC-046-hermes-agent-improvements.md` status → ABSORVED-BY-SPEC-047
- [ ] T557 — `SPEC-INDEX.md`: marcar SPEC-046 como ✅ CONSOLIDATED

## Phase 6 — Ship (2026-04-15)

- [ ] T600 — Merge PRs em ordem: schemas → scaffold → filter → coolify → docs
- [ ] T601 — Tag `v0.47.0` + `phase/47-ai-gateway`
- [ ] T602 — Anúncio no canal `#homelab` com exemplo `curl` OpenAI-compat
- [ ] T603 — Post-mortem latência (24h após deploy)

## Gates Humanos

- **G1** ~~subdomínio~~ **REMOVIDO** — sem gate de subdomínio (serviço interno)
- **G2** (antes T600): review manual de SPEC-009 compliance (nenhuma chamada direta Kokoro)
