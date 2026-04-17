---
name: SPEC-064-super-polish
description: Super polish — delete ALL legacy/pruned material, keep only stable state-of-the-art
spec_id: SPEC-064
status: IN_PROGRESS
priority: critical
author: Principal Engineer
date: 2026-04-17
---

# SPEC-064: Super Polish — Estado da Arte Only

## Regra Única

**MASTER AUTHORIZED: DELETE LEGACY. Tudo o que não é estado da arte vai embora.**

---

## O QUE FICA (CORE — ESTÁVEL)

### Apps

- `apps/hermes-agency/` — Hermes Agency Suite (SPEC-058/059/060 ✅)
- `apps/ai-gateway/` — OpenAI Compatible Gateway (SPEC-047/048 ✅)
- `apps/list-web/` — List Web
- `apps/monitoring/` — Prometheus + AlertManager

### Orchestrator

- `.claude/skills/orchestrator/` — 14-agent system (SPEC-061 ✅)
- `.claude/commands/` — Slash commands (/execute, /pg, /turbo, /ship, /se, /hg, /rr, /dv, /ss, /rs, /commit, /code-review, /plan)
- `.github/workflows/orchestrator.yml` + `pr-check.yml`

### Docs (STATE OF THE ART)

- `docs/ARCHITECTURE-OVERVIEW.md`
- `docs/INFRASTRUCTURE/PORTS.md`
- `docs/INFRASTRUCTURE/SUBDOMAINS.md`
- `docs/GOVERNANCE/CONTRACT.md`
- `docs/GOVERNANCE/GUARDRAILS.md`
- `docs/GOVERNANCE/SECRETS-MANDATE.md`
- `docs/GOVERNANCE/PINNED-SERVICES.md`
- `docs/GOVERNANCE/IMMUTABLE-SERVICES.md`
- `docs/SPECS/SPEC-INDEX.md`

### Smoke Tests

- `smoke-tests/smoke-multimodal-stack.sh`
- `smoke-tests/smoke-env-secrets-validate.sh`

---

## O QUE SAI (LEGACY — APAGAR)

### research/

- `research/*.md` — 14 agent research reports (já commitados, útil apenas como log histórico)

### .claude/ (LEGACY STUBS)

- `research/` (directory) — super review artifacts
- `tasks/agent-states/*.json` — agent state logs
- `research/` em qualquer lugar — logs históricos

### obsidian/

- `obsidian/` — espelho read-only (drift, desactualizado)

### docs/SPECS/ (LEGACY)

- SPEC-034 (DRAFT)
- SPEC-048 (IN_PROGRESS)
- SPEC-061 (IN_PROGRESS — work in progress)
- SPEC-062 (IN_PROGRESS — work in progress)
- `archive/` directory
- `reviews/` directory (review logs históricos)
- `SPEC-INDEX.md` (vai ser regerado limpo)

### docs/GOVERNANCE/ (LEGACY)

- `RATE-LIMITING.md` (SPEC-040, nunca terminou)
- `ALERTING-POLICY.md` (SPEC-023, nunca terminou)

### .claude/skills/ (LEGACY STUBS)

- Todos os skills que são stub/vazio — manter só os que têm implementação real:
  - `orchestrator/` ✅
  - `human-gates/` ✅
  - `cloudflare-tunnel-enterprise/` ✅
  - `gitea-access/` ✅
  - `minimax-security-audit/` ✅
  - `smoke-test-gen/` ✅
  - `secrets-audit/` ✅
  - OUTROS: verificar se têm conteúdo real ou são stub vazio

### docs/GUIDES/

- Manter só: `discovery.md`, `backup-runbook.md`, `LANGUAGE-STANDARDS.md`
- Resto: archive/ ou apagar

### docs/ADRs/

- Manter: `ADR-001-denv-as-canonical-secrets-source.md`
- Resto: archive/ ou apagar

### root level (LEGACY)

- `research/` directory
- `smoke-tests/` → manter só os 2 stable
- `scripts/` → audit, cleanup, fix-issue, mirror-sync, review-pr, sync-docs, approve
- `.cursor-loop/` (deprecated)
- `.agent/` (se não tem implementação real)
- `packages/` → verificar se algum é usado

---

## Tarefas

1. Delete `research/` e `obsidian/` directories
2. Delete `docs/SPECS/archive/` e `docs/SPECS/reviews/`
3. Delete SPEC-034, SPEC-048, SPEC-061, SPEC-062 (IN_PROGRESS/DRAFT)
4. Delete docs/GOVERNANCE/RATE-LIMITING.md, ALERTING-POLICY.md
5. Audit .claude/skills/ — delete stubs vazios
6. Audit docs/GUIDES/ — manter só 3, resto archive
7. Audit docs/ADRs/ — manter só ADR-001
8. Delete `packages/` se nenhum é importado
9. Verificar `scripts/` — manter só utilitários activos
10. Commit "super-polish: delete legacy, estado da arte only"
11. Verificar todos os serviços still work (smoke tests)

---

## Acceptance Criteria

- [ ] `research/` directory deleted
- [ ] `obsidian/` directory deleted
- [ ] SPECs: só 5-7 (053, 058, 059, 060, 063, 064)
- [ ] `docs/GOVERNANCE/` só: CONTRACT, GUARDRAILS, SECRETS-MANDATE, PINNED-SERVICES, IMMUTABLE-SERVICES
- [ ] `docs/GUIDES/` só: discovery, backup-runbook, LANGUAGE-STANDARDS
- [ ] `docs/ADRs/` só: ADR-001
- [ ] `smoke-tests/` só: 2 scripts
- [ ] `scripts/` só: ~8 utilitários activos
- [ ] .claude/skills/ sem stubs vazios
- [ ] Todos os serviços respondem: ai-gateway :4002, hermes :8642, STT :8204, TTS :8013
- [ ] Commit + tag + merge main
