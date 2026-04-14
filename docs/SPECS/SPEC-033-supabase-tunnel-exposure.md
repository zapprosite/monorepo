---
name: SPEC-033-supabase-tunnel
description: Expor supabase.zappro.site via Cloudflare Tunnel — Postgres em coolify network sem porta exposta ao host
type: infrastructure
status: PENDING
priority: high
author: Principal Engineer
date: 2026-04-12
specRef: SPEC-032 (tunnel health automation), docs/INFRASTRUCTURE/SUBDOMAINS.md
---

# SPEC-033 — Supabase Tunnel Exposure

**Date:** 2026-04-12
**Status:** IMPLEMENTED
**Type:** Infrastructure / Tunnel
**Priority:** 🔴 HIGH — supabase database exists, subdomain is ghost

---

## Objective

Expor `supabase.zappro.site` via Cloudflare Tunnel. O container Postgres (`ll01e4eis7wog1fnbzomc6jv`) vive na rede `coolify` com IP `10.0.0.4` e não expõe porta ao host. O tunnel deve apontar para `http://10.0.0.4:5432`.

---

## Problem Statement

1. **Ghost tunnel:** `supabase.zappro.site` foi removido do Terraform em commit anterior mas subdomain ainda existe como ghost entry em SUBDOMAINS.md
2. **Supabase database existe:** Coolify database `ll01e4eis7wog1fnbzomc6jv` (Postgres 17.4.1) está a correr na rede coolify em `10.0.0.4:5432`
3. **Sem porta exposta:** O container não publica portas para o host — acesso apenas via rede interna coolify
4. **Tunnel não configurado:** Não há ingress rule para supabase em variables.tf

---

## Tech Stack

| Component | Technology                                     | Notes                  |
| --------- | ---------------------------------------------- | ---------------------- |
| Database  | PostgreSQL 17.4 (supabase/postgres:17.4.1.032) | Coolify managed        |
| Network   | coolify bridge (10.0.0.0/24)                   | Container IP: 10.0.0.4 |
| Tunnel    | Cloudflare Tunnel (cloudflared)                | Terraform managed      |
| Terraform | variables.tf                                   | Ingress rules          |

---

## Commands

```bash
# Get Postgres container IP
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ll01e4eis7wog1fnbzomc6jv

# Test Postgres connectivity (internal)
docker exec ll01e4eis7wog1fnbzomc6jv psql -U postgres -d postgres -c "SELECT version();"

# Test tunnel endpoint
curl -sfI --max-time 10 https://supabase.zappro.site

# Terraform plan/apply
cd /srv/ops/terraform/cloudflare && terraform plan && terraform apply -auto-approve

# Verify ingress
cd /srv/ops/terraform/cloudflare && terraform show | grep -A5 supabase
```

---

## Acceptance Criteria

- [ ] Ingress rule adicionada em `variables.tf` com `url = "http://10.0.0.4:5432"` e `subdomain = "supabase"`
- [ ] `terraform apply` completo sem erros
- [ ] `curl -sfI --max-time 10 https://supabase.zappro.site` retorna algo que não seja `connection refused` (pode ser 000 ou erro HTTP — o importante é o tunnel existir e resolver para o container)
- [ ] SUBDOMAINS.md atualizado com entrada supabase (estado, IP, porta)
- [ ] PORTS.md atualizado (porta 5432 reservada para supabase)
- [ ] Ghost tunnel entry removida da secção "Ghost Tunnels" em SUBDOMAINS.md

---

## Files to Modify

| File                                              | Action                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| `/srv/ops/terraform/cloudflare/variables.tf`      | Adicionar entrada supabase em var.services            |
| `/srv/monorepo/docs/INFRASTRUCTURE/SUBDOMAINS.md` | Atualizar entrada supabase (ghost → ativo) + IP/porta |
| `/srv/monorepo/docs/INFRASTRUCTURE/PORTS.md`      | Adicionar porta 5432 como supabase                    |

---

## Implementation

### variables.tf addition

```hcl
supabase = {
  url              = "http://10.0.0.4:5432"
  subdomain        = "supabase"
  http_host_header = null
}
```

### Notes

- Postgres não devolve HTTP válido — o endpoint é `http://10.0.0.4:5432` que é um raw TCP Postgres, não HTTP
- O curl vai falhar com "connection refused" ou "HTTP/1.1 400 Bad Request" — isso é normal para raw Postgres sobre HTTP
- O importante é o tunnel existir (DNS resolver + cloudflared rotear para o container)
- Para verificar que funciona: `docker exec ll01e4eis7wog1fnbzomc6jv psql -U postgres -c "SELECT 1;"` (interno) vs `curl supabase.zappro.site` (externo) — se curl não dá "connection refused" o tunnel está a funcionar

---

## Success Criteria

- `curl -sfI https://supabase.zappro.site` → não dá "Could not resolve host" nem "Connection refused"
- Entry em SUBDOMAINS.md com estado ATIVO, IP 10.0.0.4, porta 5432
- Entry em PORTS.md com porta 5432 → supabase (Postgres 17.4)
- Ghost entry de supabase removida da secção "Ghost Tunnels"

---

## Out of Scope

- Criar API HTTP em cima do Postgres (não é цель — apenas expor o tunnel)
- Managed Postgres do Supabase (é Postgres raw, não o ecosistema Supabase completo)
- Expor mais do que a porta 5432
