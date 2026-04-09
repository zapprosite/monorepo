---
description: Git Mirror — Push para Gitea e GitHub em simultaneo
---

# /mirror — Git Mirror Workflow

> Push to both Gitea and GitHub simultaneously.

## Path
`/srv/monorepo`

## Remotes
- `gitea`: `ssh://git@127.0.0.1:2222/will-zappro/monorepo.git`
- `origin`: `git@github.com:zapprosite/monorepo.git`

## Prerequisites
- Remote `gitea` configured
- Remote `origin` configured
- SSH key loaded (`ssh-add -l` shows keys)
- Key `cli-key` authorized on Gitea

## Pattern

### 1. Verify Remotes
```bash
git remote -v
```
Expected:
```
gitea   ssh://git@127.0.0.1:2222/will-zappro/monorepo.git (push)
origin  git@github.com:zapprosite/monorepo.git (push)
```

### 2. Verify SSH for Gitea
```bash
ssh -o BatchMode=yes -o ConnectTimeout=5 git@127.0.0.1 -p 2222 echo "OK"
```
Expected: `OK`

### 3. Push to Both
```bash
# Push to Gitea
git push --force-with-lease gitea HEAD

# Push to GitHub
git push --force-with-lease origin HEAD
```

### 4. Create PRs (Optional)

**Gitea:**
```bash
# Via API
GITEA_TOKEN="$(cat ~/.config/gitea/_token 2>/dev/null || echo '')"
curl -X POST "https://gitea.zappro.site/api/v1/repos/will-zappro/monorepo/pulls" \
  -H "Authorization: Bearer $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"$TITLE\",\"head\":\"$BRANCH\",\"base\":\"main\"}"
```

**GitHub:**
```bash
gh pr create --title "$TITLE" --base main --body "## Summary\n$TITLE"
```

## Always Do
- Use `--force-with-lease` (never `--force`)
- Verify SSH before pushing
- Verify remotes before pushing

## Never Do
- Mirror `main` or `master` directly (use PR flow)
- Use `--force`

## Shortcut
```bash
# Push current branch to both remotes
git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD
```

## Aliases
```bash
# .bashrc or .zshrc
alias gpush='git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD'
alias gstatus='git remote -v && ssh -o BatchMode=yes -o ConnectTimeout=3 git@127.0.0.1 -p 2222 echo "Gitea SSH: OK" 2>/dev/null || echo "Gitea SSH: FAIL"'
```

## Error Mitigation
| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied (publickey)` | SSH key not loaded | `ssh-add ~/.ssh/id_ed25519` |
| `Port 22: Connection refused` | Gitea uses port 2222 | Use `ssh://git@127.0.0.1:2222/...` |
| `gh not authenticated` | GitHub CLI not logged in | `gh auth login` |
