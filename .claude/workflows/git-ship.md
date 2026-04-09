---
description: Entrega inteligente — staging seguro, commit semântico, push e criação de PR no GitHub.
---

# /ship — Git Ship Workflow

> Ship a completed feature: stage → semantic commit → push → GitHub PR.

## Path
`/srv/monorepo`

## Pattern

### Phase 1 — Diagnóstico
1. Get current branch: `git branch --show-current`
   - **Interrupt** if on `main` or `master`
2. Check state: `git status --short`
   - If clean, inform and exit
3. Show summary: `git diff --stat HEAD`

### Phase 2 — Staging Seguro
4. Stage tracked + new non-ignored files:
   ```bash
   git add -A
   ```
   The `.gitignore` is the real protection against `.env`, secrets, build artifacts.
5. Verify staged: `git diff --cached --stat`

### Phase 3 — Commit Semântico
6. Analyze staged diff to detect:
   - **Type:** `feat` / `fix` / `chore` / `refactor` / `docs` / `test`
   - **Scope:** derived from changed paths
     - `apps/api/` → `(api)`
     - `apps/frontend/` → `(web)`
     - `packages/ui/` → `(ui)`
     - Multiple packages → omit scope
7. Generate clear, specific message:
   - ✅ `feat(api): add JWT refresh token endpoint`
   - ✅ `fix(web): resolve hydration mismatch on dashboard`
   - ❌ `feat: auto-ship changes from agent`
8. Commit with co-author:
   ```bash
   git commit -m "[type(scope)]: [specific description]

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   ```

### Phase 4 — Push
9. Push with protection against accidental overwrite:
   ```bash
   git push --force-with-lease origin HEAD
   ```

### Phase 5 — Pull Request
10. Check if PR already exists: `gh pr view 2>/dev/null`
11. If not, create PR with title and body derived from commit:
    ```bash
    gh pr create \
      --title "[commit message]" \
      --body "## Summary
    - [detected changes]

    ## Test plan
    - [ ] Smoke test
    - [ ] CI passing" \
      --base main
    ```
12. Display PR URL

### Post-Ship
13. Show final status: branch, commits pushed, PR URL
14. Suggest: wait for CI, request review with `gh pr status`

## Always Do
- Interrupt if on `main`/`master`
- Check `git status --short` before staging
- Use `.gitignore` as real protection
- Use `--force-with-lease` (never `--force`)
- Include Co-Authored-By in commit

## Never Do
- `--force` (use `--force-with-lease`)
- Generic commit messages
- Commit directly to `main`/`master`

## Shortcut
```bash
# Quick ship
git add -A && git commit -m "[type(scope)]: [desc]" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" && git push --force-with-lease origin HEAD
```
