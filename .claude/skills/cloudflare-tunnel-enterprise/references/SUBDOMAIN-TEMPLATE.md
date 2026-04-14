# Subdomain + Tunnel — Standard Pattern

**Use this template when adding or removing a subdomain.**

---

## 1. Adicionar Subdomain

### Passo 1 — Verificar PORTOS
```bash
# Ler PORTS.md
cat /srv/ops/ai-governance/PORTS.md

# Verificar se porta está livre
ss -tlnp | grep :PORTA
```

### Passo 2 — Adicionar ao Terraform
```bash
# Editar variables.tf
nano /srv/ops/terraform/cloudflare/variables.tf

# Adicionar bloco em "services":
NOME = {
  url              = "http://localhost:PORTA"
  subdomain        = "NOME"
  http_host_header = null  # ou string se necessário
}
```

### Passo 3 — Aplicar Terraform
```bash
cd /srv/ops/terraform/cloudflare
terraform plan
terraform apply
```

### Passo 4 — Verificar DNS via Terraform state
```bash
terraform -chdir=/srv/ops/terraform/cloudflare state list | grep NOME
# Deve mostrar: cloudflare_record.tunnel_cname["NOME"]
```

### Passo 5 — Restart cloudflared (se systemd)
```bash
# ANTES de restart: matar todos os cloudflared
sudo pkill cloudflared || true
sleep 2

# Restart via systemd
sudo systemctl restart cloudflared

# Verificar: só 1 daemon
ps aux | grep cloudflared | grep -v grep | wc -l  # deve ser 1
```

### Passo 6 — Testar
```bash
curl -sfI --max-time 5 https://NOME.zappro.site
# 200/302 = OK, 000 = tunnel down
```

### Passo 7 — Atualizar docs
- [ ] `/srv/ops/ai-governance/SUBDOMAINS.md` — adicionar à tabela ATIVOS
- [ ] `/srv/ops/ai-governance/PORTS.md` — adicionar porta
- [ ] `/srv/ops/ai-governance/NETWORK_MAP.md` — adicionar mapping

---

## 2. Remover Subdomain (Prune)

### Script automatizado
```bash
bash /srv/monorepo/scripts/prune-subdomain.sh NOME
# Ou dry-run:
bash /srv/monorepo/scripts/prune-subdomain.sh NOME --dry-run
```

### O que o script faz
1. Scan de todas as referências ao subdomain
2. Remove bloco de serviço de `variables.tf`
3. Remove do Terraform state (`terraform state rm`)
4. Remove de skills e código
5. **NÃO remove** de SUBDOMAINS.md (ghost entries preservadas como PRUNED)

### Passos manuais após prune
```bash
# Verificar terraform
cd /srv/ops/terraform/cloudflare && terraform plan

# Testar — deve dar NXDOMAIN
curl -sfI --max-time 5 https://NOME.zappro.site
```

---

## 3. Diagnóstico de Tunnel

### Check 1 — Daemon único?
```bash
ps aux | grep cloudflared | grep -v grep
# Se >1 line = MULTI-DAEMON CONFLICT — matar os extras
```

### Check 2 — Systemd alive?
```bash
systemctl status cloudflared
# Se "dead" = systemd inactivo mas daemon manual pode estar a correr
```

### Check 3 — Logs
```bash
journalctl -u cloudflared -n 50 --no-pager
# Procurar: "connected to Cloudflare edge" = OK
# Procurar: "error" = problema
```

### Check 4 — Teste direto ao origin
```bash
# Do host cloudflared:
curl -sfI http://ORIGIN_IP:PORTA/
# Se funciona mas https://NOME.zappro.site não = problema de tunnel
```

### Check 5 — DNS resolution
```bash
dig +short NOME.zappro.site CNAME
# Deve retornar: TUNNEL_ID.cfargotunnel.com
```

### Check 6 — Tunnel status via API
```bash
source /srv/monorepo/.env
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$CLOUDFLARE_TUNNEL_ID" | \
  jq '.result.status'
```

---

## 4. Restart Seguro de cloudflared

### Regra de Ouro
> **Um tunnel = um daemon.** Antes de qualquer restart, matar todos.

```bash
# 1. Matar todos
sudo pkill cloudflared || true

# 2. Aguardar
sleep 3

# 3. Iniciar via systemd
sudo systemctl start cloudflared

# 4. Verificar
sleep 5
systemctl status cloudflared
ps aux | grep cloudflared | grep -v grep | wc -l  # 1

# 5. Testar 3 subdomains críticos
for sub in api chat llm; do
  code=$(curl -sk --max-time 5 "https://${sub}.zappro.site" -o /dev/null -w "%{http_code}")
  echo "$sub => $code"
done
```

---

## 5. Variáveis de Ambiente Necessárias

```bash
# De .env (nunca hardcoded)
CLOUDFLARE_API_TOKEN=cfut_...     # Terraform token
CLOUDFLARE_ACCOUNT_ID=...          # Cloudflare Account ID
CLOUDFLARE_ZONE_ID=...            # Zone ID para DNS
CLOUDFLARE_TUNNEL_ID=...          # Tunnel UUID
```

---

## 6. Ficheiros Chave

| Ficheiro | Purpose |
|----------|---------|
| `/srv/ops/terraform/cloudflare/variables.tf` | Subdomain definitions |
| `/srv/ops/terraform/cloudflare/main.tf` | Tunnel + DNS resources |
| `/home/will/.cloudflared/config.yml` | Legacy daemon config (manual) |
| `/home/will/.cloudflared/CREDENTIALS.json` | Tunnel auth |
| `/etc/systemd/system/cloudflared.service` | Systemd unit |

---

## 7. Anti-Patterns

### ❌ NUNCA fazer
```bash
# NÃO iniciar daemon manual enquanto systemd está ativo
cloudflared tunnel run ... &

# NÃO usar terraform apply sem verificar terraform plan primeiro

# NÃO misturar config.yml (manual) com credentials-file (systemd)
# Um ou outro, nunca ambos para o mesmo tunnel

# NÃO dar restart sem matar primeiro
systemctl restart cloudflared  # pode criar 2 daemons
```

### ✅ SEMPRE fazer
```bash
# Antes de qualquer cloudflared start
sudo pkill cloudflared || true

# Verificar vars antes de terraform apply
cd /srv/ops/terraform/cloudflare && terraform plan

# Atualizar docs ANTES de aplicar
```

---

## 8. Health Check Rápido

```bash
# One-liner para verificar todos os subdomains
for sub in api chat coolify git hermes list llm md monitor painel qdrant todo; do
  code=$(curl -sk --max-time 5 "https://${sub}.zappro.site" -o /dev/null -w "%{http_code}" 2>/dev/null)
  echo "$sub => $code"
done
```

**Esperado:** 302 (Access) ou 200 (público) ou 404 (API gateway)
**Problema:** 000 = tunnel down
