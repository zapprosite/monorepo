# Plan: Rede Perfeita — Terraform + Cloudflare Tunnel + Homelab

**Data:** 08/04/2026
**Autor:** will + Claude Code
**Status:** DRAFT — aguardando aprovação

---

## Situação Actual

### Arquitectura Actual (PARCIALMENTE FUNCIONAL)

```
[Internet]
     │
     ├─── Cloudflare CDN (443) ──────────────────────────┐
     │                                                    │
[Cloudflare Tunnel - cloudflared]                         │
     │                                                    │
     ├── bot.zappro.site → http://localhost:80 ────────────┤
     │     (OpenClaw: Traefik → OpenClaw:8080)           │
     │                                                    │
     ├── llm.zappro.site → http://localhost:4000 ─────────┤
     │     (LiteLLM, protegido por Cloudflare Access)     │
     │                                                    │

[Host localhost]
     ├── :80   → Traefik (coolify-proxy) ← funciona localmente
     ├── :443  → Traefik (coolify-proxy) ← funciona localmente
     ├── :8080 → Traefik (mesma porta, routing diferente)
     └── :4000 → LiteLLM (sem Traefik)
```

### O Que Funciona ✅

| Subdomain | Routing | Access Control | Status |
|-----------|---------|---------------|--------|
| `bot.zappro.site` | Cloudflare → Traefik → OpenClaw | Nenhum (público) | ✅ Working |
| `llm.zappro.site` | Cloudflare → localhost:4000 | Cloudflare Access (Google OAuth) | ✅ Working |
| `qdrant.zappro.site` | Cloudflare → localhost:6333 | Cloudflare Access | ✅ Working |

### O Que NÃO Funciona ❌

| Problema | Causa |
|----------|-------|
| `localhost:18789` (smoke test) | Gateway OpenClaw bind=loopback apenas — inacessível externamente |
| Porta 80/443 externa | Cloud provider security group bloqueia — não透过Cloudflare Tunnel |
| `localhost:8080` sem rota | Traefik não tem rota para `localhost:8080` via `Host: bot.zappro.site` |
| Smoke test 1.2/1.3 fail | Usa `localhost:18789` que é loopback-only dentro do container |

---

## Investigação: VPC + Lambda em Homelab

### VPC (Virtual Private Cloud)

**Aplica-se a homelab?** ❌ **NÃO RECOMENDADO**

| Cenário |适用? | Razão |
|---------|-------|-------|
| AWS/GCP/VPS | ✅ Sim | VPC é o modelo nativo在这些 provedores |
| Homelab local (baremetal) | ❌ Não | Já tens rede local física/VLAN |
| Homelab + VMs (Proxmox) | ⚠️ Parcial | VLANs fazem o papel do VPC |
| Coolify + Docker | ❌ Não | Docker networks substituam VPC |

**Conclusão:** VPC é conceito cloud. Em homelab, usa **Docker networks** + **VLANs** para isolamento equivalente.

### Lambda (AWS Serverless)

**Aplica-se a homelab?** ❌ **NÃO para routing**

Lambda é para **compute sem servidor**. Não tem utilidade directa para routing de tráfego.

**Alternativas homelab:**
- **Cloudflare Workers** — mesmo conceito, mas na edge da Cloudflare
  - Podes criar Workers para logic personalizado
  - Não substitui tunnel, complementa
- **Containers Docker** — equivalente a Lambda em homelab

### Arquitectura Cloudflare Ideal para Homelab

```
┌─────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE                       │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐  │
│  │   Workers   │   │  Zero Trust  │   │     CDN      │  │
│  │  (compute)  │   │   Access    │   │  (static)    │  │
│  └─────────────┘   └─────────────┘   └──────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │
                    Cloudflare Tunnel
                    (cloudflared daemon)
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    HOMELAB HOST                          │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Docker Network (coolify)                   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │ │
│  │  │ Traefik  │  │ OpenClaw │  │  LiteLLM     │     │ │
│  │  │ :80/:443 │──│  :8080   │  │  :4000       │     │ │
│  │  └──────────┘  └──────────┘  └──────────────┘     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Docker Network (zappro-lite_default)      │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │ │
│  │  │ LiteLLM  │  │ wav2vec2 │  │    etc       │     │ │
│  │  └──────────┘  └──────────┘  └──────────────┘     │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Research: Pangolin — Traefik + Cloudflare Tunnel Bridge

**Discovery:** [Pangolin](https://github.com/hhftechnology/pangolin-cloudflare-tunnel) é um bridge que liga Traefik Dynamic Config → Cloudflare Tunnel.

### O que Pangolin faz

```
Cloudflare API (Terraform)
         │
         ▼
Pangolin (polls Cloudflare API)
         │
         ▼
Traefik Dynamic Config (/traefik/dynamic/)
```

**Isto permitiria** criar rotas Traefik via Terraform sem editar ficheiros locais.

### Porque NÃO precisamos de Pangolin (ainda)

1. **O Terraform ACTUAL já gere DNS + Tunnel config** via `cloudflare_zero_trust_tunnel_cloudflared_config`
2. **OpenClaw já tem labels Traefik** — Coolify cria routers automaticamente
3. **O problema não é o Traefik** — é que:
   - cloudflared aponta para `localhost:80`
   - Traefik recebe pedido com Host Header `bot.zappro.site`
   - Traefik não tem rota para `bot.zappro.site` — usa catchall → 404
   - MAS o `http_host_header` no terraform força o header para `openclaw-...sslip.io`
   - Enão Traefik reconhece e routing Works ✅

**Verificado:** `https://bot.zappro.site/` → 401 (OpenClaw auth) = **funciona!**

---

## Problema Real: Smoke Test

O smoke test falha porque usa `localhost:18789` que é **loopback-only dentro do container**.

**Solução:** O smoke test DEVE usar `https://bot.zappro.site/` (Tunnel) ou `http://localhost:8080/` (Traefik directo).

---

## Tarefas

### Tarefa 1: Corrigir Smoke Test — Usar rota correcta

**Ficheiro:** `tasks/smoke-tests/pipeline-openclaw-voice.sh`

**Mudar 1.2/1.3:**
- Remover `localhost:18789` (loopback, inacessível)
- Adicionar `https://bot.zappro.site/` (Cloudflare Tunnel → OpenClaw)
- Adicionar `http://localhost:8080/` como fallback (Traefik → OpenClaw)

**Critério aceite:** Smoke test passa (200/401 são OK para health check — 401 significa routing OK, apenas precisa auth)

---

### Tarefa 2: Criar Subdomain `openclaw.zappro.site` (opcional)

**Motivo:** `bot.zappro.site` não é intuitivo. Criar `openclaw.zappro.site` seria mais limpo.

**Ficheiro:** `/srv/ops/terraform/cloudflare/variables.tf`

```hcl
openclaw = {
  url       = "http://localhost:80"
  subdomain = "openclaw"
  http_host_header = "openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io"
}
```

**Também actualizar:** `~/.cloudflared/config.yml` (referência local)

**Critério aceite:** `https://openclaw.zappro.site/` → 200 ou 401 (routing OK)

---

### Tarefa 3: Documentar Arquitectura de Rede

**Ficheiro:** `docs/OPERATIONS/guide.md` (actualizar)

Incluir:
- Mapa de subdomínios e routing
- Diagrama de fluxo de tráfego
- Notas sobre Cloudflare Tunnel + Traefik
- Cloudflare Access (Google OAuth) por serviço

**Critério aceite:** Qualquer pessoa consegue entender a rede do homelab

---

### Tarefa 4: ZFS Snapshot antes de mudanças

```bash
sudo zfs snapshot -r tank@pre-network-fix-$(date +%Y%m%d-%H%M%S)
```

**Critério aceite:** Snapshot existe antes de Tarefa 2

---

### Tarefa 5: Fechar Portas 80/443 no Cloud Provider (se possível)

Se o cloud provider (Hetzner?) bloqueia portas 80/443:
- **Não precisamos abrir** — Cloudflare Tunnel funciona na 443
- Documentar que acesso HTTP directo não funciona (e é intencional)

**Critério aceite:** `docs/OPERATIONS/guide.md` clarifica isto

---

## NÃO FAZER (Guardrails)

- ❌ NÃO usar VPC — conceito cloud, não se aplica
- ❌ NÃO usar Lambda — compute serverless, não routing
- ❌ NÃO expor porta 18789 — é loopback-by-design por segurança
- ❌ NÃO criar accounts Cloudflare Access manualmente — via Terraform
- ❌ NÃO editar `/data/coolify/proxy/dynamic/` manualmente — Coolify sobrepõe

---

## Dependências

```
Tarefa 4 (ZFS snapshot)
       ↓
Tarefa 1 (fix smoke test) ← pode fazer agora
Tarefa 3 (documentação)   ← pode fazer agora
       ↓
Tarefa 2 (openclaw subdomain) ← requer snapshot
       ↓
Tarefa 5 (documentar portas)
```

---

## Referências

- [Terraform Cloudflare Provider - Zero Trust Tunnel](https://github.com/cloudflare/terraform-provider-cloudflare/blob/main/docs/resources/zero_trust_tunnel_cloudflared_config.md)
- [Pangolin - Traefik + Cloudflare Tunnel Bridge](https://github.com/hhftechnology/pangolin-cloudflare-tunnel)
- [Cloudflare SASE Architecture](https://developers.cloudflare.com/reference-architecture/architectures/sase/)
- [Cloudflare Workers VPC](https://developers.cloudflare.com/workers-vpc/)
