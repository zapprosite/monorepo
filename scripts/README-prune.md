# Scripts de Prune

## prune-subdomain.sh

Remove completamente um subdomínio de TODO o monorepo.

### Uso

```bash
# Dry-run (ver o que seria removido sem alterar nada)
./scripts/prune-subdomain.sh grafana --dry-run

# Aplicar remoção real
./scripts/prune-subdomain.sh grafana
```

### O que faz

1. **Scan** — Procura TODAS as referências ao subdomain em todos os ficheiros
2. **Terraform variables.tf** — Remove o bloco de serviço
3. **Terraform access.tf** — Remove da lista de access_services
4. **SUBDOMAINS.md** — Remove entradas
5. **Skills e docs** — Limpa referências em qualquer ficheiro
6. **DNS CNAME** — Remove do Terraform state
7. **Access resources** — Remove do Terraform state

### Passos manuais após o script

1. Remover Access Application no dashboard Cloudflare Zero Trust (se existir)
2. Remover Access Policy no dashboard Cloudflare Zero Trust (se existir)
3. Remover DNS record manualmente no dashboard Cloudflare (se ainda existir)
4. Correr `cd /srv/ops/terraform/cloudflare && terraform plan` para verificar

### Exemplos de uso

```bash
# Remover prometheus ghost subdomain
./scripts/prune-subdomain.sh prometheus

# Remover grafana (que é alias de monitor)
./scripts/prune-subdomain.sh grafana

# Ver o que seria afetado
./scripts/prune-subdomain.sh n8n --dry-run
```
