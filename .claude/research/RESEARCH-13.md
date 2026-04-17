# RESEARCH-13: Skill Lifecycle & Versioning Patterns

**Date:** 2026-04-17
**Agent:** RESEARCH-13
**Focus:** Skill lifecycle + versioning — create, update, deprecate skills; skill metadata, skill-that-generates-skills

---

## 1. Key Findings (April 2026 Best Practices)

### 1.1 Current Skill Format (Observed)

All skills use **SKILL.md with YAML frontmatter**:

```yaml
---
name: <skill-name> # Required: kebab-case, unique
description: <one-liner> # Required: context for when to invoke
version: X.Y.Z # Optional: most skills have 1.0.0
trigger: /slash-command # Optional: explicit trigger alias
type: skill # Optional: defaults to "skill"
---
```

**Observed gaps:**

- No `deprecated` field
- No `replaces` or `superseded_by` for migration
- No `dependencies` (other skills required)
- No `changelog`
- `trigger` not consistently used — most rely on folder name as implicit `/folder-name`

### 1.2 Skill Directory Structure

```
skill-name/
├── SKILL.md              # Mandatory: main instructions (first-read)
├── references/           # Optional: detailed docs
│   ├── overview.md
│   └── examples.md
└── scripts/              # Optional: executable scripts
    ├── run.sh
    └── validate.sh
```

**Rules observed:**

- SKILL.md: max ~100 lines recommended
- Reference files: max ~200 lines each
- Split long content into thematic reference files

### 1.3 Skill Lifecycle States

| State          | Pattern                    | Current Handling                             |
| -------------- | -------------------------- | -------------------------------------------- |
| **Active**     | Normal operation           | SKILL.md exists                              |
| **Deprecated** | Still loads but warns user | No formal pattern — stub skills just deleted |
| **Superseded** | Replaced by new skill      | No field, no redirect                        |
| **Archived**   | Removed from load path     | Deleted from `.claude/skills/`               |

**Critical gap:** No deprecation warning to users when a deprecated skill is invoked.

### 1.4 Skill Invocation Patterns

| Pattern              | Example                         | Resolution                                                                 |
| -------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| **Folder name**      | `/cloudflare-terraform`         | Default — folder `cloudflare-terraform/` → trigger `/cloudflare-terraform` |
| **Explicit trigger** | `trigger: /msec` in frontmatter | Override — `/msec` invokes minimax-security-audit                          |
| **Alias**            | None observed                   | Not implemented                                                            |

### 1.5 Skill Versioning

**Current state:** `version: 1.0.0` on most skills, but:

- No semantic versioning policy
- No changelog per skill
- No version compatibility checks
- No migration guides between versions
- Skills are versioned globally (same version for entire skill, not per-section)

### 1.6 Skill That Generates Skills

The `/self-healing` skill (SPEC-023) is the **meta-skill** pattern:

```
self-healing/
├── SKILL.md                    # Detecta padrão recorrente → cria skill
└── references/
    ├── skill-creation-guide.md # Empty (1 line) — gap!
    ├── memory-management.md
    └── pattern-recognition.md
```

**Process observed in self-healing:**

1. Detect recurring pattern via `pattern-recognition.md`
2. Check if skill already exists
3. If not and pattern recurs → create skill using `skill-creation-guide.md`
4. Save to `.claude/skills/<new-skill>/SKILL.md`
5. Document decision in memory

**Gap:** `skill-creation-guide.md` is essentially empty — the self-healing skill cannot actually create skills yet.

---

## 2. Specific Recommendations for CLAUDE.md / AGENTS.md

### 2.1 Add Skill Lifecycle Section to CLAUDE.md

```markdown
## Skill Lifecycle (SPEC-ENTERPRISE-REFACTOR)

### Skill Structure
```

skill-name/
├── SKILL.md # Mandatory: name, description, version, trigger
├── references/ # Optional: detailed docs
│ ├── overview.md
│ └── examples.md
└── scripts/ # Optional: executable scripts

````

### Skill Metadata (YAML Frontmatter)
```yaml
---
name: skill-name                    # Required: kebab-case
description: One-line when to use  # Required
version: 1.0.0                     # Semantic versioning (major.minor.patch)
trigger: /alias                     # Optional: explicit slash command
deprecated: false                   # Optional: if true, warn on invoke
superseded_by: new-skill           # Optional: migration path
dependencies:                      # Optional: skills required before this
  - skill-a
  - skill-b
---
````

### Lifecycle Operations

| Operation     | Command                                     | Notes                        |
| ------------- | ------------------------------------------- | ---------------------------- |
| Create        | `/create-skill`                             | Scaffold + SKILL.md template |
| Update        | Edit SKILL.md                               | Bump version in frontmatter  |
| Deprecate     | Add `deprecated: true` + `superseded_by:`   | Warns user on invoke         |
| Archive       | Move to `.claude/skills/archive/`           | Removes from load path       |
| Version check | `grep "version:" .claude/skills/*/SKILL.md` | Quick audit                  |

### Deprecation Pattern

```yaml
---
name: old-skill
description: DEPRECATED — use new-skill instead
version: 1.0.0
deprecated: true
superseded_by: new-skill
---
```

When a deprecated skill is invoked → warn user and suggest the replacement.

### Skill Versioning Policy

- **Major** (X.0.0): Breaking changes to workflow or output format
- **Minor** (0.X.0): New capabilities, backward compatible
- **Patch** (0.0.X): Bug fixes, doc improvements
- Changelog: `CHANGELOG.md` in skill directory OR version notes in SKILL.md header

### Auto-Skill Creation (Self-Healing)

The `/self-healing` skill can auto-create skills when:

1. Pattern recognized as recurring (3+ occurrences)
2. No existing skill covers the pattern
3. Decision documented in memory

### Skill Discovery

- List all skills: `ls .claude/skills/*/SKILL.md`
- Skill with `trigger:` field: explicitly mapped slash command
- Skill without `trigger:`: invoked via `/folder-name`

````

### 2.2 Update `/create-skill` Skill

The current `create-skill` skill needs:

1. **Version field required** in frontmatter template
2. **Deprecation fields** (`deprecated`, `superseded_by`) in template
3. **Dependencies field** for skill composition
4. **Changelog creation** on version bump
5. **Reference file generator** — create `references/` scaffold automatically

**Suggested new SKILL.md for create-skill:**

```markdown
---
name: create-skill
description: Guia para criação de novas skills padronizadas para agentes.
version: 1.1.0
trigger: /create-skill
dependencies:
  - self-healing
---

# Create Skill v1.1.0

## Objetivo
Criar novas skills para o Claude Code que sejam úteis, bem documentadas e funcionem de forma consistente.

## Quando usar
- Você precisa de um comportamento especializado que o Claude não tem nativamente
- Quer padronizar como uma tarefa recorrente é executada
- Precisa dar contexto de domínio específico ao Claude (stack, convenções, regras do projeto)

## Estrutura obrigatória

````

nome-da-skill/
├── SKILL.md # YAML frontmatter + markdown body
├── CHANGELOG.md # Version history (criar na primeira versão)
└── references/ # Opcional: documentação detalhada
├── overview.md
└── examples.md

````

## Como criar (passo a passo)

### 1. Scaffold
```bash
mkdir -p .claude/skills/novo-nome/{references,scripts}
````

### 2. SKILL.md — Frontmatter obrigatório

```yaml
---
name: novo-nome
description: Uma frase clara do que a skill faz.
version: 1.0.0
trigger: /trigger-name # Opcional: se diferente de /novo-nome
deprecated: false # true quando obsoleta
superseded_by: # Nome da skill substituta, se aplicável
dependencies: # Skills que devem ser carregadas antes
  - other-skill
---
```

### 3. SKILL.md — Body (seções essenciais)

1. **Objetivo**: frase clara do que faz
2. **Quando usar**: casos de uso específicos
3. **Como executar**: passo a passo
4. **Output esperado**: formato de entrega
5. **Bounded context**: o que NÃO faz (claro escopo)

### 4. CHANGELOG.md

```markdown
# Changelog

## 1.0.0 (2026-04-17)

- Initial release
```

### 5. Testar

```bash
# Invocar a skill
/novo-nome

# Verificar output contra esperado
# Ajustar SKILL.md e repetir
```

## Boas práticas

- Be specific: "use bcrypt cost 12" not "hash passwords securely"
- Max 100 lines per SKILL.md
- Max 200 lines per reference file
- Kebab-case names: `code-reviewer` not `CodeReviewer`
- Descriptive names: what it does, not technical jargon
- Version bump on any workflow change (major if breaking)

## Deprecation

Para deprecar uma skill:

1. Adicionar `deprecated: true` ao frontmatter
2. Adicionar `superseded_by: new-skill-name`
3. Em SKILL.md body, adicionar secção:

```markdown
## ⚠️ DEPRECATED

Esta skill está obsoleta. Use [new-skill-name](../new-skill/SKILL.md) em vez disso.
```

4. Mover para `archive/` se não deve ser carregada

## Deprecated Skills (archive/)

Skills removidas mas mantidas para referência histórica:

```bash
ls .claude/skills/archive/
```

---

## Leia também

- `references/examples.md`: exemplos de skills bem construídas
- `references/reference.md`: referência técnica de configuração
- `/self-healing`: skill that can auto-create skills from patterns

````

### 2.3 Fix Self-Healing skill-creation-guide.md

The `skill-creation-guide.md` is empty (1 line). This blocks auto-skill creation.

**Fix:** Populate with the content from section 2.2 above.

---

## 3. Code / Examples

### 3.1 Skill Deprecation Checker (Bash)

```bash
#!/usr/bin/env bash
# check-deprecated-skills.sh — List all deprecated skills
set -euo pipefail

SKILLS_DIR="${1:-.claude/skills}"

echo "=== Deprecated Skills ==="
for skill in "$SKILLS_DIR"/*/SKILL.md; do
  if grep -q "deprecated: true" "$skill" 2>/dev/null; then
    NAME=$(basename "$(dirname "$skill")")
    SUPERSEDED=$(grep "superseded_by:" "$skill" | awk '{print $2}')
    echo "  ⚠️  $NAME — superseded by: $SUPERSEDED"
  fi
done

echo ""
echo "=== Skills needing version bump ==="
for skill in "$SKILLS_DIR"/*/SKILL.md; do
  if ! grep -q "version:" "$skill" 2>/dev/null; then
    NAME=$(basename "$(dirname "$skill")")
    echo "  ❌ $NAME — missing version field"
  fi
done
````

### 3.2 Skill Version Audit

```bash
#!/usr/bin/env bash
# audit-skills.sh — Full skill inventory with versions
echo "Skill,Version,Deprecated,SupersededBy,Trigger"
for skill in .claude/skills/*/SKILL.md; do
  NAME=$(basename "$(dirname "$skill")")
  VERSION=$(grep "version:" "$skill" | head -1 | awk '{print $2}' || echo "MISSING")
  DEPRECATED=$(grep "deprecated:" "$skill" | head -1 | awk '{print $2}' || echo "false")
  SUPERSEDED=$(grep "superseded_by:" "$skill" | head -1 | awk '{print $2}' || echo "-")
  TRIGGER=$(grep "trigger:" "$skill" | head -1 | awk '{print $2}' || echo "/$NAME")
  echo "$NAME,$VERSION,$DEPRECATED,$SUPERSEDED,$TRIGGER"
done
```

---

## 4. What to Add / Update / Delete

### ADD

| Item                         | File                   | Reason                  |
| ---------------------------- | ---------------------- | ----------------------- |
| Skill lifecycle section      | CLAUDE.md              | Documented above in 2.1 |
| `deprecated` field           | All SKILL.md templates | Deprecation pattern     |
| `superseded_by` field        | All SKILL.md templates | Migration path          |
| `dependencies` field         | All SKILL.md templates | Skill composition       |
| CHANGELOG.md template        | create-skill skill     | Version history         |
| `check-deprecated-skills.sh` | scripts/               | Lifecycle tool          |
| `audit-skills.sh`            | scripts/               | Version audit           |

### UPDATE

| Item                                               | Current                       | Change                                                                         |
| -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `/create-skill` SKILL.md                           | v1.0.0, no deprecation fields | v1.1.0 with full lifecycle fields                                              |
| `/self-healing/references/skill-creation-guide.md` | Empty (1 line)                | Populate with creation guide                                                   |
| `/orchestrator` SKILL.md                           | v1.0.0                        | Add skill lifecycle integration (14 agents can create/update/deprecate skills) |
| AGENTS.md skills table                             | No versioning info            | Add version + deprecated columns                                               |

### DELETE

| Item                                   | Reason                                    |
| -------------------------------------- | ----------------------------------------- |
| Stub skills deleted (12 from SPEC-041) | Already removed — confirmed in git status |

---

## 5. Skill-that-calls-skills Patterns

### 5.1 Orchestrator Pattern (14-Agent)

The `/execute` orchestrator calls other skills as sub-agents:

```bash
# run-agents.sh — spawns agents that each invoke a skill
"SPEC-ANALYZER:claude:/researcher"
"SECURITY:claude:/minimax-security-audit"
"DOCS:claude:/doc-maintenance"
```

**Pattern:** Skills invoke other skills via `/skill-name` slash command within agent prompts.

### 5.2 Skill Composition (dependencies)

```yaml
# Example: trpc-compose depends on backend-scaffold
---
name: trpc-compose
description: Add a new tRPC router to the monorepo
version: 1.0.0
trigger: /trpc
dependencies:
  - backend-scaffold
---
```

When `/trpc` is invoked:

1. Check that `backend-scaffold` skill is available
2. Use its patterns for router structure
3. Compose on top of its conventions

### 5.3 Meta-Skill (Self-Healing)

The `/self-healing` skill is a **skill that can create skills**:

```
Pattern detected (3x)
  → /self-healing invoked
    → Check no existing skill covers it
    → Generate SKILL.md via /create-skill template
    → Save to .claude/skills/new-skill/SKILL.md
    → Document in memory
```

This is the **skill-that-generates-skills** pattern — highest maturity level.

---

## 6. Summary

| Aspect             | Current State        | Target State                          |
| ------------------ | -------------------- | ------------------------------------- |
| Version field      | Optional, v1.0.0     | Mandatory, semantic versioning        |
| Deprecation        | None (deleted stubs) | `deprecated: true` + `superseded_by:` |
| Dependencies       | None                 | `dependencies: [skill-a, skill-b]`    |
| Changelog          | None                 | Per-skill CHANGELOG.md                |
| Self-healing guide | Empty file           | Fully documented                      |
| Lifecycle docs     | Scattered            | Centralized in CLAUDE.md              |
| Versioning policy  | None                 | Major/Minor/Patch                     |
| Skill audit        | Manual               | `audit-skills.sh`                     |

**Priority:** Fix `/self-healing/skill-creation-guide.md` first (enables auto-skill creation), then update `/create-skill` with v1.1.0, then add lifecycle section to CLAUDE.md.
