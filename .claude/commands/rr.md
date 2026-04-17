# /rr — Code review generator

## Description

Generates REVIEW-\*.md from current branch diff.

## Actions

1. `git log main..HEAD --oneline` — list commits
2. `git diff main..HEAD` — full diff
3. Load `universal-code-review` skill
4. Generate `docs/SPECS/reviews/REVIEW-YYYYMMDD.md`
5. Save review under reviews/

## When

- Before merge to main
- After any significant PR

## Refs

- `REVIEW-SKILLS.md` decision tree
- `docs/SPECS/CODE-REVIEW-GUIDE.md`
