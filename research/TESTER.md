# TESTER Research Report — SPEC-066 Claude Commands Audit

**Date:** 2026-04-17
**Focus:** Testing strategy for skill deduplication and tech debt resolution

---

## Key Findings

### 1. CONFIRMED — Delete Targets

| Path | Reason | Priority |
|------|--------|----------|
| `.claude/.claude/skills/orchestrator/` | Nested backup artifact | CRITICAL |
| `.claude/tools/img-analyze.sh` | Uses `llava` (SIGSEGV bug per SPEC-053), replaced by `/img` skill with `qwen2.5vl:7b` | CRITICAL |
| `.claude/skills/researcher/` (monorepo) | MiniMax-only, deprecated; global `researcher` has broader scope | HIGH |
| `.claude/skills/cloudflare-terraform/` | Replaced by `cloudflare-tunnel-enterprise` | HIGH |
| `.claude/skills/db-migration/` | OrchidORM not in use (per SPEC-053, SPEC-051) | MEDIUM |

### 2. Global Skills — Obsolete/Duplicate

| Skill | Status | Action |
|-------|--------|--------|
| `gitea-coolify-deploy/` | DUPLICADO | DELETE — functionality covered by `gitea-access` + `coolify-deploy-trigger` |
| `pipeline-orchestrate/` | DUPLICADO | DELETE — functionality covered by `orchestrator` in monorepo |
| `openclaw-oauth-profiles/` | OBSOLETO | DELETE — OpenClaw deprecated per SPEC-051 |
| `voice/` (global) | DUPLICADO | DELETE — Hermes voice is SOTA |
| `researcher/` | DUPLICADO | KEEP global, DELETE monorepo copy |
| `auto-orchestrate/` | AMBIGUOUS | KEEP? Different purpose (idle hook/sync) vs `/execute` |

### 3. Commands Duplication — Monorepo vs Global

**Monorepo `.claude/commands/`** has 20 files. Global `~/.claude/commands/` has 8 symlinks to `agent-skills`.

Confirmação de duplicados:
- `plan.md` — Global (agent-skills) é mais completo; monorepo versão é mais simples
- `ship.md` — Idem
- `review.md` — Idem

**Recomendação:** Manter versões globais do agent-skills como canonical. Monorepo versions appear to be older simplified versions that should be removed.

### 4. Agents/Tasks/Rules — Non-Issue

O SPEC menciona "vs root-level `agents/`, `tasks/`, `rules/`", mas:

- **`rules/`** — NÃO existe no root-level. `.claude/rules/` contém: `REVIEW-SKILLS.md`, `anti-hardcoded-env.md`, `anti-hardcoded-secrets.md`, `backend.md`, `search.md`. **Estes são válidos e devem ser mantidos.**

- **`agents/`** — NÃO existe no root-level. `.claude/agents/` contém agent definitions para o orchestrator (implementer, mcp-operator, planner, researcher, reviewer, orchestrator symlink). **Válidos.**

- **`tasks/`** — Root-level `tasks/agent-states/` e `.claude/tasks/agent-states/` têm conteúdo DIFERENTE:
  - Root: 16 arquivos (CODER-1, CODER-2, TESTER, SMOKE, SECURITY, DOCS, TYPES, LINT, SECRETS, GIT, REVIEWER, SHIPPER, RESEARCH-1..4, ARCHITECT)
  - `.claude/`: 28 arquivos (mesmos + RESEARCH-5..14, SPEC-ANALYZER, mais estados antigos)

  **Recomendação:** Unificar em root-level `tasks/agent-states/` como canonical, DELETE `.claude/tasks/`.

### 5. April 2026 Best Practices — Skill Structure

Estrutura ideal de skill (2026):
```
skill-name/
├── SKILL.md          # Obrigatório: name, description, trigger, version
├── scripts/          # Opcional: scripts auxiliares
├── references/       # Opcional: documentação adicional
└── *.md              # Opcional: guides, READMEs
```

**Issues encontrados:**
- `db-migration/` referencia OrchidORM (não usado)
- `researcher/` (monorepo) usa MiniMax API diretamente (não permitido pelo SPEC-066 restriction)
- `img-analyze.sh` usa modelo deprecated (`llava` → `qwen2.5vl:7b`)

### 6. Test Coverage Gaps for This SPEC

**Critical Path Test (should exist before merge):**

```bash
# 1. Verify no nested .claude/.claude exists
find /srv/monorepo/.claude -name ".claude" -type d
# Expected: only /srv/monorepo/.claude (not nested)

# 2. Verify tools/ is empty or doesn't exist
ls /srv/monorepo/.claude/tools/
# Expected: img-analyze.sh should NOT exist

# 3. Verify duplicate skills are removed
ls /srv/monorepo/.claude/skills/researcher/
# Expected: directory should NOT exist (deleted)

# 4. Verify commands are not duplicated
ls /srv/monorepo/.claude/commands/plan.md
# Should be symlink or removed if duplicate

# 5. Verify agent-states consolidation
ls /srv/monorepo/tasks/agent-states/*.json | wc -l
# Should contain all 14 orchestrator states
```

---

## Recommendations

### DELETE (Prioridade Alta)

1. `.claude/.claude/` — rm -rf recursively
2. `.claude/tools/img-analyze.sh`
3. `.claude/skills/researcher/` (monorepo copy)
4. `.claude/skills/cloudflare-terraform/`
5. `.claude/skills/db-migration/`
6. Global: `gitea-coolify-deploy/`, `pipeline-orchestrate/`, `openclaw-oauth-profiles/`, `voice/`

### MERGE/SYMILINK

1. `.claude/tasks/agent-states/` → unificar com root `tasks/agent-states/`
2. Commands duplicados em monorepo → manter apenas symlinks para agent-skills

### VALIDATE

1. `.claude/agents/` — verificar se symlink `orchestrator.md` aponta para local válido
2. `.claude/rules/` — manter (anti-hardcoded-env, anti-hardcoded-secrets são críticos)
3. `.claude/skills/orchestrator/` — manter (monorepo version is the canonical one for `/execute`)

### PROIBIDO Verifications

Ensure NO changes touch:
- `minimax`, `anthropic`, `token` references
- `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`
- MiniMax API key usage in skills being KEPT

---

## Test Plan

| Test | Command | Expected |
|------|---------|----------|
| Nested .claude gone | `find . -name ".claude" -type d` | Only one result: `./.claude` |
| img-analyze.sh gone | `ls .claude/tools/img-analyze.sh 2>&1` | No such file |
| researcher monorepo gone | `ls .claude/skills/researcher/ 2>&1` | No such directory |
| cloudflare-terraform gone | `ls .claude/skills/cloudflare-terraform/ 2>&1` | No such directory |
| db-migration resolved | `cat .claude/skills/db-migration/SKILL.md | grep -i deprecated` | Should show deprecated status |
| agent-states unified | `ls tasks/agent-states/*.json | wc -l` | 28+ files |
| Commands clean | `ls .claude/commands/` | No plan.md, ship.md, review.md as files (only symlinks) |

---

## Risk Assessment

**Low Risk:**
- Deleting nested `.claude/.claude/` (backup artifact)
- Deleting `img-analyze.sh` (duplicates existing skill)
- Deleting `researcher/` (duplicate, global version exists)

**Medium Risk:**
- Deleting `cloudflare-terraform/` (may have unique content not in `cloudflare-tunnel-enterprise`)
- Consolidating `agent-states/` directories

**High Risk:**
- Modifying `.claude/rules/` (contains critical anti-hardcoded-secrets rules)
- Modifying `.claude/agents/` (orchestrator depends on these)

---

## Conclusion

SPEC-066 is well-scoped. Main deliverables:
1. Delete nested `.claude/.claude/` and `.claude/tools/img-analyze.sh`
2. Delete duplicate skills (researcher, cloudflare-terraform, db-migration, global duplicates)
3. Consolidate `agent-states/` into root `tasks/`
4. Resolve commands duplication (use agent-skills as canonical)

**Priority order:** Delete artifacts → Delete duplicate skills → Consolidate state → Verify PROIBIDO restrictions
