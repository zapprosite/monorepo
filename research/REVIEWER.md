# SPEC-066 Claude Commands Audit — REVIEWER Report

**Date:** 2026-04-17
**Author:** REVIEWER Agent
**Focus:** /review — duplicate resolution, tech debt, April 2026 best practices

---

## 1. Key Findings

### 1.1 Nested `.claude/.claude/` — ARTIFACT (DELETE)

```
.claude/.claude/
├── agent-states/     # Orchestrator logs (duplicado de .claude/skills/orchestrator/logs/)
├── pipeline-state.json
├── pipeline.json     # Duplicado de .claude/pipeline.json
└── smoke-tests/     # Duplicado de ./smoke-tests/
```

**Verdict:** Delete entire directory. Contém apenas artefatos de backup acidental.

### 1.2 `.claude/tools/img-analyze.sh` — DUPLICATE (DELETE)

```bash
# Este script chama llava via Ollama
# O skill /img (img.md) já faz isto com qwen2.5vl:7b
# Duplicação direta — manter apenas o skill
```

**Verdict:** Delete `.claude/tools/` directory entirely.

### 1.3 Skills para DELETE (Obsoletos)

| Skill | Razão |
|-------|-------|
| `researcher/` (monorepo) | Duplicado do global; DEPRECADO em favor de `.agent/` workflows |
| `cloudflare-terraform/` | Substituído por `cloudflare-tunnel-enterprise/` |
| `db-migration/` | Orchid ORM não está em uso no projeto |
| `minimax-security-audit/` | PROIBIDO per SPEC-066 — usa MiniMax |

### 1.4 Skills para MANTER (Em uso)

| Skill | Status |
|-------|--------|
| `cloudflare-tunnel-enterprise/` | SOTA — único para gestão Cloudflare |
| `orchestrator/` | 14-agent pipeline (manter apenas uma cópia — monorepo) |

### 1.5 `.claude/agents/` vs Root-Level — No Conflict

**Monorepo `.claude/agents/` (6 files):**
```
implementer.md, mcp-operator.md, orchestrator.md, planner.md, researcher.md, reviewer.md
```

**Root-level `/srv/monorepo/agents/`:** NÃO EXISTE
**Root-level `/srv/monorepo/tasks/`:** NÃO EXISTE
**Root-level `/srv/monorepo/rules/`:** NÃO EXISTE

**Verdict:** `.claude/agents/`, `.claude/tasks/`, `.claude/rules/` não conflituam com root-level (não existem). No entanto, researcher.md no `.claude/agents/` é duplicado do skill `researcher/` que deve ser deletado.

### 1.6 AGENTS.md Tech Debt — PROIBIDO References

AGENTS.md contém várias referências a MiniMax (PROIBIDO per SPEC-066):

```
Linha ~603-609: "MinIMax M2.7" e "MinIMax skills"
Linha ~980-1013: MinIMax Quick Reference (comandos /codegen, /msec, /dm, /bug-triage, /mxr)
Linha ~1027-1077: Research Agent com Tavily → MiniMax migration
Linha ~1015-1023: Cron jobs MiniMax
```

**Verdict:** Apagar seções MiniMax de AGENTS.md — violates SPEC-066 PROIBIDO rule.

---

## 2. Specific Recommendations

### 2.1 CLAUDE.md Updates

**File:** `/srv/monorepo/.claude/CLAUDE.md`

Nenhuma mudança necessária — já está limpo e alinhado com SPEC-066.

### 2.2 AGENTS.md Updates (CRITICAL)

**File:** `/srv/monorepo/AGENTS.md`

| # | Ação | Secção | Razão |
|---|------|--------|-------|
| 1 | DELETE | "LLM Tiering" (~L600-612) | Referência MinIMax M2.7 — PROIBIDO |
| 2 | DELETE | "MiniMax Quick Reference" (~L979-1013) | Todos os comandos /codegen, /msec, /dm, /bug-triage, /mxr — PROIBIDO |
| 3 | DELETE | "Research Agent (SPEC-035)" (~L1027-1077) | MiniMax research — PROIBIDO |
| 4 | DELETE | Cron jobs minimax-* (~L1015-1023) | Cron jobs MiniMax — PROIBIDO |
| 5 | DELETE | References to minimax-* skills (~L509-543) | Skills MiniMax — PROIBIDO |
| 6 | UPDATE | Skills table (~L507-543) | Remover minimax-* entries |
| 7 | UPDATE | Slash Commands table (~L479-503) | Remover /codegen, /msec, /dm, /bug-triage, /mxr |

### 2.3 Commands Duplicates — Resolve

| Command | Status | Action |
|---------|--------|--------|
| `plan.md` | Duplicado? | Verificar se existe em global — manter versão monorepo se diferente |
| `review.md` | Duplicado? | Verificar — mesclar se necessário |
| `ship.md` | Duplicado? | Verificar — mesclar se necessário |

**Nota:** Não consegui verificar global `~/.claude/commands/` (sem acesso). Assumir que monorepo é autoritativo para comandos específicos do projeto.

---

## 3. April 2026 Best Practices

### 3.1 Skill Structure

```
.claude/skills/{skill-name}/
├── SKILL.md              # Obrigatório: name, description, trigger
├── references/           # Opcional: documentação adicional
└── scripts/              # Opcional: scripts de suporte
```

### 3.2 Anti-Patterns to Avoid

| Pattern | Why Bad | Fix |
|---------|---------|-----|
| Duplicate skills in same dir | Confusion, conflicts | Single source of truth |
| Nested `.claude/.claude/` | Backup artifact | Delete |
| Hardcoded model names | Vendor lock-in | Use env vars |
| MiniMax/Anthropic refs | PROIBIDO per SPEC-066 | Delete |

### 3.3 Skill Naming Convention

```
# SOTA pattern (April 2026)
skill-name/           # lowercase, hyphens
├── SKILL.md
└── references/
    └── *.md

# Commands
.claude/commands/{name}.md  # kebab-case
```

---

## 4. What to ADD

### 4.1 PROIBIDO Registry

Criar novo ficheiro `.claude/rules/PROIBIDO.md`:

```markdown
# PROIBIDO — Forbidden Patterns

> Regras absolutas que nunca devem ser violadas.

## PROIBIDO

| Item | Razão | Desde |
|------|-------|-------|
| MiniMax SDK/CLI | SPEC-066 — token proprietary | 2026-04-17 |
| Anthropic SDK em código | SPEC-066 — vendor lock-in | 2026-04-17 |
| ANTHROPIC_BASE_URL | SPEC-066 — vendor lock-in | 2026-04-17 |
| ANTHROPIC_AUTH_TOKEN | SPEC-066 — vendor lock-in | 2026-04-17 |
| Infisical SDK em código | Legacy, pruned | 2026-04-13 |
| Hardcoded secrets | Zero tolerance | sempre |

## Como Verificar

```bash
# Antes de commit
git diff --cached | grep -iE "minimax|anthropic|ANTHROPIC_|INFISICAL_TOKEN"
```

## Excepções

Nenhuma — SPEC-066 é mandatório.
```

### 4.2 Skill Deprecation Protocol

Adicionar a `.claude/rules/` um ficheiro `SKILL-LIFECYCLE.md`:

```markdown
# Skill Lifecycle

## States

| State | Meaning |
|-------|---------|
| ACTIVE | Em uso, manter |
| DEPRECATED | Substituído, não usar |
| OBSOLETE | Apagar na próxima janela |

## Deprecation Process

1. Marcar SKILL.md com `status: deprecated`
2. Adicionar `replaced_by: skill-name` no frontmatter
3. Criar redirecionamento no novo skill
4. Apagar após 30 dias
```

---

## 5. Summary — Action Items

### DELETE (IMEDIATO)

- [ ] `.claude/.claude/` — recursive delete
- [ ] `.claude/tools/` — recursive delete
- [ ] `.claude/skills/researcher/` — monorepo copy (global existe)
- [ ] `.claude/skills/cloudflare-terraform/` — replaced by cloudflare-tunnel-enterprise
- [ ] `.claude/skills/db-migration/` — Orchid ORM not in use
- [ ] `.claude/skills/minimax-security-audit/` — PROIBIDO per SPEC-066
- [ ] `.claude/agents/researcher.md` — duplicado do skill

### UPDATE (AGENTS.md)

- [ ] Remover secção "LLM Tiering" (~L600-612)
- [ ] Remover "MiniMax Quick Reference" (~L979-1013)
- [ ] Remover "Research Agent (SPEC-035)" (~L1027-1077)
- [ ] Remover cron jobs minimax-* (~L1015-1023)
- [ ] Atualizar Skills table — remover minimax-* entries
- [ ] Atualizar Slash Commands — remover /codegen, /msec, /dm, /bug-triage, /mxr

### CREATE

- [ ] `.claude/rules/PROIBIDO.md` — forbidden patterns registry
- [ ] `.claude/rules/SKILL-LIFECYCLE.md` — deprecation protocol

---

## 6. Verification Checklist

```bash
# After changes
ls -la .claude/skills/           # Count should be ~18 (was 24)
ls -la .claude/commands/        # Count should be ~20
ls -la .claude/agents/          # Should NOT contain researcher.md
test ! -d .claude/tools         # tools/ deleted
test ! -d .claude/.claude       # nested deleted

# AGENTS.md verification
grep -c "minimax\|MinIMax" AGENTS.md  # Should be 0
grep -c "MiniMax" AGENTS.md            # Should be 0
```

---

**Report End — REVIEWER Agent (SPEC-066)**
