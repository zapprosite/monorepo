---
name: nova-spec
description: Create a new SPEC from conversation
trigger: /nova-spec
type: skill
phase: P
---

# Skill: /nova-spec

Create a new SPEC document from conversation requirements.

## When to Use

- "Tenho ideia e quero documentar"
- "Preciso documentar essafeature"
- User wants to capture a new specification

## Steps

1. **Identify the idea** - Extract the core problem/solution from conversation
2. **Determine scope** - Define what is included and excluded
3. **Define acceptance criteria** - List concrete outcomes for success
4. **Check existing SPECs** - Avoid duplicates by checking `/srv/monorepo/docs/SPECS/`
5. **Generate SPEC.md** - Create with next available SPEC number
6. **Save to `/srv/monorepo/docs/SPECS/`** - Write the file

## Output Format

```markdown
---
spec_id: SPEC-XXX
title: <title>
status: draft
date: YYYY-MM-DD
owner: <owner>
---

# SPEC-XXX: <title>

## Objective

<Clear problem statement>

## Scope

### In Scope
- <item>

### Out of Scope
- <item>

## Acceptance Criteria

- [ ] <criterion>
- [ ] <criterion>

## Tech Stack

- <technology>

## Notes

<Additional context>
```

## Usage

```
/nova-spec
```

The skill will analyze the conversation and generate a SPEC.md file in `/srv/monorepo/docs/SPECS/` with the next available SPEC number.
