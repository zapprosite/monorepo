# INCIDENT-2026-04-14: monitor.zappro.site — Login OAuth Google Bloqueado por Domínio

**Date:** 2026-04-14
**Severity:** 🟡 Important
**Status:** RESOLVED
**Duration:** ~20 minutos
**Author:** will + Claude Code

---

## Resumo

Após tentativa de corrigir Cloudflare Access no `monitor.zappro.site`, o login OAuth Google do Grafana passou a falhar com `"Login failed: Required email domain not fulfilled"`. O Grafana só aceitava logins com email `@zappro.site`, mas o utilizador usa `@gmail.com`.

---

## Timeline

| Hora | Evento |
|------|--------|
| ~04:00 | Remoção do Cloudflare Access app de `monitor.zappro.site` (via Cloudflare API) |
| ~04:05 | Acesso direto ao Grafana exposto — OAuth Google solicita login |
| ~04:06 | Erro `"Required email domain not fulfilled"` — `GF_AUTH_GOOGLE_ALLOWED_DOMAINS=zappro.site` bloqueia `@gmail.com` |
| ~04:08 | Cloudflare Access recriado temporariamente como workaround |
| ~04:12 | Corrigido `GF_AUTH_GOOGLE_ALLOWED_DOMAINS` em `/srv/apps/monitoring/docker-compose.yml` |
| ~04:13 | Container Grafana reiniciado com novo domínio aceite |
| ~04:15 | Login OAuth Google confirmado a funcionar |

---

## Root Cause

**2 problemas combinados:**

1. **Cloudflare Access removido** — A app Access que protegia `monitor.zappro.site` foi acidentalmente apagada na sequência de comandos. Isto expôs o Grafana diretamente, que aplica as suas próprias regras OAuth.

2. **`GF_AUTH_GOOGLE_ALLOWED_DOMAINS=zappro.site`** — O Grafana estava configurado para aceitar apenas emails do domínio `zappro.site`. O utilizador `zappro.ia@gmail.com` foi rejeitado.

**Nota:** O Cloudflare Access usava o próprio OAuth do Google para autenticar — permitia qualquer conta Google. Quando foi removido, o Grafana passou a aplicar a sua restrição interna de domínio.

---

## Fix Aplicado

### Correcção do dominio aceite pelo Grafana OAuth

**Ficheiro:** `/srv/apps/monitoring/docker-compose.yml`

```yaml
# ANTES (só aceita @zappro.site)
GF_AUTH_GOOGLE_ALLOWED_DOMAINS: "zappro.site"

# DEPOIS (aceita @zappro.site E @gmail.com)
GF_AUTH_GOOGLE_ALLOWED_DOMAINS: "zappro.site gmail.com"
```

**Apply:**
```bash
cd /srv/apps/monitoring && docker-compose down grafana && docker-compose up -d grafana
```

---

## Root Cause — Explicação Detalhada

### Camadas de autenticação

```
Utilizador → Cloudflare Edge → Cloudflare Access → Grafana → Google OAuth
```

**Antes da remoção do Access:**
- Cloudflare Access interceptava o pedido
- OAuth Google era feito pelo Access (aceitava qualquer conta Google)
- Grafana recebia sessão autenticada via Access cookie
- **Resultado:** login funcionava para qualquer email Google

**Após remoção do Access:**
- Pedido ia direto ao Grafana
- Grafana aplicava `GF_AUTH_GOOGLE_ALLOWED_DOMAINS=zappro.site`
- Qualquer email não-`@zappro.site` era rejeitado na hora do login OAuth
- **Resultado:** `zappro.ia@gmail.com` bloqueado

---

## Lição Aprendida

**Regra:** Nunca remover Cloudflare Access sem primeiro verificar as restrições OAuth internas do serviço.

Quando um serviço está protegido por Cloudflare Access + OAuth interno, o OAuth interno fica desativado (o Access que faz a autenticação). Ao remover o Access, o serviço volta a aplicar as suas próprias regras OAuth — que podem ser mais restritivas.

**Antes de remover Access:** verificar `GF_AUTH_GOOGLE_ALLOWED_DOMAINS` e ajustar se necessário.

---

## Prevenção

- [x] Documentar restrições OAuth de cada serviço antes de modificar Access
- [x] Adicionar `gmail.com` aos domínios aceites no Grafana OAuth
- [ ] Criar alerta se `GF_AUTH_GOOGLE_ALLOWED_DOMAINS` mudar no container

---

## Referências

- Docker compose: `/srv/apps/monitoring/docker-compose.yml`
- Grafana OAuth docs: `https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/configure-authentication/google/`
- Cloudflare Access API: `https://api.cloudflare.com/client/v4/accounts/{account_id}/access/apps`

---

**Actualizado:** 2026-04-14 04:20
