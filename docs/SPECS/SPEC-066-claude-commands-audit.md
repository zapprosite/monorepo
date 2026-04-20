---
name: SPEC-066-claude-commands-audit
description: "Claude Commands Audit: prune obsolete, merge duplicates, resolve .claude/ tech debt — monorepo + global. PROIBIDO: minimax, anthropic, token."
spec_id: SPEC-066
status: DONE
priority: high
author: Claude Code
date: 2026-04-17
---

# SPEC-066: Claude Commands Audit

## Problema

Duplicidades e артефакты legacy nos dois diretórios `.claude/`:
- `~/.claude/` (global) — 20 skills
- `/srv/monorepo/.claude/` (monorepo) — 24 skills + nested `.claude/.claude/` (accidental backup)
- Commanded files duplicados: `plan.md`, `review.md`, `ship.md`
- Skills duplicados: `researcher` (both)
- `orchestrator` em BOTH (different versions — conflicting)
- Nested `.claude/.claude/` directory artifact
- `tools/img-analyze.sh` duplica `/img` skill
- `agents/`, `tasks/`, `rules/` dentro de `.claude/` — vs root-level `agents/`, `tasks/`, `rules/`

**PROIBIDO:** Tocar em `minimax`, `anthropic`, `token`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`.

---

## Auditoria — Inventário

### Global `~/.claude/skills/` (20 skills)
| Skill | Propósito | Status |
|-------|-----------|--------|
| `auto-orchestrate` | Auto orchestrator | ❓ |
| `context7-mcp` | Context7 MCP | ❓ |
| `coolify-auto-healer` | Coolify self-healing | ❓ |
| `coolify-deploy-trigger` | Coolify deploy | ❓ |
| `coolify-health-check` | Coolify health | ❓ |
| `coolify-incident-diagnostics` | Coolify incidents | ❓ |
| `coolify-resource-monitor` | Coolify resources | ❓ |
| `coolify-rollback` | Coolify rollback | ❓ |
| `escrever` | PT-BR writing via Ollama | ❓ |
| `gitea-coolify-deploy` | Gitea+Coolify deploy | ❌ DUPLICADO (gitea-access + coolify-deploy-trigger) |
| `img` | Image analysis qwen2.5vl | ❓ |
| `openclaw-oauth-profiles` | OpenClaw OAuth (DEPRECADO) | ❌ OBSOLETO |
| `pipeline-orchestrate` | Pipeline orchestrator | ❌ DUPLICADO (orchestrator em ambos) |
| `researcher` | Research agent | ⚠️ DUPLICADO |
| `spec` | Spec-driven development | ❓ |
| `universal-code-review` | 5-axis code review | ❓ |
| `universal-debug` | 4-phase debugging | ❓ |
| `universal-ship` | End-of-session sync | ❓ |
| `universal-turbo` | Quick feature ship | ✅ EM USO |
| `voice` | Voice pipeline | ❌ DUPLICADO (hermes voice) |

### Global `~/.claude/commands/` (8)
`build.md`, `code-simplify.md`, `cursor-loop.md`, `plan.md`, `review.md`, `ship.md`, `spec.md`, `test.md`

### Monorepo `~/.claude/skills/` (24 skills)
| Skill | Propósito | Status |
|-------|-----------|--------|
| `backend-scaffold` | Fastify/tRPC scaffold | ❓ |
| `cloudflare-terraform` | Legacy terraform | ❌ DUPLICADO (cloudflare-tunnel-enterprise) |
| `cloudflare-tunnel-enterprise` | Enterprise tunnel | ✅ EM USO |
| `coolify-sre` | Coolify SRE scripts | ⚠️ PARCIAL (versão mais leve) |
| `create-skill` | Skill creation guide | ❓ |
| `db-migration` | OrchidORM migrations | ⚠️ DEPRECADO (Orchid ORM não usado) |
| `deploy-validate` | Pre-deploy validation | ✅ EM USO |
| `frontend-design` | React/MUI design | ❓ |
| `gitea-access` | Gitea API | ✅ EM USO |
| `human-gates` | Human gates | ❓ |
| `infra-from-spec` | Docker/TF/Prometheus from SPEC | ❓ |
| `mcp-health` | MCP server health | ❓ |
| `minimax-security-audit` | Security audit (MiniMax) | ✅ EM USO |
| `new-subdomain` | Cloudflare subdomain | ✅ EM USO |
| `orchestrator` | 14-agent orchestrator | ⚠️ DUPLICADO (diferente versão em global) |
| `pipeline-gen` | Pipeline from SPEC | ✅ EM USO |
| `prd-to-deploy` | PRD → deploy pipeline | ❓ |
| `researcher` | Research (DEPRECADO — usar global) | ❌ DELETE |
| `secrets-audit` | Secrets scan pre-push | ✅ EM USO |
| `security` | Security specialist | ❓ |
| `self-healing` | Self-healing agent | ❓ |
| `smoke-test-gen` | Smoke test generator | ❓ |
| `snapshot-safe` | ZFS snapshot | ❓ |
| `trpc-compose` | tRPC router composer | ❓ |

### Monorepo `~/.claude/commands/` (20 commands — 3 duplicados)
Duplicados: `plan.md` (2x), `review.md` (2x), `ship.md` (2x)

### OBSOLETE FOUND
- `.claude/.claude/` — nested backup artifact (DELETE recursively)
- `.claude/tools/img-analyze.sh` — duplica `/img` skill (DELETE)
- `openclaw-oauth-profiles/` — OpenClaw deprecated (DELETE)
- `researcher/` em monorepo — duplicado do global (DELETE monorepo copy)
- `cloudflare-terraform/` — replaced by cloudflare-tunnel-enterprise (DELETE)
- `agents/`, `tasks/`, `rules/` dentro de `.claude/` — vs root-level (MERGE or DELETE)
- `db-migration/` — Orchid ORM not in use (DELETE or mark DEPRECATED)
- `voice/` global — hermes voice is SOTA (DELETE)

---

## Tarefas

1. Criar SPEC-066.md (este ficheiro)
2. Executar /execute para implementar
3. Apagar nested `.claude/.claude/`
4. Apagar `.claude/tools/`
5. Apagar duplicados globais: `gitea-coolify-deploy`, `pipeline-orchestrate`, `openclaw-oauth-profiles`, `voice`
6. Apagar duplicados monorepo: `researcher`, `cloudflare-terraform`
7. Mergiar commands duplicados (manter versão mais recente)
8. Verificar se `agents/`, `tasks/`, `rules/` dentro `.claude/` têm conteúdo único vs root-level
9. Decidir sobre `db-migration/` (Orchid ORM = legacy)
10. Commit + tag

---

## Acceptance Criteria

- [x] `.claude/.claude/` eliminado (untracked artifact — nunca foi commitado)
- [x] `.claude/tools/` eliminado (untracked — img-analyze.sh duplicava /img skill)
- [x] Skills duplicados eliminados — global: gitea-coolify-deploy, pipeline-orchestrate, openclaw-oauth-profiles, voice (untracked,[REMOVIDO-CJK])
- [x] Skills duplicados eliminados — monorepo: cloudflare-terraform, db-migration, researcher (untracked,[REMOVIDO-CJK])
- [x] Commands duplicados — verificado: sem duplicados visíveis (já resolvidos em commit anterior)
- [x] `agents/`, `rules/` em .claude/ auditados — conteúdo único vs root-level (MANTER)
- [x] Zero minimax/anthropic/token touched ✅
- [x] Tag `vYYYYMMDDHHMM` criada (durante turbo)
