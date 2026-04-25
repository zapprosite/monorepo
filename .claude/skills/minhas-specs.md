---
name: minhas-specs
description: List all active SPECs
trigger: /minhas-specs
type: skill
phase: P
---

# Skill: /minhas-specs

List all SPEC documents in the monorepo.

## When to Use

- "Quero ver o que está em progresso"
- "Quais specs estão ativas?"
- "Mostrar todas as specs"

## Steps

1. **Read SPECS directory** - Scan `/srv/monorepo/docs/SPECS/`
2. **Extract metadata** - Parse frontmatter from each SPEC
3. **Group by status** - Categorize: draft, in_progress, completed
4. **Format output** - Present as readable list

## Output Format

```markdown
## SPECs Ativas

### Em Progresso
| SPEC | Título | Owner | Data |
|------|--------|-------|------|
| SPEC-XXX | <title> | <owner> | YYYY-MM-DD |

### Rascunho
| SPEC | Título | Owner | Data |
|------|--------|-------|------|
| SPEC-XXX | <title> | <owner> | YYYY-MM-DD |

### Completas
| SPEC | Título | Owner | Data |
|------|--------|-------|------|
| SPEC-XXX | <title> | <owner> | YYYY-MM-DD |
```

## Usage

```
/minhas-specs
```

Returns a formatted list of all SPECs grouped by status.
