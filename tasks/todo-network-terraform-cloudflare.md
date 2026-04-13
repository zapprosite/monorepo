# TODO: Rede Perfeita — Terraform + Cloudflare Tunnel

### Tarefa 1: Corrigir Smoke Test
**Ficheiro:** `tasks/smoke-tests/pipeline-openclaw-voice.sh`
**Status:** pending

Remover `localhost:18789` e usar rota via Cloudflare Tunnel ou Traefik directo.

**Critério aceite:** Smoke test 1.2/1.3 passa via `https://bot.zappro.site/`

---

### Tarefa 2: Criar Subdomain `openclaw.zappro.site`
**Ficheiro:** `/srv/ops/terraform/cloudflare/variables.tf`
**Status:** OBSOLETO — OpenClaw já disponível em `bot.zappro.site`

O subdomain `openclaw.zappro.site` NÃO existe no DNS. OpenClaw usa `bot.zappro.site` (já configurado).
Não criar — usar bot.zappro.site em vez disso.

**Critério aceite:** N/A — não aplicar

---

### Tarefa 3: Documentar Arquitectura de Rede
**Ficheiro:** `docs/OPERATIONS/guide.md`
**Status:** pending

Mapa de subdomínios, fluxo de tráfego, Cloudflare Access.

**Critério aceite:** guia cobre toda a rede homelab

---

### Tarefa 4: ZFS Snapshot
**Status:** pending (ANTES de Tarefa 2)
```bash
sudo zfs snapshot -r tank@pre-network-fix-$(date +%Y%m%d-%H%M%S)
```

---

### Tarefa 5: Documentar Bloqueio de Portas 80/443
**Status:** pending

Cloud provider bloqueia portas 80/443 — Cloudflare Tunnel contorna. Documentar.

**Critério aceite:** docs clarifica que HTTP directo não funciona (intencional)
