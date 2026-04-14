# SPEC-043: Subdomain Prune & Hermes Migration

**Date:** 2026-04-14
**Author:** will-zappro
**Status:** PROPOSED
**Type:** Infrastructure Cleanup

---

## Objective

Prune 2 deprecated subdomains e migrar routing para Hermes Gateway:
1. Remover `bot.zappro.site` (legacy OpenClaw) — 502 Bad Gateway
2. Remover `supabase.zappro.site` (ghost entry — discontinued)
3. Criar `hermes.zappro.site` → pointing to Hermes Gateway `:8642`

## Background

Da auditoria SRE 14/04/2026:
- `bot.zappro.site` → 502 Bad Gateway (OpenClaw deprecated, Hermes não está a ouvir em :8642)
- `supabase.zappro.site` → ghost entry (serviço removido mas subdomain ainda no Terraform)
- `hermes.zappro.site` → definido no Terraform mas não criado nos docs

## Tech Stack

- **Cloudflare API** via Terraform
- **Cloudflare Tunnel:** `aee7a93d-c2e2-4c77-a395-71edc1821402`
- **Token:** `CLOUDFLARE_API_TOKEN` from `.env`

## Scope

### Files to Modify

| File | Action |
|------|--------|
| `/srv/ops/terraform/cloudflare/variables.tf` | Update `services` map — replace bot→hermes |
| `/srv/ops/terraform/cloudflare/access.tf` | Remove `supabase.zappro.site` from access policies |
| `/srv/ops/terraform/cloudflare/quick-api-flow.md` | Update bot→hermes routing |
| `/srv/ops/ai-governance/SUBDOMAINS.md` | Remove ghost entries |
| `/srv/monorepo/docs/INFRASTRUCTURE/NETWORK_MAP.md` | Update bot routing to :8642 |
| `/srv/monorepo/docs/INFRASTRUCTURE/SUBDOMAINS.md` | Remove supabase, add hermes |

### Files to Remove

| File | Reason |
|------|--------|
| `supabase.zappro.site` DNS entry | Ghost — serviço discontinued |

### Terraform State

```bash
cd /srv/ops/terraform/cloudflare
terraform plan  # preview changes
terraform apply # apply after approval
```

## Commands

```bash
# 1. Validate current state
curl -s -o /dev/null -w "%{http_code}" http://bot.zappro.site
curl -s -o /dev/null -w "%{http_code}" http://supabase.zappro.site
curl -s -o /dev/null -w "%{http_code}" http://hermes.zappro.site

# 2. Run terraform plan
cd /srv/ops/terraform/cloudflare
terraform plan -out=prune-plan.tfplan

# 3. Apply (after human approval)
terraform apply prune-plan.tfplan

# 4. Verify
curl -s -o /dev/null -w "%{http_code}" http://hermes.zappro.site
```

## Success Criteria

- [ ] `hermes.zappro.site` → HTTP 200 (Hermes Gateway responding)
- [ ] `bot.zappro.site` → 404 or removed from DNS
- [ ] `supabase.zappro.site` → 404 or removed from DNS
- [ ] Terraform state updated (serial incremented)
- [ ] Docs updated to reflect new routing

## Acceptance Criteria

1. **Hermes Gateway reachable:** `curl hermes.zappro.site/health` returns 200
2. **No ghost DNS entries:** `supabase.zappro.site` not resolvable or 404
3. **bot.zappro.site deprecated:** Returns 502 or redirects to hermes
4. **Docs consistent:** NETWORK_MAP.md, SUBDOMAINS.md, all aligned

## Open Questions

1. Should `bot.zappro.site` redirect to `hermes.zappro.site` or just return 404?
2. Does Hermes Gateway need Cloudflare Access protection (like other services)?
3. Is there any CI/CD that references `bot.zappro.site` that needs updating?

## Dependencies

- Terraform Cloudflare provider configured
- `CLOUDFLARE_API_TOKEN` valid in `.env`
- Hermes Gateway actually running and listening on :8642

## Risks

| Risk | Mitigation |
|------|-----------|
| Hermes Gateway not running | Verify before DNS cutover |
| Breaking CI/CD references | Scan for `bot.zappro.site` in code first |
| Cloudflare Access policy removal | Ensure no dependent services |
