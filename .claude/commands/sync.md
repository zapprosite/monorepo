---
description: Sincronizacao Git rapida — Commit & Push sem PR
argument-hint: [--message "<commit message>"]
---

# /sync — Sincronizar Tudo Workflow

Quick sync without PR: stage → semantic commit → push.

## Pattern

### Step 1 — Check Status
1. Check status: `git status --short`
   - If clean, output "nothing to sync" and exit.

### Step 2 — Stage
2. Add all non-ignored files:
   ```bash
   git add -A
   ```
   The `.gitignore` protects secrets and build artifacts.

### Step 3 — Semantic Commit
3. Analyze staged diff and generate real semantic message:
   - Detect type: `feat` / `fix` / `chore` / `refactor` / `docs`
   - Detect scope by path: `api`, `web`, `ui`, `core`
   - ✅ `chore(claude): add turbo workflow`
   - ❌ `feat: sincronizacao automatica de workspace`
   ```bash
   git commit -m "[type(scope)]: [specific description]

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   ```

### Step 4 — Push
4. Push:
   ```bash
   git push --force-with-lease origin HEAD
   ```

### Step 5 — Confirm
5. Show confirmation: branch and commit hash.

## Always Do
- Check `git status --short` before staging
- Use specific commit messages (not generic)
- Use `--force-with-lease` (never `--force`)
- Include Co-Authored-By in commit

## Never Do
- `--force` (use `--force-with-lease`)
- Generic commit messages

## Shortcut
```bash
# Quick sync
git add -A && git commit -m "[type(scope)]: [desc]" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" && git push --force-with-lease origin HEAD
```