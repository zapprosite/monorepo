---
name: gitea-cli
type: skill
description: Gitea API/CLI para gerir repos, workflows, PRs e automate second-brain sync
trigger: gitea | api gitea | repositório gitea
---

# Gitea CLI — Referência Rápida

## Autenticação

```bash
# Token (do .env — GITEA_TOKEN)
GITEA_TOKEN=$(grep -i '^GITEA_TOKEN=' /srv/monorepo/.env | cut -d= -f2-)
GITEA_API="http://127.0.0.1:3300/api/v1"
```

## Repos

```bash
# Listar repos do utilizador
curl -s -X GET "$GITEA_API/user/repos" -H "Authorization: Bearer $GITEA_TOKEN"

# Criar repo
curl -s -X POST "$GITEA_API/user/repos" \
  -H "Authorization: Bearer $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"nome-repo","private":true}'

# Obter conteúdo de ficheiro (para ler TREE.md)
curl -s -X GET "$GITEA_API/repos/will-zappro/hermes-second-brain/contents/TREE.md" \
  -H "Authorization: Bearer $GITEA_TOKEN"

# Atualizar ficheiro (base64-encoded, requer SHA)
curl -s -X PUT "$GITEA_API/repos/will-zappro/hermes-second-brain/contents/monorepo-TREE.md" \
  -H "Authorization: Bearer $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"chore: update\",\"content\":\"$(base64 -w0 < /tmp/tree.md)\",\"sha\":\"$SHA\"}"
```

## Actions / Workflows

```bash
# Listar runs de workflow
curl -s -X GET "$GITEA_API/repos/will-zappro/monorepo/actions/runs" \
  -H "Authorization: Bearer $GITEA_TOKEN"

# Trigger workflow manualmente
curl -s -X POST "$GITEA_API/repos/will-zappro/monorepo/actions/workflows/test.yml/dispatch" \
  -H "Authorization: Bearer $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref":"main"}'
```

## Git (SSH)

```bash
# Clone via SSH interno ( runner → gitea )
git clone ssh://git@127.0.0.1:2222/will-zappro/hermes-second-brain.git /tmp/sb
```

## Pulo do Macaco

- runner Gitea Actions **não tem rede para** `127.0.0.1:2222` — usar **API HTTP** (`http://gitea:3000`) em vez de git clone
- `GITEA_TOKEN` no `.env` do monorepo, **não** do runner (runner usa secrets)
- SHA do ficheiro é obrigatório em PUT (obtido via GET antes)
- Runner container nome: `gitea-runner` — acessível via `http://gitea:3000` (Docker network)

---

## Second Brain Sync (Pipeline Completo)

```bash
# 1. Gerar TREE.md do monorepo
cd /srv/monorepo
git pull origin main
./scripts/sync-second-brain.sh

# 2. Push para second-brain via API
# (ver script scripts/sync-second-brain.sh)
```

**Mecanismo**: Gitea Actions no monorepo dispara no `push to main` e atualiza `hermes-second-brain` via API — não precisa de git clone no runner.
