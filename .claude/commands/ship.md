---
description: Deploy completo — review → sync docs → commit → push dual remotes → PR. Para end-of-session e pre-deploy.
---

# /ship — End-of-Session Deploy

> Fluxo completo de fim de sessão. Para commit rápido sem PR, usa `/turbo`.

## Fluxo

```
REVIEW → SYNC DOCS → COMMIT → PUSH GITEA+GITHUB → PR
```

## Passos

### 1. Review (secrets audit)
```bash
bash /srv/monorepo/scripts/sre-check.sh ci --json
```

### 2. Sync docs → memory
```bash
bash /srv/monorepo/scripts/sync-memory.sh
```

### 3. Commit semântico
```bash
git add -A
git diff --cached --stat
git commit -m "feat|fix|chore(scope): description"
```

### 4. Push dual remotes (Gitea + GitHub)
```bash
BRANCH=$(git branch --show-current)
git push --force-with-lease gitea "$BRANCH"
git push --force-with-lease origin "$BRANCH"
```

### 5. Criar PR (Gitea)
```bash
gh pr create --title "..." --body "..." --base main --repo will-zappro/monorepo
```

## Safety

- ❌ Não roda em `main`
- ✅ `--force-with-lease` (nunca `--force`)
- ✅ Secrets audit antes do push
- ✅ Ambos remotes sempre
