---
description: Quick ship — commit → push ambos remotes → merge main → tag → nova branch. Uso diário.
---

# /turbo — Quick Feature Ship

> Sem PR, sem docs sync. Para ciclo completo usa `/ship`.

## Fluxo

```
STAGE → COMMIT → PUSH GITEA+GITHUB → MERGE MAIN → TAG → NOVA BRANCH
```

## Passos

### 1. Stage tudo
```bash
git add -A
git diff --cached --stat
```

### 2. Commit semântico
```bash
git commit -m "feat|fix|chore(scope): descrição"
```

### 3. Push ambos remotes
```bash
BRANCH=$(git branch --show-current)
git push --force-with-lease gitea "$BRANCH"
git push --force-with-lease origin "$BRANCH"
```

### 4. Merge na main
```bash
git checkout main
git pull origin main --ff-only
git merge "$BRANCH" --ff-only
git push gitea main
git push origin main
git checkout "$BRANCH"
```

### 5. Tag automática
```bash
TAG="v$(date +%Y%m%d%H%M)"
git tag "$TAG" -m "release: $TAG"
git push gitea --tags
git push origin --tags
```

### 6. Nova branch aleatória
```bash
ADJ="quantum iron silent stellar neon micro swift"
SUB="kernel matrix conduit ledger engine forge helix"
NOME=$(echo "$ADJ" | tr ' ' '\n' | shuf -n1)-$(echo "$SUB" | tr ' ' '\n' | shuf -n1)-$(date +%s)
git checkout -b "feature/$NOME"
```

## Safety

- ❌ Não roda em `main`
- ✅ `--ff-only` no merge
- ✅ `--force-with-lease` no push
- ✅ Dual remotes (gitea + origin) sempre
