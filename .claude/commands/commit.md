# /commit — Git commit

## Description

Stage and commit changes with proper message format.

## Actions

1. `git status --short` — show untracked files
2. `git diff` and `git diff --staged` — review changes
3. Generate commit message: `type: description` format
4. Types: feat, fix, refactor, docs, chore
5. Stage: `git add <files>` (never `git add -A`)
6. Commit with Co-Authored-By footer

## Commit Message Format

```
type: short description in English

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Anti-Patterns

- ❌ `git add -A` (may include .env)
- ❌ Commit messages without type prefix
- ❌ Adding generated files without checking

## Refs

- `AGENTS.md` git workflow
- `.claude/rules/anti-hardcoded-secrets.md`
