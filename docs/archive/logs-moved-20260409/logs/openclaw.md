# Log de Governança — will-zappro

**Data:** 2026-04-05  
**Host:** will-zappro  
**Operador:** Claude Code (session)

---

## 1. RESUMO EXECUTIVO

### Hardware
- **CPU:** AMD Ryzen 9 7900X (12C/24T)
- **RAM:** 32 GB DDR5
- **GPU:** NVIDIA RTX 4090 (24 GB VRAM) — Driver 580.126.20, CUDA 13.0
- **Disco sistema:** nvme1n1 (Kingston 931 GB, ext4)
- **Disco dados:** nvme0n1 (Crucial 3.64 TB) → ZFS pool "tank"

### Status Geral
- **Containers ativos:** ~28 (todas stacks UP)
- **ZFS pool:** ONLINE, <1% capacidade usada
- **VRAM:** ~10 GB usado / ~14 GB livre

---

## 2. ZONAS PROIBIDAS (GUARDRAILS.md)

### Nunca fazer
- `curl -fsSL https://coolify.io/install.sh` / `docker pull coollabsio/coolify:latest`
- `apt upgrade` / `apt dist-upgrade` / `do-release-upgrade`
- Atualizar drivers NVIDIA ou `nvidia-container-toolkit`
- `zpool upgrade tank` / `zfs destroy` em datasets de produção
- Editar `/etc/cloudflared/*.yml` / Revogar Cloudflare API tokens / `terraform destroy`
- Ler/copiar/exibir `aurelia.env`
- `docker pull ghcr.io/remsky/kokoro-*` / editar `/srv/apps/voice/docker-compose.yml`
- Mudar `model.primary` do OpenClaw para `liteLLM/*`
- Usar LiteLLM como provider primário do OpenClaw

### Versões Pidadas
- **Coolify:** 4.0.0-beta.470
- **Kokoro:** ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2 (imutável via `chattr +i`)
- **OpenClaw:** 2026.2.6 | modelo: minimax/MiniMax-M2.7 direto
- **Kernel:** 6.17.0-20-generic — NÃO ATUALIZAR

---

## 3. POLÍTICA DE MUDANÇAS (CHANGE_POLICY.md)

### Processo obrigatório
```
Classificar → Preflight (CONTRACT + GUARDRAILS + APPROVAL_MATRIX) → Snapshot (se estrutural) → Aprovação → Executar → Validar → Logar → Monitorar 30min
```

### Classificação
| Tipo | Exemplos | Precisa |
|------|---------|---------|
| MINOR | Docs, configs não-destrutivas, read-only | Aprovação |
| STANDARD | Package updates, service configs, env vars | Snapshot + aprovação |
| STRUCTURAL | ZFS, docker-compose stack, DB schema | Snapshot + aprovação + teste |
| CRITICAL | Kernel, boot, disk ops, major upgrades | Snapshot + plano detalhado + rollback plan |

### Checklist pré-mudança
- [ ] Li CONTRACT.md?
- [ ] Li GUARDRAILS.md?
- [ ] Está em APPROVAL_MATRIX.md como "safe" ou "requires approval"?
- [ ] Se estrutural, snapshot criado?
- [ ] Se destrutivo, confirmação explícita do humano?

---

## 4. TOPOLOGIA DE REDE (NETWORK_MAP.md)

### Arquitetura
```
INTERNET → Cloudflare Edge (GRU) → Cloudflare Zero Trust Tunnel → cloudflared (host) → Ingress rules
```

### Subdomínios (Cloudflare Zero Trust)
| Subdomínio | Target | Access Policy | Status |
|------------|--------|----------------|--------|
| api.zappro.site | :4000 | zappro.ia@gmail.com | ✅ UP |
| bot.zappro.site | :4001 | **NONE (public)** | ✅ UP |
| coolify.zappro.site | :8000 | zappro.ia@gmail.com | ✅ UP |
| git.zappro.site | :3300 | zappro.ia@gmail.com | ✅ UP |
| llm.zappro.site | :4000 | zappro.ia@gmail.com | ✅ UP |
| monitor.zappro.site | :3100 | LAN only | ✅ UP |
| n8n.zappro.site | :5678 (10.0.6.3) | zappro.ia@gmail.com | ✅ UP |
| painel.zappro.site | :4003 | zappro.ia@gmail.com | ✅ UP |
| qdrant.zappro.site | :6333 | zappro.ia@gmail.com | ✅ UP |
| vault.zappro.site | :8200 | zappro.ia@gmail.com | ✅ UP |

### Portas principais
| Porta | Serviço | Acesso |
|-------|---------|--------|
| 22 | SSH | Anywhere (UFW) |
| 4000 | LiteLLM | localhost+LAN (auth) |
| 4001 | OpenClaw Bot | localhost (auth) |
| 5678 | n8n | Via tunnel (Docker net 10.0.6.3) |
| 6333 | Qdrant | 127.0.0.1 (UFW) |
| 8000 | Coolify | Via Cloudflare tunnel |
| 8200 | Infisical | 127.0.0.1 (UFW) |

### Docker Networks
- `coolify` (10.0.6.x): coolify-*, n8n
- `qgtzrmi...` (10.0.19.x): openclaw, browser
- `infisical-net`: infisical, infisical-db, infisical-redis
- `zappro-lite` (docker0 10.0.1.x): LiteLLM, LiteLLM-db
- `bridge` (host): Kokoro, Qdrant

### Tailscale VPN
- IP: 100.83.45.79
- Acesso direto a todos os serviços (mesmo sem Cloudflare)

---

## 5. STACKS ATIVAS

### AI/ML Stack
- **Ollama** (systemd, :11434): gemma4, llava, embedding-nomic — GPU
- **LiteLLM Proxy** (:4000, Docker zappro-lite): gemma4, llava, embedding-nomic, qwen3.6-plus, minimax-m2.7, kokoro-tts
- **Kokoro TTS** (:8012→:8880, GPU): voz pm_santa (PT-BR)
- **Qdrant** (:6333): vector DB

### Voice Pipeline (GPU)
- `voice-proxy` (nginx) → speaches (STT, Whisper v3, ~4GB VRAM) + chatterbox-tts (TTS, ~5GB VRAM)
- Rate limits: STT 10 req/min, TTS 20 req/min

### OpenClaw Bot (@CEO_REFRIMIX_bot)
- **Container:** openclaw-qgtzrmi... (:8080)
- **Modelo primário:** minimax/MiniMax-M2.7 (direto cloud)
- **Visão:** liteLLM/llava (via LiteLLM→Ollama GPU)
- **TTS:** Kokoro (:8880, voice pm_santa)
- **STT:** Deepgram nova-3 (cloud)

### Monitoring Stack
- Grafana (:3100) → monitor.zappro.site
- Prometheus (:9090)
- node-exporter (:9100)
- nvidia-gpu-exporter (:9835)
- cadvisor (:9250)

### Observability
- GPU: RTX 4090 24GB, ~10GB usado (desktop + voice stack)
- Budget VRAM: ~17.7GB pior caso / 6.3GB livre

---

## 6. ALOCAÇÃO ZFS (PARTITIONS.md)

```
tank (3.64 TB)
├── docker-data/   → /srv/docker-data   (~22 GB)
├── postgres/      → /srv/data/postgres (~24 KB)
├── qdrant/        → /srv/data/qdrant   (~257 KB)
├── n8n/           → /srv/data/n8n      (~10 MB)
├── monorepo/      → /srv/monorepo      (~195 MB)
├── backups/       → /srv/backups       (~194 MB)
├── models/        → /srv/models        (~38 KB)
├── coolify/       → /srv/data/coolify
├── supabase/      → /tank/supabase
└── supabase-db/   → /tank/supabase-db
```

**Capacidade:** ~22.5 GB usado / 3.49 TB livre (<1%)

---

## 7. SERVIÇOS E DEPENDÊNCIAS

### Grafo de dependências
```
RTX 4090 (GPU CDI)
├── speaches (STT, ~4GB VRAM)
└── chatterbox-tts (TTS, ~5GB VRAM)

OpenClaw :8080
├── → MiniMax API (cloud, direto)
├── → LiteLLM :4000 (llava=olhos)
├── → Kokoro :8880 (TTS=boca)
└── → Deepgram (cloud, STT=ouvidos)

LiteLLM :4000
├── → Ollama :11434 (gemma4, llava, nomic)
├── → Kokoro :8880 (kokoro-tts)
└── → litellm-db :5440

n8n :5678
├── → n8n-postgres :5432
├── → Qdrant :6333
├── → Ollama :11434
├── → Speaches :8010 (STT)
└── → Chatterbox :8011 (TTS)
```

### Ordem de boot (se tudo parado)
1. Docker Engine (systemd)
2. Platform stack (Qdrant, n8n, PostgreSQL)
3. Voice stack (speaches → chatterbox → voice-proxy)
4. LiteLLM + LiteLLM-db
5. Ollama (systemd, se não autostart)
6. Monitoring stack

---

## 8. INCIDENTES RECENTES

### INC-003 — Monitoring Stack Fragmentada (2026-04-04)
- **Duração:** ~30min
- **Problema:** nvidia-gpu-exporter em estado "Created-not-Started"; Grafana em network errada (não comunicava com Prometheus)
- **Resolução:** `docker start nvidia-gpu-exporter`; `docker network connect aurelia-net grafana prometheus`
- **Prevenção:** Skills de health-check criadas

### INC-002 — Antigravity Memory Leak → OOM → Reboot (2026-03-25/26)
- **Duração:** ~5h
- **Problema:** Memory leak catastrófico (~1.4 TB VM), OOM killer matou processo, reboot não-gracioso
- **Resolução:** MemoryMax adicionado a todos os serviços (ollama=20G, aurelia=3G, antigravity=6G, etc.)

### INC-001 — Voice Stack + GPU Exporter Down (2026-03-17)
- **Problema:** Driver NVIDIA atualizado não reiniciou containers GPU automaticamente
- **Resolução:** Restart manual dos containers; docs pinnados com `chattr +i`

---

## 9. PERMISSÕES E AUTORIZAÇÕES

### Aprovar ANTES de executar
- Service restart/stop (Qdrant, n8n, PostgreSQL)
- ZFS operations (snapshot OK, destroy NÃO)
- Package installation/upgrade
- Firewall changes
- Network modifications
- Port exposure

### Não requer aprovação
- Read-only operations (logs, status, inspect)
- Backups e snapshots
- Documentation updates
- Development em /srv/monorepo

### FORBIDDEN
- Disk wipe (wipefs, dd)
- Delete /srv/data, /srv/backups, /srv/docker-data
- ZFS pool destruction
- Reboot sem plano
- Expor portas sem atualizar PORTS.md + SUBDOMAINS.md + NETWORK_MAP.md
- Usar porta sem checar PORTS.md
- Adicionar subdomínio sem checar SUBDOMAINS.md

---

## 10. PORTAS LIVRES PARA DEV
- **4002–4099** — faixa microserviços
- **5173** — Vite frontend
- **3333** — monorepo dev (não rodando)

### Portas proibidas para dev
- :3000 → Open WebUI (reservada)
- :4000 → LiteLLM produção
- :4001 → OpenClaw Bot (reservada)
- :8000 → Coolify PaaS
- :8080 → aurelia-api

---

## 11. DRIFT CONHECIDO (NETWORK_MAP.md §6)

| Subdomínio | Antigo (config.yml local) | Correto (Terraform) |
|------------|---------------------------|---------------------|
| n8n | `https://n8n.zappro.site` (loop) | `http://10.0.6.3:5678` |
| aurelia | `http://localhost:8080` | `http://localhost:3334` |

### Terraform → fonte da verdade
- Cloudflare API (via Terraform) é authoritative para cloudflared daemon
- `~/.cloudflared/config.yml` é apenas referência local
- Para mudar rota: **Terraform first** → `terraform apply` → `systemctl restart cloudflared`

---

## 12. COMANDOS ÚTEIS

### Status rápido
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -s http://localhost:6333/health && echo " ✓ qdrant"
curl -s http://localhost:5678/api/v1/health && echo " ✓ n8n"
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader
zpool status tank
```

### LiteLLM test
```bash
curl -s http://localhost:4000/v1/models \
  -H "Authorization: Bearer sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1"
```

### Logs
```bash
docker logs zappro-litellm --tail 20
docker logs openclaw-qgtzrmi... --tail 20
```

---

## 13. ARQUIVOS DE REFERÊNCIA

| Arquivo | Conteúdo |
|---------|----------|
| `/srv/ops/ai-governance/CONTRACT.md` | Contrato operacional (leitura obrigatória antes de qualquer mudança) |
| `/srv/ops/ai-governance/GUARDRAILS.md` | Operações proibidas e permitidas |
| `/srv/ops/ai-governance/PARTITIONS.md` | Mapa físico de discos e ZFS |
| `/srv/ops/ai-governance/CHANGE_POLICY.md` | Processo de modificação segura |
| `/srv/ops/ai-governance/NETWORK_MAP.md` | Topologia completa (rede, portas, subdomínios) |
| `/srv/ops/ai-governance/PORTS.md` | Tabela de alocação de portas |
| `/srv/ops/ai-governance/SUBDOMAINS.md` | Registro de subdomínios Cloudflare |
| `/srv/ops/ai-governance/SERVICE_MAP.md` | Mapa de serviços e dependências |
| `/srv/ops/ai-governance/RUNBOOK.md` | Referência oficial de comandos |
| `/srv/ops/ai-governance/RECOVERY.md` | Procedimentos de recuperação |
| `/srv/ops/ai-governance/INCIDENTS.md` | Log de incidentes |
| `/srv/ops/ai-governance/OPENCLAW_DEBUG.md` | Debug do OpenClaw Bot |

---

**Gerado:** 2026-04-05 via Claude Code  
**Fontes:** /srv/ops/ai-governance/* (11 documentos)
