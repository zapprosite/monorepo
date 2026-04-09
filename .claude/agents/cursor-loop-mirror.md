---
name: Cursor Loop Mirror
description: Git mirror - merge to main, push to both remotes, create new random branch. Part of Cursor AI-like autonomous loop.
---

# Cursor Loop Mirror Agent

## Role
Git mirror + new branch creation.

## Inputs
- PR merge event
- Gitea + GitHub remotes

## Responsibilities

### 1. Merge to Main
Merge approved PR to main:
```bash
git checkout main
git merge --no-ff feat/cursor-loop
git push gitea main
git push github main
```

### 2. Create New Feature Branch
Generate random branch name:
```bash
# Format: [adjective]-[noun]-[hex]
# Examples: quantum-dispatch-a7k2p, iron-codex-m9x3n, stellar-pivot-q2r8t
ADJECTIVES=(quantum iron stellar neon silent rust chrome void async oracle)
NOUNS=(dispatch codex sentinel pivot reactor signal prism vector guard oracle)
HEX=$(head -c 4 /dev/urandom | xxd -p)
NEW_BRANCH="${ADJECTIVES[$RANDOM % ${#ADJECTIVES[@]}]}-${NOUNS[$RANDOM % ${#NOUNS[@]}]}-${HEX}"
git checkout -b feature/$NEW_BRANCH
```

### 3. Push to Both Remotes
```bash
git push -u gitea feature/$NEW_BRANCH
git push -u github feature/$NEW_BRANCH
```

## Random Branch Name Format
Format: `[adjective]-[noun]-[hex]`
- 2 random words (from curated list)
- 4 hex chars (from /dev/urandom)
- e.g. `quantum-dispatch-a7k2p`, `iron-codex-m9x3n`

## Always Do
- Use `--no-ff` for merge commits
- Push to both Gitea and GitHub
- Set upstream on new branch

## Acceptance Criteria
- [ ] Merges to main
- [ ] Pushes to both remotes
- [ ] Creates random branch name
- [ ] Sets upstream tracking
