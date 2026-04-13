---
description: Quick feature ship — commit → push → merge main → tag → nova branch. Sem PR. Dual remotes.
---

# /turbo — Quick Feature Ship

> Quick flow quando a feature está pronta e queres fazer merge sem PR. Sem docs sync, sem PR creation. Para end-of-session completo, usa `/ship`.

**⚠️ AVISO:** Execute apenas se `.gitignore` contém `.env` e secrets antes de continuar.

## Fluxo

```
STAGE → COMMIT → PUSH → MERGE MAIN → TAG → NOVA BRANCH
```

## Passos

### 1. Stage
```bash
git add -A
```

### 2. Commit Semântico
```bash
# Detectar tipo e escopo do diff
git diff --cached --stat

# Conventional commit
git commit -m "[feat|fix|chore|docs|refactor](escopo): descrição

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### 3. Push (ambos remotes)
```bash
BRANCH=$(git branch --show-current)
git push origin HEAD 2>&1
git push gitea HEAD 2>&1
```

### 4. Merge em Main
```bash
git checkout main
git pull origin main --ff-only
git push origin main
git push gitea main
git checkout "$BRANCH"
```

### 5. Tag
```bash
git tag v$(date +%Y%m%d%H%M) -m "release: v$(date +%Y%m%d%H%M)"
git push origin --tags
```

### 6. Nova Feature Branch
```bash
TIMESTAMP=$(date +%s)
ADJETIVO=$(shuf -n1 <<< "quantum iron silent stellar neon micro swift")
SUBSTANTIVO=$(shuf -n1 <<< "kernel matrix conduit ledger engine forge helix")
git checkout -b "feature/$ADJETIVO-$SUBSTANTIVO-$TIMESTAMP"
```

## Diferença

| | `/ship` | `/turbo` |
|--|---------|----------|
| Docs sync | ✅ Sim | ❌ Não |
| PR criada | ❌ Não | ❌ Não |
| Dual remotes | ✅ origin + gitea | ✅ origin + gitea |
| Merge main | ✅ Sempre | ✅ Sempre |
| Tag | ❌ Não | ✅ Sim |
| Quando | Fim de sessão | Feature pronta |

## Safety

- ❌ Não executa em `main` diretamente
- ✅ Usa `--ff-only` no merge (evita conflitos)
- ✅ Push para ambos remotes sempre
