---
description: Modo turbo — commit, push, merge em main, tag e nova feature branch, tudo de uma vez.
---

# /turbo — Git Turbo Workflow

> ⚡ Commit + merge to main + tag + new feature branch in one flow. Use when in a hurry.

## Path
`/srv/monorepo`

## Pattern

### Step 1 — Save What You Have
1. Stage tracked + new non-ignored:
   ```bash
   git add -A
   ```
   The `.gitignore` is the real protection against secrets and build artifacts.
2. Verify staged: `git diff --cached --stat`
   - If nothing staged, skip to Step 5 directly.

### Step 2 — Commit
3. Generate message in format `chore([scope]): [verb]-[noun]` with technical vocabulary:
   - Examples: `chore(core): patch signal-router`, `chore(api): wire async-conduit`,
     `chore(infra): align void-matrix`, `chore(db): sync iron-ledger`
   - Detect scope by path of changed files: `api`, `web`, `ui`, `core`
4. Commit:
   ```bash
   git commit -m "chore([scope]): [description]

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   ```

### Step 3 — Push Current Branch
5. Get current branch: `git branch --show-current`
6. Push with protection:
   ```bash
   git push --force-with-lease origin HEAD
   ```

### Step 4 — Merge in Main
7. Checkout main and update:
   ```bash
   git checkout main
   git pull origin main
   ```
8. Merge source branch:
   ```bash
   git merge --no-ff [source-branch] -m "chore: merge [source-branch] → main"
   ```
9. Push main:
   ```bash
   git push origin main
   ```

### Step 5 — Tag
10. Generate tag name in format `v0.[n].[n]-[codename]`:
    - Examples: `v0.9.1-phantom`, `v0.7.3-nebula`, `v0.4.2-forge`, `v0.6.0-eclipse`
11. Create and push tag:
    ```bash
    git tag -a [tag-name] -m "release: [tag-name]"
    git push origin [tag-name]
    ```

### Step 6 — New Feature Branch
12. Generate creative name in format `[adjective]-[noun]`:
    - Examples: `dark-runtime`, `swift-conduit`, `nano-kernel`, `flux-engine`, `zero-payload`
13. Create branch and setup upstream:
    ```bash
    git checkout -b feature/[name]
    git push -u origin feature/[name]
    ```

## Quick Reference
| Action | Command |
|--------|---------|
| Commit | `chore([scope]): [description]` |
| Merge | `git merge --no-ff [branch] -m "chore: merge [branch] → main"` |
| Tag | `v0.N.N-[codename]` |
| New branch | `feature/[adjective-noun]` |

## Always Do
- Use `--force-with-lease`
- Wait for CI before turbo-ing
- Include Co-Authored-By in commit

## Never Do
- Turbo on `main` directly
- Skip CI verification
- Use `--force` (use `--force-with-lease`)

## Shortcut
```bash
# Full turbo (assumes clean staging)
git add -A && git commit -m "chore([scope]): [desc]" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" && git push --force-with-lease origin HEAD && git checkout main && git pull origin main && git merge --no-ff [branch] -m "chore: merge [branch] → main" && git push origin main && git tag -a v0.N.N-[codename] -m "release: v0.N.N-[codename]" && git push origin v0.N.N-[codename] && git checkout -b feature/[new-name] && git push -u origin feature/[new-name]
```
