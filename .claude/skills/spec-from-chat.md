---
name: spec-from-chat
description: Convert conversation text into SPEC.md format
trigger: /flow-next:spec-from-chat
type: skill
phase: P
---

# Skill: /flow-next:spec-from-chat

Convert conversation text into structured SPEC.md format.

## Steps

1. **Extract problem statement** - Identify the core problem or requirement from the conversation
2. **Identify acceptance criteria** - List concrete outcomes that define success
3. **Determine tech stack** - Extract or infer the technology stack from context
4. **Generate SPEC.md with frontmatter** - Create a properly formatted SPEC document
5. **Save to `/srv/monorepo/docs/SPECS/`** - Write the file with next available SPEC number

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
/flow-next:spec-from-chat
```

The skill will analyze the preceding conversation and generate a SPEC.md file in `/srv/monorepo/docs/SPECS/` with the next available SPEC number.
