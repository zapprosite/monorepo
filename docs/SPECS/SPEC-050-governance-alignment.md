---
name: SPEC-050-governance-alignment
description: Pente fino — integrar UFW + Traefik nos docs de governância, criar rules de rede consolidadas, colocar no topo AGENTS.md + CLAUDE.md. Cross-check ports, subdomains, firewall, proxy.
status: PROPOSED
priority: critical
author: Principal Engineer
date: 2026-04-15
specRef: SPEC-045, SPEC-047, SPEC-048, PORTS.md, SUBDOMAINS.md, NETWORK_MAP.md, GUARDRAILS.md, CONTRACT.md
---

# SPEC-050: Governance Alignment — UFW + Traefik + Port/Subnet Consolidation

## 1. Context

auditoria de governância revelou gaps críticos:

- **UFW** não documentado nos docs de rede (apenas referenciado em APPROVAL_MATRIX)
- **Traefik** (Coolify Proxy) sem documentação consolidada de regras de entrada
- **Portas**: ai-gateway `:4002` não está em PORTS.md, conflito Coolify/host process
- **Subdomínios**: `llm.zappro.site` → `:4000` (LiteLLM) mas ai-gateway está em `:4002` — Tunnel T400 pending
- **AGENTS.md** e **CLAUDE.md** sem referência às rules de rede UFW/Traefik
- **NETWORK_MAP** desatualizado: `:8202` wav2vec2 aparece mas não existe como container (é host mapping)
- **Firewall rules** espalhadas por múltiplos docs sem consolidação

---

## 2. Issues Identificadas

### Issue 1: UFW não documentado como layer de rede

- **Onde:** APPROVAL_MATRIX.md menciona UFW, mas sem detalhes
- **Problema:** Regras de firewall não estão consolidadas num doc central
- **Fix:** Criar secção UFW em NETWORK_MAP.md + referência em PORTS.md

### Issue 2: Traefik (Coolify Proxy) sem documentação

- **Onde:** ARCHITECTURE-OVERVIEW.md menciona "Coolify Proxy (Traefik)" mas sem detalhes
- **Problema:** Regras de ingress do Traefik não estão documentadas
- **Fix:** Adicionar Traefik rules ao NETWORK_MAP.md (portas 80/443/8080)

### Issue 3: ai-gateway :4002 missing from PORTS.md

- **Onde:** PORTS.md não lista `:4002` como ativo
- **Problema:** ai-gateway em `:4002` não está registado, impossível fazer governança
- **Fix:** Adicionar :4002 à secção "Active Ports" + "Available Ports"

### Issue 4: T400 — llm.zappro.site → :4002 pending

- **Onde:** SUBDOMAINS.md lista `llm.zappro.site` → :4000, SPEC-048 diz para rerouting
- **Problema:** T400 não foi executado, ai-gateway inacessível via subdomain
- **Fix:** Rerouting via Terraform (blocker: Cloudflare approval)

### Issue 5: NETWORK_MAP desatualizado — :8202 wav2vec2

- **Onde:** NETWORK_MAP.md lista `zappro-wav2vec2` como container mas na realidade é host mapping
- **Problema:** Docs não refletem a realidade — Confusion para debugging
- **Fix:** Corrigir NETWORK_MAP para dizer "host mapping 8202→8201" em vez de container

### Issue 6: AGENTS.md e CLAUDE.md sem network rules

- **Onde:** AGENTS.md e CLAUDE.md top rules não mencionam UFW/Traefik/port governance
- **Problema:** Agentes não têm referência rápida às rules de rede
- **Fix:** Adicionar secção "Network & Port Governance" ao topo de AGENTS.md e CLAUDE.md

---

## 3. Stack de Rede Consolidada

```
INTERNET
    │
    ▼
Cloudflare Edge (Zero Trust Tunnel)
    │
    ▼
cloudflared daemon (host network)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  TRAEFIK (Coolify Proxy) — ports 80/443/8080       │
│  ┌───────────────────────────────────────────────┐  │
│  │ Ingress rules (Cloudflare → localhost)        │  │
│  │  coolify.zappro.site  → :8000                │  │
│  │  hermes.zappro.site   → :8642                │  │
│  │  chat.zappro.site    → :8080 (OpenWebUI)     │  │
│  │  llm.zappro.site     → :4000 (LiteLLM)       │  │
│  │  api.zappro.site     → :4000                  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
    │
    ▼
UFW (host firewall)
┌─────────────────────────────────────────────────────┐
│  UFW active — default INPUT DROP                    │
│  ┌───────────────────────────────────────────────┐  │
│  │ ACCEPT 22/tcp    (SSH — Anywhere)            │  │
│  │ ACCEPT 80/tcp    (HTTP — Anywhere)           │  │
│  │ ACCEPT 443/tcp   (HTTPS — Anywhere)          │  │
│  │ ACCEPT 8080/tcp  (Traefik proxy — Anywhere)  │  │
│  │ ACCEPT 4000/tcp  (LiteLLM — localhost)       │  │
│  │ ACCEPT 11434/tcp (Ollama — localhost)        │  │
│  │ ACCEPT 8000/tcp  (Coolify — Cloudflare Only)  │  │
│  │ DROP    2222/tcp (Gitea SSH — Risk)         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
    │
    ▼
SERVICES (bare metal + Docker + Coolify)
```

---

## 4. Deliverables

1. **docs/INFRASTRUCTURE/NETWORK_MAP.md** — Atualizado com UFW + Traefik consolidados
2. **docs/INFRASTRUCTURE/PORTS.md** — Adicionar :4002 (ai-gateway), :8202 (wav2vec2 host mapping)
3. **docs/INFRASTRUCTURE/SUBDOMAINS.md** — T400 status: llm.zappro.site → :4002 pending
4. **AGENTS.md** — Adicionar "Network & Port Governance" rule no topo
5. **CLAUDE.md** — Adicionar "Network & Port Governance" rule no topo
6. **docs/GOVERNANCE/GUARDRAILS.md** — Adicionar UFW + Traefik rules
7. **docs/SPECS/SPEC-050/tasks.md** — Pipeline de execução

---

## 5. Rules de Rede para AGENTS.md / CLAUDE.md (Top)

```markdown
## Network & Port Governance (OBRIGATÓRIO)

### Antes de qualquer porta ou subdomínio:

1. Ler `/srv/monorepo/docs/INFRASTRUCTURE/PORTS.md`
2. Ler `/srv/monorepo/docs/INFRASTRUCTURE/SUBDOMAINS.md`
3. Verificar com `ss -tlnp | grep :PORTA`
4. Atualizar ambos os docs se adicionar porta/subdomínio

### UFW (Host Firewall)

- UFW ativo com `default INPUT DROP`
- Portas autorizadas: 22, 80, 443, 8080 (Cloudflare), 8000 (Coolify via Cloudflare)
- Nunca abrir 2222 (Gitea SSH) sem approval

### Traefik (Coolify Proxy)

- Todas as entradas passam por Traefik (Coolify Proxy) nas portas 80/443/8080
- Regras de ingress via Cloudflare Zero Trust Tunnel
- Nunca fazer port forwarding direto bypassing Traefik

### Portas Reservadas (Nunca usar)

- :3000 → Open WebUI proxy (RESERVED)
- :4000 → LiteLLM production (RESERVED)
- :4001 → OpenClaw Bot (RESERVED)
- :8000 → Coolify PaaS (RESERVED)
- :8080 → Open WebUI (Coolify managed) (RESERVED)
- :8642 → Hermes Gateway (RESERVED)
- :6333 → Qdrant (RESERVED)

### Portas Livres para Dev

- Faixa :4002–:4099 (microserviços)
- :5173 (Vite frontend)

### Adicionar Porta

1. `ss -tlnp | grep :PORTA` — confirmar livre
2. Adicionar a PORTS.md (Service, Host, Port, Purpose)
3. Se pública: adicionar a SUBDOMAINS.md + Terraform + cloudflared restart
4. Se firewall: `sudo ufw allow PORT/tcp`

### Adicionar Subdomínio

1. Verificar se porta já está em PORTS.md
2. Adicionar entrada em SUBDOMAINS.md
3. `cd /srv/ops/terraform/cloudflare && terraform apply`
4. Verificar cloudflared logs após restart
```

---

## 6. Acceptance Criteria

- [ ] PORTS.md inclui :4002 (ai-gateway) e :8202 (wav2vec2 host mapping)
- [ ] NETWORK_MAP.md tem secção UFW consolidada e Traefik rules
- [ ] SUBDOMAINS.md tem T400 status: llm.zappro.site → :4002 (PENDING)
- [ ] AGENTS.md top rule menciona UFW + Traefik + port governance
- [ ] CLAUDE.md top rule menciona UFW + Traefik + port governance
- [ ] GUARDRAILS.md menciona UFW como layer obrigatório
- [ ] T400 executado: llm.zappro.site → :4002

---

## 7. O que NÃO fazer

- ❌ Bypassar Traefik fazendo port forwarding direto
- ❌ Abrir portas sem verificar PORTS.md primeiro
- ❌ Adicionar subdomínio sem Terraform + cloudflared restart
- ❌ Desativar UFW ou fazer `ufw disable`
- ❌ Usar portas reservadas para dev
- ❌ Commit changes sem atualizar PORTS.md + SUBDOMAINS.md

---

## 8. Dependencies

- SPEC-045 (Governance reform)
- SPEC-047/048 (ai-gateway)
- PORTS.md, SUBDOMAINS.md, NETWORK_MAP.md
- GUARDRAILS.md, APPROVAL_MATRIX.md
