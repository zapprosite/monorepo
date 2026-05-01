# SPEC-007 — Homelab Enterprise Audit Fixes

## Problema
Auditoria ruthless do Ubuntu Desktop (will-zappro) revelou 11 issues críticos/alta severidade que comprometem a postura de segurança e operacional do homelab enterprise.

## Solução
3 ondas de correções definitivas, pipeline automatizado com queue-control.sh.

---

## ONDA 1 — CRITICAL (3 tarefas)

### T1: hvac-rag-pipe.py — bind 127.0.0.1 + API key
**Arquivo:** `/srv/data/hvac-rag/scripts/hvac-rag-pipe.py`
**Issue:** Escuta em `0.0.0.0:4017`, CORS permissivo (`http://10.0.0.0/8`, IP Tailscale), sem auth.

**Fix:**
1. Mudar `PIPELINE_HOST` env var default de `127.0.0.1` (já correto) — verificar se o servicio usa o default ou se há override
2. Adicionar API key middleware (X-API-Key header)
3. Restringir CORS a apenas `localhost` para requests
4. Adicionar rate limiting

### T2: cloudflared — remover 3ª instância redundante
**Arquivo:** `sudo kill 2549573` (3ª instância manual)
**Issue:** 3 instâncias cloudflared com mesmo credential file — ConnIndex 2 instável.

**Fix:**
1. Identificar origem da 3ª instância (systemd? manual? coolify?)
2. Matar PID 2549573
3. Remover source da 3ª instância (script, systemd override, etc.)

### T3: Coolify — bind 127.0.0.1:8000
**Arquivo:** `/srv/docker-data/compose-files/coolify/` (ou similar)
**Issue:** Coolify escuta em `0.0.0.0:8000` — exposto à LAN.

**Fix:**
1. `docker compose stop && docker compose rm -f && docker compose up -d` após mudança de bind para `127.0.0.1:8000`

---

## ONDA 2 — HIGH (4 tarefas)

### T4: Swap — 3.1GiB em NVMe Gen5
**Issue:** clamd (679MB) + trieve (212MB) + 2x mcp-server-qdra (353MB) + gnome-shell (190MB) = 1.4GB+ swap
**Causa:** 30GiB RAM insuficiente para carga total.

**Fix:**
1. `sudo swapoff /swap.img` temporário
2. Aumentar RAM disponível: matar residual coolify (PID 15553)
3. Configurar `vm.swappiness=10` em `/etc/sysctl.conf`
4. ClamAV: verificar se realmente necessário (antivírus em Desktop Linux raramente é)
5. Se swap persistir: reduzir carga Docker ou aumentar RAM física

### T5: PID 15553 residual Coolify
**Issue:** Coolify residual (hostname `eaabb55f5f4d`, CWD `/app`) ocupa RAM.

**Fix:**
1. `sudo kill 15553` — processo zombie não deveria estar rodando
2. Verificar se há restart automático: `sudo systemctl list-dependencies coolify`

### T6: rustdesk — bind 127.0.0.1
**Issue:** `*:21118` — bind público, mesmo com UFW a bloquear.

**Fix:**
1. Editar config RustDesk server (provavelmente em `~/.config/rustdesk/`)
2. Mudar `bind = "0.0.0.0"` para `bind = "127.0.0.1"` ou usar `UFW` com regra `ALLOW 100.83.45.79` (Tailscale only)

### T7: Qdrant — IP fixo para cloudflared tunnel
**Issue:** cloudflared aponta para `10.0.8.3` (IP container Docker que pode mudar).

**Fix:**
1. Criar network alias estático no Docker compose do trieve-qdrant
2. Ou usar `hostname:port` em vez de IP direto no cloudflared config.yml

---

## ONDA 3 — HIGH/MEDIUM (4 tarefas)

### T8: fail2ban — adicionar jail para API endpoints
**Issue:** Apenas 2 jails (nginx-http-auth, sshd).

**Fix:**
1. Criar jail para brute force em endpoints HTTP públicos (Coolify, Hermes, etc.)
2. Configurar `bantime = 1h`, `findtime = 10m`, `maxretry = 5`

### T9: APT updates — kernel + Docker
**Issue:** Kernel 6.17.0-22 → 6.17.0-23, Docker 5:29.3.1 → 5:29.4.2

**Fix:**
1. `sudo apt update && sudo apt upgrade -y` (Docker primeiro)
2. Reboot (`sudo systemctl reboot`) — requer janela de manutenção

### T10: Imagens Docker velhas — atualizar Qdrant, pgAdmin, SearXNG
**Issue:** Qdrant 36 dias, pgAdmin 32 dias, SearXNG 34 dias.

**Fix:**
```bash
docker pull qdrant/qdrant:latest
docker pull dpage/pgadmin4:latest
docker pull searxng/searxng:latest
docker compose -f <file> pull && docker compose -f <file> up -d
```

### T11: Ollama — remover qwen2.5-coder:14b-q6k (não usado)
**Issue:** Modelo `qwen2.5-coder:14b-q6k` não é citado em nenhum workflow, ocupa ~9GB VRAM.

**Fix:**
```bash
ollama rm qwen2.5-coder:14b-q6k
```

---

## Restrições
- **NÃO mexer no Ollama** — será usado em breve
- Manter operacional: Coolify, Gitea, Prometheus, Grafana, Hermes Agent
- Criar ZFS snapshot antes de cada onda: `tank@pre-spec007-onda{N}-{timestamp}`

## Artefatos
- SPEC: `/srv/monorepo/SPECS/SPEC-007.md`
- Pipeline: `/tmp/SPEC-007-ondafix.json`
- Checkpoint: `~/.hermes/pipeline-checkpoint.json`
