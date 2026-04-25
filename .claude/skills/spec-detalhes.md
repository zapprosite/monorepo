---
name: spec-detalhes
description: Show details of a specific SPEC
trigger: /spec-detalhes [nome]
type: skill
phase: P
---

# Skill: /spec-detalhes

Display full details of a specific SPEC document.

## When to Use

- "Preciso entender uma SPEC específica"
- "Mostrar detalhes da SPEC-XXX"
- "O que diz a SPEC sobre [tópico]?"

## Parameters

- `nome` - SPEC ID (e.g., SPEC-001) or title keyword

## Steps

1. **Resolve SPEC identifier** - Parse input as ID or search by title
2. **Read SPEC file** - Load from `/srv/monorepo/docs/SPECS/`
3. **Parse content** - Extract all sections
4. **Format output** - Present full SPEC with proper rendering

## Output Format

```markdown
# SPEC-XXX: <title>

**Status:** <status> | **Owner:** <owner> | **Date:** <date>

## Objective

<problem statement>

## Scope

### In Scope
- <items>

### Out of Scope
- <items>

## Acceptance Criteria

- [ ] <criterion>
- [ ] <criterion>

## Tech Stack

- <technology>

## Notes

<additional context>

## History

<changelog or notes about changes>
```

## Usage

```
/spec-detalhes SPEC-001
/spec-detalhes auth-implementation
```

Returns the full SPEC document with all sections rendered.
