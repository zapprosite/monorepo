# CEO MIX — Habilidades de Infraestrutura

**Data:** 2026-04-07
**Versao:** 1.0
**Para:** CEO MIX (@CEO_REFRIMIX_bot)
**Ler antes:** APPROVAL_MATRIX.md, SUBDOMAINS.md, PORTS.md

---

## Aviso Importante

**Nem tudo que voce pode MEAR, voce DEVE fazer sozinho.**
Algumas operacoes precisam de APPROVAL antes de executar.

Regra geral:
- **Read-only** (docker ps, curl health, cat .md): pode fazer livremente
- **Adicionar subdomínio, mudar Terraform**: PRECISA DE APROVACAO
- **Docker restart/stop, ZFS snapshot**: PRECISA DE APROVACAO
- **Destrutivo** (rm -rf, zfs destroy): NUNCA

Fonte: `/srv/ops/ai-governance/APPROVAL_MATRIX.md`

---

## 1. Infisical — Gerenciamento de Secrets

### O que e

Infisical e o cofre de senhas do homelab. Todos os secrets (API keys, senhas, tokens)
vivem la, NAO no codigo.

**Acesso:**
- Vault UI: https://vault.zappro.site
- API local: http://127.0.0.1:8200
- Via Tailscale: http://100.124.78.36:8200

### Credenciais de Acesso (para scripts)

```
HOST=http://127.0.0.1:8200
TOKEN=st.799590ae-d36f-4e64-b940-aea0fb85cad8.6e0c269870bb4b5e004e3ed6ab3a1fe1.c9872f2b30bc650e7b27c851df04b0ad
PROJECT_ID=e42657ef-98b2-4b9c-9a04-46c093bd6d37
ENVIRONMENT=dev
```

### Python SDK — Ler Secrets

```python
from infisical_sdk import InfisicalSDKClient

client = InfisicalSDKClient(
    host="http://127.0.0.1:8200",
    token="st.799590ae-d36f-4e64-b940-aea0fb85cad8.6e0c269870bb4b5e004e3ed6ab3a1fe1.c9872f2b30bc650e7b27c851df04b0ad"
)

secrets = client.secrets.list_secrets(
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/"
)
for s in secrets.secrets:
    print(f"{s.secret_key} = {s.secret_value}")
```

### Python SDK — Criar/Atualizar Secret

```python
# Criar novo secret
client.secrets.create_secret_by_name(
    secret_name="NOVA_CHAVE",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/",
    secret_value="valor"
)

# Atualizar existente
client.secrets.update_secret_by_name(
    current_secret_name="NOVA_CHAVE",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/",
    secret_value="novo_valor"
)
```

### Regras de Seguranca

- NUNCA mostrar secrets no chat — apenas o nome da chave
- NUNCA commitar secrets — usar Infisical
- Antes de adicionar secret novo: perguntar ao Mestre
- Secrets da instancia (ENCRYPTION_KEY, AUTH_SECRET): NAO MODIFICAR

---

## 2. Subdominios — Criar via Terraform

### Arquitetura

```
Mestre pede: "crie btu.zappro.site"
        |
        v
1. AUDIT (voce)
   - Verificar se porta esta livre (PORTS.md)
   - Verificar se subdomain nao existe (SUBDOMAINS.md)
   - Classificar: STANDARD CHANGE (precisa snapshot + approval)
        |
        v
2. PERGUNTAR AO MESTRE
   - "Posso criar btu.zappro.site apontando para :XXXX?"
   - Esperar confirmacao
        |
        v
3. EDITAR TERRAFORM (com snapshot)
   - /srv/ops/terraform/cloudflare/variables.tf
   - /srv/ops/terraform/cloudflare/main.tf
        |
        v
4. PLANO
   - terraform plan
   - Mostrar o que vai mudar
        |
        v
5. APPLY
   - terraform apply
   - cloudflared restart
        |
        v
6. ATUALIZAR DOCS
   - SUBDOMAINS.md
   - PORTS.md (se nova porta)
   - NETWORK_MAP.md (se novo servico)
        |
        v
7. COMMIT + PUSH
```

### Passo a Passo — Exemplo: btu.zappro.site na porta 4005

#### AUDIT — Checklist

```
1. Porta 4005 esta livre?
   ss -tlnp | grep :4005
  Resultado esperado: vazio (porta livre)

2. btu.zappro.site ja existe?
   grep btu SUBDOMAINS.md
   Resultado esperado: nada (nao existe)

3. Classificacao?
   - Adicionar subdomain: STANDARD CHANGE
   - Precisa: snapshot + approval
```

#### PERGUNTAR AO MESTRE

```
Mestre, posso criar btu.zappro.site?
- Subdomain: btu.zappro.site
- Porta: 4005 (Docker localhost)
- Tipo: STANDARD CHANGE (precisa snapshot ZFS)
- Terraform plan ja mostra o que vai mudar
Aguardo confirmacao para prosseguir.
```

#### APOS APROVACAO — Snapshot

```bash
sudo zfs snapshot -r "tank@pre-btu-subdomain-$(date +%Y%m%d-%H%M%S)"
```

#### EDITAR variables.tf

Adicionar em `variable "services"`:

```hcl
btu = {
  url       = "http://localhost:4005"
  subdomain = "btu"
}
```

#### EDITAR main.tf

Adicionar novo `ingress_rule`:

```hcl
ingress_rule {
  hostname = "${var.services.btu.subdomain}.${var.domain}"
  path     = ""
  service  = var.services.btu.url
}
```

Se o servico precisa de http_host_header custom (como bot), adicionar:

```hcl
ingress_rule {
  hostname = "${var.services.btu.subdomain}.${var.domain}"
  path     = ""
  service  = var.services.btu.url
  origin_request {
    http_host_header = "btu-service.host.internal"
  }
}
```

#### PLANO

```bash
cd /srv/ops/terraform/cloudflare
terraform plan
# Mostrar output ao Mestre
```

#### APPLY

```bash
terraform apply
# Digitar "yes" quando perguntar
```

#### RESTART TUNNEL

```bash
sudo systemctl restart cloudflared
sleep 5
curl -sfI https://btu.zappro.site
```

#### ATUALIZAR DOCS

```bash
# SUBDOMAINS.md — adicionar linha na tabela
| [btu.zappro.site](https://btu.zappro.site) | 4005 | ✅ ATIVO | Meu novo servico — :4005 |

# PORTS.md — se nova porta
| **4005** | — | localhost | Meu novo servico | btu.zappro.site |

# NETWORK_MAP.md — se novo servico
```

---

## 3. Deploy via Coolify + Gitea

### Fluxo Completo

```
1. Code push para Gitea (git.zappro.site)
       |
       v
2. Gitea envia webhook para Coolify (coolify.zappro.site)
       |
       v
3. Coolify detecta push → pull do codigo
       |
       v
4. Coolify constroi imagem Docker (docker build)
       |
       v
5. Coolify deploy (docker compose up -d)
       |
       v
6. Health check
       |
       v
7. Sucesso/Falha
```

### Para criar uma aplicacao no Coolify via Gitea

```
1. Coolify → Settings → Sources → Add Source
   Tipo: Gitea
   URL: https://git.zappro.site
   Token: (criar em git.zappro.site → Settings → Applications)

2. Coolify → New Project → New Application
   Repository: git.zappro.site/will/NOME_DO_REPO.git
   Branch: main

3. Configurar build:
   - Dockerfile path (ex: apps/api/Dockerfile)
   - Health check URL (ex: /health)

4. Configurar environment variables:
   -coolify Secrets (buscar do Infisical)
```

### Variáveis de Ambiente

```
NODE_ENV=production
DATABASE_URL=${DB_URL}        # Coolify managed secret
API_KEY=${API_KEY}             # Coolify managed secret
```

### Secrets no Coolify

```
Coolify Secrets → Application → Environment → Secrets
# NUNCA hardcodar valores
# Buscar do Infisical antes de configurar
```

### Health Check

```yaml
# No Dockerfile ou docker-compose.yml
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:PORT/health || exit 1
```

---

## 4. Criar Subdomain + Deploy — Exemplo Completo "btu"

Vamos supor que o Mestre quer: "criar btu.zappro.site para um servico em :4005 via Coolify"

### FASE 1: AUDIT (voce faz sozinho)

```
1. ss -tlnp | grep :4005  → Porta livre?
2. grep btu /srv/ops/ai-governance/SUBDOMAINS.md  → Subdomain ja existe?
3. Classificar: STANDARD CHANGE
```

### FASE 2: PERGUNTAR

```
Mestre, para criar btu.zappro.site apontando para :4005 preciso de:
1. Aprovacao sua (STANDARD CHANGE)
2. ZFS snapshot (crio automaticamente)
3. Terraform plan (mostro antes de aplicar)
4. Restart do cloudflared

Posso prosseguir com o plano?
```

### FASE 3: PLANO COMPLETO

```
TAREFA 1: Adicionar subdomain btu.zappro.site via Terraform
  - Editar: variables.tf + main.tf
  - Plan: terraform plan
  - Apply: terraform apply
  - Restart: cloudflared

TAREFA 2: Deploy no Coolify (se aplicavel)
  - Repo: git@git.zappro.site:will/btu-app.git
  - Porta: 4005
  - Health: /health
```

### FASE 4: EXECUTAR (apos approval)

```bash
# 1. Snapshot
sudo zfs snapshot -r "tank@pre-btu-$(date +%Y%m%d-%H%M%S)"

# 2. Terraform
cd /srv/ops/terraform/cloudflare
# ... (editar files, plan, apply)

# 3. Testar
curl -sfI https://btu.zappro.site

# 4. Commit docs
cd /srv/monorepo
git add docs/guides/SUBDOMAINS.md
git commit -m "feat: added btu.zappro.site subdomain"
git push
```

---

## 5. Checklist de Auditoria (sempre antes de tocar infra)

```
AUDITORIA — [NOME DO PEDIDO]

[ ] 1. Li APPROVAL_MATRIX.md? (sei se precisa approval)
[ ] 2. Li SUBDOMAINS.md? (subdomain nao existe)
[ ] 3. Li PORTS.md? (porta esta livre)
[ ] 4. Classifiquei a mudanca:
       MINOR    = documentacao, leitura
       STANDARD = subdomain, env vars, docker restart
       STRUCTURAL = ZFS, Docker stack
       CRITICAL = kernel, reboot
[ ] 5. Se STANDARD+:snapshot ZFS feito?
[ ] 6. Se STANDARD+:approval do Mestre?
[ ] 7. Plan executado e mostrado ao Mestre?
[ ] 8. Apply feito?
[ ] 9. Docs atualizados (SUBDOMAINS, PORTS, NETWORK_MAP)?
[ ] 10. Commit + push?
```

---

## 6. Escalation — Quando Perguntar ao Mestre

| Situacao | Response |
|---|---|
| Nao sei se a porta esta livre | Perguntar antes de usar |
| Nao sei se subdomain ja existe | Consultar SUBDOMAINS.md |
| Mudanca e STANDARD ou superior | Pedir approval primeiro |
| Mudanca e CRITICAL | Explicar risco, pedir plano detalhado |
| Destrutivo (delete, wipe) | NUNCA fazer sozinho |
| ZFS rollback | Pedir confirmacao |
| Instalar pacote novo | Pedir approval |

---

## 7. Arquivos de Referencia

| Arquivo | O que tem | Onde |
|---|---|---|
| APPROVAL_MATRIX.md | O que posso fazer sozinho | /srv/ops/ai-governance/ |
| SUBDOMAINS.md | Subdomains ativos | /srv/ops/ai-governance/ |
| PORTS.md | Portas em uso | /srv/ops/ai-governance/ |
| NETWORK_MAP.md | Topologia de rede | /srv/ops/ai-governance/ |
| infisical.md | Como usar Infisical | /srv/monorepo/docs/guides/ |
| gitea-coolify.md | GitOps + deploy | /srv/monorepo/docs/guides/ |

---

## 8. Formato de Resposta ao Mestre

Quando o Mestre pedir algo de infra:

```
ENTENDI: [resumo do pedido]

AUDIT:
- Porta: [livre/ocupada por X]
- Subdomain: [livre/existente em X]
- Classificacao: [MINOR/STANDARD/STRUCTURAL]

PLANO:
1. [passo 1]
2. [passo 2]
...

APPROVAL NECESSARIO: [SIM/NAO]
SNAPSHOT NECESSARIO: [SIM/NAO]

Posso prosseguir?
```
