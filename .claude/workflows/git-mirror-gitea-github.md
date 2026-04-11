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

**Gitea (via Infisical SDK):**
```python
# Python — usar Infisical SDK para obter token
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

client = InfisicalClient(settings=ClientSettings(
    access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    site_url='http://127.0.0.1:8200',
))

token = client.getSecret(GetSecretOptions(
    environment='dev',
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    secret_name='GITEA_TOKEN',
    path='/',
)).secret_value

# Depois usar o token:
import subprocess
result = subprocess.run([
    'curl', '-s', '-X', 'POST',
    'https://gitea.zappro.site/api/v1/repos/will-zappro/monorepo/pulls',
    '-H', f'Authorization: Bearer {token}',
    '-H', 'Content-Type: application/json',
    '-d', f'{{"title":"{title}","head":"{branch}","base":"main"}}'
], capture_output=True, text=True)
```

**Gitea (via CLI com env var):**
```bash
# Exportar do Infisical antes de usar
export GITEA_TOKEN="$(python3 -c "
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions
c = InfisicalClient(settings=ClientSettings(
    access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    site_url='http://127.0.0.1:8200',
))
print(c.getSecret(GetSecretOptions(
    environment='dev',
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    secret_name='GITEA_TOKEN',
    path='/',
)).secret_value)
")"

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
