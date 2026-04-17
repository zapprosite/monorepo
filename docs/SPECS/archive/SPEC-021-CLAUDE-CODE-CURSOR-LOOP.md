---
archived: true
superseded_by: cursor-loop skill + SPEC-024
see_also:
  - cursor-loop, SPEC-024
---

> ⚠️ ARCHIVED — Superseded by [SPEC-024](../SPEC-024.md) and related canonical specs.

# SPEC-021 — Claude Code CLI: Cursor-Loop + Skills Architecture

**Versão:** 2.0 (fused from SPEC-021)
**Data:** 2026-04-10
**Authority:** will-zappro
**Status:** ACTIVE

> Fusão de: SPEC-021-claude-code-mcp-infrastructure-stack.md (PROPOSED) + SPEC-021-CLAUDE-CODE-SKILLS.md (skills architecture)

---

## Resumo

Cursor-loop operacional para monorepo: Infisical → Gitea push → Gitea CI → Coolify deploy → Cloudflare DNS → Smoke test. Skillsystem sem placeholders — tudo o que existe é real e funcional.

---

## Cursor-Loop — Arquitectura Completa

```
┌─────────────────────────────────────────────────────────┐
│              CURSOR LOOP LEADER                         │
│  [1] Infisical Check (Python SDK direct)               │
│  [2] Gitea push (git push gitea + origin)              │
│  [3] Gitea CI (gh run watch)                           │
│      ├── PASS ──→ [4] Coolify deploy                   │
│      └── FAIL ──→ [3a] Research (5 agents)              │
│                      ↓                                   │
│                   [2] retry                             │
│  [4] Coolify deploy (Bearer token — pode falhar)        │
│  [5] Cloudflare DNS (terraform)                         │
│  [6] Smoke test verification                            │
└─────────────────────────────────────────────────────────┘
```

### Flow Detalhado

| Step | Tool | Status | Problema |
|------|------|--------|----------|
| [1] Infisical | Python SDK | ✅ OK | — |
| [2] Gitea push | `git push` + `gh` | ✅ OK | — |
| [3] Gitea CI | `gh run watch` | ✅ OK | — |
| [4] Coolify | Bearer token | ⚠️ PODE FALHAR | nginx exige sessão |
| [5] Cloudflare | terraform | ✅ OK | — |
| [6] Smoke test | curl | ✅ OK | — |

**Problema known:** Step [4] Coolify Bearer token pode falhar com 401 — o nginx do Coolify intercepta e exige sessão autenticada. Workaround: adicionar IP à AllowList em coolify.zappro.site/settings/allowlist.

---

## Skills — Estado Real

### Prioridade 1 — Sistema Global (`~/.claude/agent-skills/skills/`)

Skills carregados automaticamente:

| Skill | Path | Uso |
|-------|------|-----|
| `spec-driven-development` | `~/.claude/agent-skills/skills/spec-driven-development/SKILL.md` | PRD → SPEC |
| `planning-and-task-breakdown` | `~/.claude/agent-skills/skills/planning-and-task-breakdown/SKILL.md` | Plan |
| `test-driven-development` | `~/.claude/agent-skills/skills/test-driven-development/SKILL.md` | TDD |
| `code-review-and-quality` | `~/.claude/agent-skills/skills/code-review-and-quality/SKILL.md` | Review |
| `security-and-hardening` | `~/.claude/agent-skills/skills/security-and-hardening/SKILL.md` | OWASP |
| `shipping-and-launch` | `~/.claude/agent-skills/skills/shipping-and-launch/SKILL.md` | Deploy |

### Prioridade 2 — Monorepo Local (`.claude/skills/`)

Skills específicos do monorepo:

| Skill | Ficheiro | Estado | Uso |
|-------|----------|--------|-----|
| `vision-local` | `.claude/skills/vision-local.md` | ✅ REAL | Qwen2.5-VL via Ollama |
| `coolify-access` | `.claude/skills/coolify-access/SKILL.md` | ✅ REAL | Coolify API (38 tools) |
| `gitea-access` | `.claude/skills/gitea-access/SKILL.md` | ✅ REAL | Gitea API (repos, PRs, workflows) |
| `cloudflare-terraform` | `.claude/skills/cloudflare-terraform/SKILL.md` | ✅ REAL | Terraform + Cloudflare DNS |

### Prioridade 3 — Commands (`.claude/commands/`)

Commands validados:

| Comando | Ficheiro | Estado |
|---------|----------|--------|
| `/cursor-loop` | `.claude/commands/cursor-loop.md` | ✅ |
| `/pg` | `.claude/commands/pg.md` | ✅ |
| `/feature` | `.claude/commands/feature.md` | ✅ |
| `/scaffold` | `.claude/commands/scaffold.md` | ✅ |
| `/ship` | `.claude/commands/ship.md` | ✅ |
| `/turbo` | `.claude/commands/turbo.md` | ✅ |
| `/sync` | `.claude/commands/sync.md` | ✅ (criado 09/04) |
| `/mirror` | `.claude/commands/mirror.md` | ✅ (criado 09/04) |
| `/spec` | `.claude/commands/spec.md` | ✅ |
| `/img` | `.claude/skills/vision-local.md` | ✅ |

**NUNCA criar:** `/plan` — é comando nativo do Claude Code CLI.

---

## MCPs — Estado

| MCP | Status | Config | Uso |
|-----|--------|--------|-----|
| `openwebui` | ✅ CONFIGURADO | `settings.json` → `http://localhost:3333/mcp` | Chat, models |
| `ai-context-sync` | ✅ SCRIPT REAL | `~/.claude/mcps/ai-context-sync/sync.sh` | docs → memory |
| `context7` | ✅ REGRA | `~/.claude/rules/context7.md` | Fetch docs |
| `coolify` | ⚠️ Npx package | `@masonator/coolify-mcp` | Deploy (38 tools) |
| `gitea` | ⚠️ Npx package | `@masonator/gitea-mcp` | Git operations |
| `taskmaster-ai` | ❌ NÃO INSTALADO | — | Task management |
| `Infisical` | ⚠️ SDK Python | Script directo | 144 secrets |
| `Tavily` | ❌ NÃO INSTALADO | — | Web research |

**Regra MCP vs Script:**
- **MCP:** quando a tarefa precisa de **ferramentas呼叫** (tools call) — coolify_deploy, gitea_create_pr, etc.
- **Script:** quando é **read-only** ou simples — `curl`, `git`, `python3`

---

## Agents — Cursor-Loop (`.claude/agents/`)

| Agent | Modelo | Responsabilidade |
|-------|--------|-----------------|
| `cursor-loop-leader` | c | Orquestrador — coordena todos |
| `cursor-loop-research` | c | Research (5x parallel) |
| `cursor-loop-refactor` | cm | Auto-fix issues |
| `cursor-loop-review` | c | AI code review |
| `cursor-loop-spec` | c | SPEC generation |
| `cursor-loop-ship` | cm | Commit + PR |
| `cursor-loop-mirror` | cm | Git mirror (gitea + origin) |
| `cursor-loop-sync` | cm | Memory sync |
| `cursor-loop-debug` | c | Debug failures |
| `cursor-loop-giteaai` | c | Gitea CI integration |

---

## Package Manager — Verdade

| Ficheiro | Dizia | Realidade | Status |
|----------|-------|-----------|--------|
| `package.json` | `pnpm@9.0.0` | pnpm | ✅ CORRETO |
| `CLAUDE.md` | "Turbo + Yarn" | pnpm | ❌ CORRIGIDO |
| `.claude/CLAUDE.md` | "Turbo + Yarn" | pnpm | ❌ CORRIGIDO |
| `AGENTS.md` | "Yarn workspaces" | pnpm | ❌ CORRIGIDO |
| `.gitea/workflows/ci-feature.yml` | `yarn install` | pnpm | ❌ CORRIGIDO |
| `.gitea/workflows/deploy-main.yml` | `yarn install` | pnpm | ❌ CORRIGIDO |

---

## Memory — ai-context-sync

```
docs/ (source of truth)
    ↓ ai-context-sync (cron 30min)
~/.claude/projects/-srv-monorepo/memory/
```

**Nunca editar `memory/` directamente.** Ficheiros lá são gerados por sync.sh.

---

## Obsidian — Espelho Passivo

`obsidian/` é espelho **read-only** de `docs/`. Regra: editar sempre em `docs/`.

---

## Tarefas Pendentes

| ID | Título | Prioridade | Status |
|----|--------|------------|--------|
| T01 | gitea-mcp.py criado (MCP server wrapper) | critical | PENDING |
| T02 | Testar cursor-loop com Coolify MCP | high | PENDING |
| T03 | E2E smoke test (SPEC-020 bridge stack) | high | PENDING |
| T04 | ZFS snapshot antes de changes | critical | PENDING |

---

## Acceptance Criteria

- [x] Todas as 10 skills/commands validadas e reais
- [x] Nenhum placeholder em `.claude/agents/`
- [x] Nenhum placeholder em `.claude/skills/`
- [x] Package manager corrigido para pnpm
- [x] SPEC-021 fundido (esta versão)
- [ ] gitea-mcp.py criado e testado
- [ ] Cursor-loop completo funciona end-to-end

---

## References

- `SPEC-014-CURSOR-AI-CICD-PATTERN.md`
- `SPEC-024-UNIFIED-CLAUDE-AGENT-MONOREPO.md`
- `AGENTS.md` — Arquitectura do monorepo
