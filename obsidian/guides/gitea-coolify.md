# CLI + Gitea + Coolify — Guia Completo de GitOps
> **will-zappro** | Ubuntu 6.17.0 | ZFS 3.46TB | RTX 4090
> Versão: 1.1 | 2026-04-04 | Coolify 4.0.0-beta.470

> **Nota Sentinel Fix (2026-04-04):** O Coolify Sentinel pode mostrar "Not Reachable" devido a múltiplos problemas encadeados:
> 1. UFW bloqueando porta 22 do Docker → corrigido com `ufw allow from 10.0.0.0/8 to any port 22`
> 2. Bug no código do Coolify (token comparison) → corrigido com patch em `api.php`
> 3. Chave SSH privada faltando no DB → corrigido com chave ED25519
> Snapshot ZFS criado: `tank@pre-20260404-055400-coolify-sentinel-patch`

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│  DESENVOLVEDOR                                             │
│                                                             │
│  claude (CLI)                                              │
│     │                                                      │
│     ├── /commit "fix: auth bug"                            │
│     ├── /commit-push-pr "feat: new endpoint"               │
│     └── git push                                           │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  GITEA (git.zappro.site)                                   │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐ │
│  │ Repositori │    │ Deploy Keys  │    │  Webhooks     │ │
│  │ o código   │    │ Coolify     │    │  Coolify ←────┼─┤
│  │ └──monorepo│    │ SSH read-only│    │  (push event)│ │
│  └─────────────┘    └──────────────┘    └───────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  COOLIFY (coolify.zappro.site)                              │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   │
│  │ Pull source │   │ Build image  │   │ Deploy       │   │
│  │ from Gitea  │   │ (Dockerfile)│   │ (docker up) │   │
│  └──────────────┘   └──────────────┘   └───────────────┘   │
│                                                              │
│  Servidores: localhost (host.docker.internal)                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Gitea — Setup e Configuração

### 1.1 Acesso
```bash
# Web UI
open https://git.zappro.site

# CLI (via SSH)
git clone git@git.zappro.site:will/monorepo.git
```

### 1.2 Autenticação SSH
```bash
# Gerar chave deploy (separada da pessoal)
ssh-keygen -t ed25519 -f ~/.ssh/gitea_deploy -N "" -C "coolify-deploy"

# Adicionar chave pública no Gitea
# Web: Settings → SSH Keys → Add Key → colar conteúdo de ~/.ssh/gitea_deploy.pub

# Testar conexão
ssh -i ~/.ssh/gitea_deploy git@git.zappro.site
# Esperado: "Hi {user}, you've successfully authenticated."

# Configurar git remote
git remote -v
git remote set-url origin git@git.zappro.site:will/monorepo.git

# Testar pull
git fetch origin
```

### 1.3 Deploy Key (para Coolify)
```bash
# Gerar chave para Coolify ler repos
ssh-keygen -t ed25519 -f ~/.ssh/coolify_git -N "" -C "coolify-git-access"

# Adicionar como Deploy Key no Gitea
# Repo → Settings → Deploy Keys → Add Key
# Marque "Allow write access" se quiser push via CI

# Testar
ssh -i ~/.ssh/coolify_git git@git.zappro.site
```

### 1.4 Webhooks
```bash
# No Gitea: Repo → Settings → Webhooks → Add Webhook → Gitea

# Ou via CLI (gitea binary)
gitea admin webhook create \
  --repo will/monorepo \
  --name "Coolify Deploy" \
  --url http://localhost:8000/api/v1/webhooks/gitea \
  --events push

# Webhook secreto (para validar payload)
# Gerar secret random
openssl rand -hex 32
```

---

## 2. Coolify — GitOps Setup

### 2.1 Conectar Gitea como Source Provider
```bash
# Web: Coolify → Settings → Sources → Add Source

# Tipo: Gitea
# URL: https://git.zappro.site
# Token: (criar token em git.zappro.site → Settings → Applications)
#         Scopes: repo, read:user, webhook
```

### 2.2 Criar Projeto e Aplicação
```bash
# Via API ou Web UI

# Estrutura recomendada no monorepo:
monorepo/
├── docker-compose.yml      # root compose
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   └── web/
│       ├── Dockerfile
│       └── docker-compose.yml
├── .coolify/
│   └── coolify.yml        # config de deploy
└── .env.example
```

### 2.3 Configuração de Build
```yaml
# .coolify/coolify.yml (exemplo)
version: 1
applications:
  - name: monorepo-api
    build:
      dockerfile: apps/api/Dockerfile
      context: .
    deploy:
      port: 3000
      environment:
        - NODE_ENV=production
      volumes: []
    git:
      branch: main
      commit_message: "{{ commit_message }}"
```

### 2.4 Variáveis de Ambiente no Coolify
```bash
# Coolify Web → Application → Environment Variables
NODE_ENV=production
DATABASE_URL=${DB_URL}
API_KEY=${API_KEY}          # Coolify secrets
```

### 2.5 Health Check
```bash
# Adicionar no Dockerfile ou docker-compose.yml
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:PORT/health || exit 1

# No Coolify: Application → Health Check
# URL: /health
# Expected: 200
```

### 2.6 Deploy Keys no Coolify
```bash
# Coolify → Settings → Private Keys → Add

# Nome: gitea-readonly
# Private Key: (conteúdo de ~/.ssh/coolify_git)
# Description: Read-only deploy key for Gitea repos

# Depois: Application → Source → Select Private Key
```

---

## 3. Claude Code CLI — Git Workflow

### 3.1 Plugins Instalados (use!)
```bash
/commit "descrição"                    # Commit staged + push
/commit-push-pr "feat: nova feature"  # Commit + push + PR
/clean_gone                           # Remove branches merged
/code-review                          # Review com 5 Sonnets
```

### 3.2 Fluxo Completo de Trabalho

```bash
# ════════════════════════════════════════════════════════════
# 1. BRANCH — Criar feature branch
# ════════════════════════════════════════════════════════════

git checkout -b feat/nova-api
# ou via Claude Code:
# "create a branch feat/nova-api"

# ════════════════════════════════════════════════════════════
# 2. DESENVOLVER — Fazer mudanças
# ════════════════════════════════════════════════════════════

# Claude Code ajuda a implementar, testar, debugar
# commitar pequenas mudanças incrementais:

/commit "refactor: extrair auth middleware"

/commit "fix: cors origin validation"

/commit "feat: novo endpoint /health/detailed"

# ════════════════════════════════════════════════════════════
# 3. REVISAR — Code review antes de merge
# ════════════════════════════════════════════════════════════

# Usar o plugin de code review
/code-review

# Ou revisão manual:
git diff main..feat/nova-api
git log main..feat/nova-api --oneline

# ════════════════════════════════════════════════════════════
# 4. MERGE — Commit + Push + PR em um comando
# ════════════════════════════════════════════════════════════

/commit-push-pr "feat: health check detalhado

Adiciona:
- /health/detailed endpoint com métricas de sistema
- Inclui uptime, memory, CPU stats
- Health check no Coolify atualizado"

# ════════════════════════════════════════════════════════════
# 5. DEPLOY — Coolify detecta push e faz rebuild
# ════════════════════════════════════════════════════════════

# Coolify automaticamente:
# 1. Recebe webhook do Gitea
# 2. Pull do código da branch atual
# 3. Build da imagem Docker
# 4. Deploy com zero-downtime (se configurado)
# 5. Health check

# Ver deploy no Coolify:
# Web: https://coolify.zappro.site → Application → Deployments
```

### 3.3 Commit Messages — Formato
```
<tipo>(<escopo>): <descrição curta>

[corpo opcional - mais detalhes]

[footer opcional - issues, breaking changes]

Exemplos:
feat(api): adicionar endpoint /health/detailed

fix(auth): corrigir validação de JWT expiry
Breaks: API /auth/login response format

refactor(db): extrair query builder para classe própria

chore(deps): atualizar dependencies para latest
```

### 3.4 Branches — Convenções
```
main                  → produção (protegido)
develop              → staging (opcional)
feat/<nome>          → features
fix/<nome>           → bug fixes
refactor/<nome>      → refactors
hotfix/<nome>        → urgents
docs/<nome>          → documentação
```

---

## 4. Webhook — Fluxo Completo

```
Gitea                    Coolify                 O que acontece
─────────────────────────────────────────────────────────────────────
Developer faz push  ──▶  Recebe webhook    ──▶  Parse payload
                          │
                          ▼
                       Qual repo/branch?  ──▶  Filtra por repo
                          │
                          ▼
                       Trigger rebuild   ──▶  Pull latest commit
                          │
                          ▼
                       Build Docker     ──▶  docker build
                          │
                          ▼
                       Deploy          ──▶  docker compose up -d
                          │
                          ▼
                       Health check    ──▶  GET /health
                          │
                          ▼
                       Sucesso/Falha   ──▶  Notifica (Slack, Discord)
```

### 4.1 Validar Webhook Secret
```bash
# Coolify automaticamente valida se webhook tem secret configurado
# Gitea: Settings → Webhooks → Edit → Secret
# Coolify: Application → Webhooks → Add → secret
```

### 4.2 Filtrar Eventos
```bash
# No Coolify, configurar quais eventos disparam deploy:
# [X] Push
# [ ] Tag
# [ ] Pull Request (para preview deployments)
```

---

## 5. Segurança — Boas Práticas

### 5.1 Secrets
```bash
# NUNCA commitar secrets no repo
# Usar .env.example como template

# Coolify Secrets (Web UI):
# Application → Environment → Secrets
# NOME=SECRET_VALUE

# ⚠️ IMPORTANTE: Secrets do Coolify são gerenciadas via INFISICAL
# Ver: manter_infisical.md e guide-manutencao-continua.md
# Secrets críticas: APP_KEY, DB_PASSWORD, REDIS_PASSWORD, etc.

# Variáveis públicas no .env (sem valores sensíveis)
# Variáveis de staging vs produção SEPARADAS

# .gitignore обязательно:
.env
.env.*
*.pem
*.key
credentials.json
```

### 5.2 Deploy Keys — Princípio do Menor Privilégio
```bash
# Chave de PRODUÇÃO: read-only, sem acesso a secrets
# Chave de DEV: pode fazer push (para CI/CD pipelines)

# Gitea: Settings → Deploy Keys por repo
# NUNCA a mesma chave em todos os repos
```

### 5.3 Revisão Obrigatória
```bash
# main branch = protegido
# Regra: PR requer 1 aprovação antes de merge
# No Gitea: Repo → Settings → Branch Settings → Protected Branch
#   [X] Require pull request reviews
#   [X] Dismiss stale reviews
#   [X] Require conversation resolution
```

---

## 6. Comandos Rápidos

### 6.1 Git
```bash
# Status geral
git status
git log --oneline -10
git diff --stat

# Sync
git fetch origin
git pull origin main --rebase

# Branch
git branch -a
git checkout main && git pull
git checkout -b feat/nome

# Cleanup
git branch -d feat/nome            # Local
git push origin --delete feat/nome  # Remoto
git fetch --prune                   # Limpa branches apagados

# stash (alternativa a commit)
git stash
git stash pop
git stash list
```

### 6.2 Gitea CLI (gitea)
```bash
# Instalar: https://docs.gitea.com/installation/install-with-docker
gitea admin user create \
  --name will \
  --email will@zappro.site \
  --password "SUBSTITUIR_POR_SENHA_REAL" \
  --admin

# Criar repo
gitea admin repo create \
  --name monorepo \
  --description "Monorepo principal" \
  --private true

# Ver tokens
gitea admin oauth list
```

### 6.3 Coolify API
```bash
# Base URL
BASE="http://localhost:8000/api/v1"

# Headers (precisa de API key)
AUTH="Authorization: Bearer $(cat ~/.coolify_api_key)"

# Deploy manual
curl -X POST "$BASE/deployments" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"application_id": 1, "commit": "HEAD"}'

# Rollback
curl -X POST "$BASE/deployments/rollback" \
  -H "$AUTH" \
  -d '{"application_id": 1, "deployment_id": 42}'

# Ver logs
curl -s "$BASE/deployments/42/logs" -H "$AUTH" | tail -50
```

### 6.4 Docker (manutenção)
```bash
# Ver todos containers
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Rebuild e restart manual (fallback se Coolify não responder ou deploy travar)
cd /srv/monorepo
docker compose build --no-cache api
docker compose up -d --force-recreate api
docker logs -f monorepo-api

# Cleanup
docker system prune -f
docker image prune -f
docker volume prune -f
```

---

## 7. Troubleshooting

### 7.1 Coolify não recebe webhook
```bash
# 1. Verificar se webhook está configurado
curl -s http://localhost:8000/api/v1/webhooks/gitea \
  -H "Content-Type: application/json" \
  -d '{"secret": "seu_secret"}'

# 2. Ver logs do Gitea
GITEA_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i gitea | head -1)
docker logs "$GITEA_CONTAINER" --tail 50 | grep -i webhook

# 3. Testar endpoint manualmente
curl -X POST http://localhost:8000/api/v1/webhooks/gitea \
  -H "Content-Type: application/json" \
  -H "X-Gitea-Event: push" \
  -d '@test/webhook_payload.json'

# 4. Verificar que Gitea consegue alcançar Coolify
#    Coolify deve estar acessível via host.docker.internal ou IP do host
#    Gitea container não consegue alcançar localhost do host
```

### 7.2 Deploy falha no Coolify
```bash
# 1. Ver deployment logs
#    Coolify Web → Application → Deployments → Last → Logs

# 2. Verificar Dockerfile
docker build -t test-app apps/api/
docker run --rm test-app

# 3. Health check falhando
curl -f http://localhost:PORTA/health
# Se falhar: o deploy trava em "waiting for healthy"

# 4. Falha de permission
docker exec coolify sh -c "ls -la /var/www/html/storage/app/ssh/"
```

### 7.3 Gitea não conecta ao Coolify
```bash
# 1. Verificar redes Docker
docker network ls | grep -E "coolify|gitea"
docker network inspect coolify 2>/dev/null | grep -i "Name\|gitea" || echo "Rede coolify nao encontrada"

# 2. Testar DNS interno
GITEA_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i gitea | head -1)
docker exec "$GITEA_CONTAINER" ping -c1 coolify 2>/dev/null || echo "DNS interno coolify nao resolve"
docker exec coolify sh -c "ping -c1 host.docker.internal" 2>/dev/null || echo "host.docker.internal nao resolve"

# 3. Verificar que o token do Gitea não expirou
#    Gitea → Settings → Applications → Token expiry
```

### 7.4 SSH key não funciona
```bash
# Debug SSH
ssh -vvv -i ~/.ssh/coolify_git git@git.zappro.site
# Códigos:
#   0 = success
#   1 = generic error (verificar key)
#   255 = authentication failed

# Verificar chave pública adicionada no Gitea
GITEA_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i gitea | head -1)
docker exec "$GITEA_CONTAINER" find / -name "authorized_keys" -path "*/gitea*" 2>/dev/null | head -3
docker exec "$GITEA_CONTAINER" cat "$(docker exec "$GITEA_CONTAINER" find / -name "authorized_keys" -path "*/gitea*" 2>/dev/null | head -1)" 2>/dev/null | grep coolify

# Regenerar chave se necessário
ssh-keygen -t ed25519 -f ~/.ssh/coolify_git -N "" -C "coolify-git"
```

### 7.5 Coolify Sentinel "Not Reachable" — Troubleshooting Completo
```bash
# ══════════════════════════════════════════════════════════════
# VERIFICAÇÃO 1: Firewall UFW
# ══════════════════════════════════════════════════════════════
# Coolify container precisa alcançar host via SSH (porta 22)
sudo ufw status | grep -E "22.*docker0|docker0.*22"
# Se não existir:
sudo ufw allow from 10.0.0.0/8 to any port 22 comment "Coolify Docker SSH"

# ══════════════════════════════════════════════════════════════
# VERIFICAÇÃO 2: Chave SSH no DB
# ══════════════════════════════════════════════════════════════
docker exec coolify-db psql -U coolify -d coolify -c "SELECT id, name FROM private_keys;"
# Se vazio ou ID=0 não existe → inserir chave

# ══════════════════════════════════════════════════════════════
# VERIFICAÇÃO 3: Chave no filesystem
# ══════════════════════════════════════════════════════════════
sudo ls -la /data/coolify/ssh/keys/
# Deve ter arquivo: ssh_key@<server_uuid>

# ══════════════════════════════════════════════════════════════
# VERIFICAÇÃO 4: Testar SSH do container para host
# ══════════════════════════════════════════════════════════════
docker exec coolify ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no \
  -i /var/www/html/storage/app/ssh/keys/ssh_key@<uuid> \
  will@10.0.10.1 echo "SSH WORKS"

# ══════════════════════════════════════════════════════════════
# VERIFICAÇÃO 5: Server status no DB
# ══════════════════════════════════════════════════════════════
docker exec coolify-db psql -U coolify -d coolify -c \
  "SELECT s.name, ss.is_reachable, ss.is_usable FROM servers s JOIN server_settings ss ON s.id = ss.server_id WHERE s.name='localhost';"
# Esperado: is_reachable=t, is_usable=t

# ══════════════════════════════════════════════════════════════
# VERIFICAÇÃO 6: Testar Sentinel push manualmente
# ══════════════════════════════════════════════════════════════
TOKEN=$(docker exec coolify-db psql -U coolify -d coolify -c \
  "SELECT sentinel_token FROM server_settings WHERE server_id=0;" -t | tr -d ' ')
curl -X POST http://localhost:8000/api/v1/sentinel/push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# Esperado: {"message":"ok"}
```

---

## 8. Rotina Diária Recomendada

```bash
# ══════════════════════════════════════════════════════════════
# INÍCIO DO DIA
# ══════════════════════════════════════════════════════════════

# 1. Sync main branch
git checkout main && git pull

# 2. Verificar se há PRs pendentes
#    https://git.zappro.site → Pull Requests

# 3. Ver deploys recentes no Coolify
#    https://coolify.zappro.site → Applications → Deployments

# ══════════════════════════════════════════════════════════════
# DURANTE O DIA
# ══════════════════════════════════════════════════════════════

# 4. Trabalhar em feature
git checkout -b feat/minha-feature
# Usar Claude Code para implementar

# 5. Commitar pequenas mudanças
/commit "fix: typo no README"

# 6. Testar localmente
docker compose up --build api
# ou
cd apps/api && npm run dev

# ══════════════════════════════════════════════════════════════
# FINALIZAR FEATURE
# ══════════════════════════════════════════════════════════════

# 7. Code review
/code-review

# 8. Merge via PR
/commit-push-pr "feat: minha feature

Adiciona nova funcionalidade X:
- Endpoint /api/x
- Testes unitários
- Documentação"

# ══════════════════════════════════════════════════════════════
# AUTOMÁTICO (via webhook)
# ══════════════════════════════════════════════════════════════

# Coolify detecta push no main
# → Pull do código
# → Build da imagem
# → Deploy
# → Health check
# → Sucesso!

# Ver resultado:
# https://coolify.zappro.site → Applications → Deployment #42 ✅
```

---

## 9. Referências

| Recurso | URL/Path |
|---------|----------|
| Gitea Docs | `docs.gitea.com` |
| Coolify Docs | `coolify.io/docs` |
| Coolify Git | `github.com/coollabsio/coolify` |
| Claude Code Plugins | `~/.claude/plugins/` |
| Gitea Webhooks | Repo → Settings → Webhooks |
| Coolify API | `https://coolify.zappro.site/api/v1` |
| Guardrails | `/srv/ops/ai-governance/GUARDRAILS.md` |
| manter_infisical.md | Secrets e vault |
| Coolify Git | `github.com/coollabsio/coolify` |
| Claude Code Plugins | `~/.claude/plugins/` |
| Gitea Webhooks | Repo → Settings → Webhooks |
| Coolify API | `https://coolify.zappro.site/api/v1` |
| Guardrails | `/srv/ops/ai-governance/GUARDRAILS.md` |

---

*CLI + Gitea + Coolify GitOps — will-zappro | Atualize quando mudar a stack*
