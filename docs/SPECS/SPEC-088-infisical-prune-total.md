# SPEC-088 — Prune Total Infisical

**Data:** 2026-04-20
**Status:** DONE ✅ (2026-04-20)
**Tipo:** housekeeping

## Motivation

Infisical foi PRUNED a 2026-04-13 (SPEC-047, ADR-001). Contudo, referências ativas
permanecem em scripts, skills, e docs. NADA neste monorepo deve lembrar Infisical.

## Tarefas

### 1. Scripts Shell — Limpar referencias Infisical

- [ ] `scripts/bootstrap-effect.sh:60` — "Infisical health check" → remover, ou documentar que o health check é para .env
- [ ] `scripts/bootstrap-check.sh:3` — comentário "Infisical pruned 2026-04-13" → remover essa parte do comentário
- [ ] `.claude/skills/coolify-sre/scripts/sre-monitor.sh:12-14` — variáveis `INFISICAL_PROJECT_ID`, `INFISICAL_ENV`, `INFISICAL_TOKEN_PATH` → REMOVER (nunca usadas no script)

### 2. Skills — Regenerar docs sem Infisical

- [ ] `.claude/commands/sec.md:11` — `INFISICAL_TOKEN` da lista de patterns → REMOVER (token já não existe)
- [ ] `.claude/skills/trpc-compose/SKILL.md:83` — "MINIMAX_API_KEY em Infisical vault" → ".env"
- [ ] `.claude/skills/prd-to-deploy/SKILL.md:155` — "Secrets syncados do Infisical para .env" → "Secrets em .env"
- [ ] `.claude/skills/cloudflare-tunnel-enterprise/references/runbooks.md:304-311` — Steps "Update Infisical", "Sync Infisical to .env" → Steps para atualizar .env diretamente
- [ ] `.claude/skills/cloudflare-tunnel-enterprise/references/token-management.md` — Secções "Infisical (canonical source)", "Update Infisical", "Sync Infisical to .env" → Remover ou reescrever para .env
- [ ] `.claude/skills/cloudflare-tunnel-enterprise/SKILL.md:150-151` — "Update Infisical", "Sync Infisical → .env" → Remover这两个 steps
- [ ] `.claude/skills/cloudflare-tunnel-enterprise/SKILL.md:196` — Infisical na tabela vault → REMOVER entrada
- [ ] `.claude/skills/cloudflare-tunnel-enterprise/SKILL.md:207` — "Never use Infisical SDK" → Remover (redundante)
- [ ] `.claude/skills/minimax-security-audit/SKILL.md` — Referências a Infisical vault → Substituir por .env
- [ ] `.claude/skills/backend-scaffold/SKILL.md:72` — "MINIMAX_API_KEY em Infisical vault" → ".env"
- [ ] `.claude/skills/gitea-access/SKILL.md` — "Guardar em Infisical", "synced from Infisical" → Reescrever para .env
- [ ] `.claude/skills/new-subdomain/SKILL.md:38-40` — "(Infisical: cloudflare/...)" → Remover essas anotações
- [ ] `.claude/skills/new-subdomain/references/api-flow.md:20-22` — Mesmas anotações Infisical → Remover
- [ ] `.claude/skills/infra-from-spec/SKILL.md:77` — "MINIMAX_API_KEY em Infisical vault" → ".env"

### 3. Docs — Atualizar linguagem

- [ ] `docs/INFRASTRUCTURE/PORTS.md:66` — "Infisical Vault removed" → okay, mas encurtar
- [ ] `docs/INFRASTRUCTURE/SUBDOMAINS.md:46` — "DNS removido — container não existe" → okay
- [ ] `docs/README.md:74` — "Nunca ler de Infisical" → Redundante, .env é fonte canónica já documentado em outro lugar
- [ ] `docs/ARCHITECTURE-OVERVIEW.md:107,111` — INFISICAL_TOKEN na tabela → REMOVER linha. Regra "Never read from Infisical" → Remover (já na GUARDRAILS)
- [ ] `docs/GOVERNANCE/EXCEPTIONS.md:5` — "SPEC-029-INFISICAL-SDK-MANDATORY.md" → Legacy, esse spec não existe — REMOVER referência
- [ ] `docs/GOVERNANCE/GUARDRAILS.md:76,278,282` — "Infisical SDK proibido" → Manter apenas UNA via (76), remover das outras linhas como redundante
- [ ] `docs/GUIDES/backup-runbook.md` — Referências a infisical-db, infisical-redis, "Infisical DB dumps" →JA NOT OK - corrigir/limpar

### 4. AGENTS.md — Reduzir/Remover Infisical

- [ ] `AGENTS.md:229` — Nota "Infisical PRUNED since 2026-04-13" → Manter, é útil
- [ ] `AGENTS.md:263` — Link para `INFISICAL-SDK-PATTERN.md` → REMOVER (ficheiro não existe)
- [ ] `AGENTS.md:272` — "Infisical SDK só em scripts de infra" → REESCREVER: ".env como fonte canónica"
- [ ] `AGENTS.md:307` — Link para `INFISICAL-SDK-PATTERN.md` → REMOVER
- [ ] `AGENTS.md:315` — "Secrets → Infisical SDK ONLY" → ".env como fonte canónica"
- [ ] `AGENTS.md:410` — "Secrets (Infisical)" → "Secrets (.env)"
- [ ] `AGENTS.md:571` — "Infisical SDK enforcement" → Remover essa skill da tabela (não existe mais)
- [ ] `AGENTS.md:786-796` — Bloco "## Secrets (Infisical)" com código Infisical SDK → DELETAR todo o bloco
- [ ] `AGENTS.md:1021` — "OWASP + Infisical SDK" → "OWASP + secrets audit"
- [ ] `AGENTS.md:1092` — "via .env (Infisical SDK PROIBIDO)" → "via .env"
- [ ] `AGENTS.md:1108` — "MINIMAX_API_KEY via Infisical SDK" → "MINIMAX_API_KEY via .env"

### 5. SPEC-064 — research/ DIRECTORY DELETE

- [ ] `research/` directory — 19 agent research files → DELETE completo
  - `research/SECRETS.md` (contém extensas refs Infisical)
  - `research/SECURITY.md` (refs Infisical)
  - `research/ARCHITECT.md` (Infisical vault)
  - `research/CODER-1.md` (Infisical vault)
  - `research/SPEC-ANALYZER.md` (Infisical SDK + hardcoded token)
  - + todos os outros .md no research/

### 6. SPEC-064 — docs/SPECS/reviews/ DELETE

- [ ] `docs/SPECS/reviews/` directory → DELETE completo (historical review logs)

### 7. Docs-INFISICAL-SDK-PATTERN — DELETE

- [ ] `docs/GUIDES/INFISICAL-SDK-PATTERN.md` → DELETE (skill para usar Infisical SDK — PROIBIDO)

## Acceptance Criteria

1. `grep -ri "infisical" /srv/monorepo/` retorna ZERO resultados em código/skills
2. `grep -ri "INFISICAL" /srv/monorepo/` retorna ZERO resultados em código/skills
3. Documentos históricos (ADRs, GUARDRAILS) podem mencionar "Infisical pruned" como contexto histórico
4. `docs/GUIDES/INFISICAL-SDK-PATTERN.md` DELETE
5. `research/` directory DELETE
6. `docs/SPECS/reviews/` directory DELETE
7. .env é mencionado como fonte canónica — sem ressalvas
