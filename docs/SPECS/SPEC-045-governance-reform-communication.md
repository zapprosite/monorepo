# SPEC-045: Governance Reform — Infrastructure Communication

**Date:** 2026-04-14
**Author:** Claude Code
**Status:** SPECIFIED
**Type:** Documentation / Governance

---

## 1. Context

O monorepo tem um problema crítico de comunicação: um developer novo que ler os docs não consegue entender a arquitectura completa do sistema. Especificamente:

- **Ollama** está quase invisível na documentação
- **Coolify** não tem nenhum doc que explique o seu papel central como PaaS
- **Stack de infraestrutura** (Ollama, Qdrant, Hermes, Coolify, etc.) não tem um documento unificado
- Os SPECs estão fragmentados e contraditórios em algumas áreas

## 2. Objectivo

Reformular toda a documentação de governança para que qualquer developer consiga:

1. Ler um único documento e entender o stack completo
2. Saber onde cada serviço corre (Coolify vs bare metal vs Docker Compose)
3. Entender como fazer deploy de um novo serviço
4. Saber onde pedir ajuda (Infisical para secrets, Coolify para containers, etc.)

## 3. Scope

### In Scope

- Arquivos `*.md` na raiz de `/srv/monorepo/docs/`
- SPECs activos
- Governança docs (`docs/GOVERNANCE/`)
- Infrastructure docs (`docs/INFRASTRUCTURE/`)
- AGENTS.md, README.md, CLAUDE.md

### Out of Scope

- `docs/archive/` — mantêm-se como arquivo histórico
- `docs/obsidian/` — espelho read-only
- Ficheiros `.claude/` (skills, agents)

## 4. New Documents to Create

### 4.1 `docs/ARCHITECTURE-OVERVIEW.md` (NEW)

Documento principal que comunica toda a arquitectura:

```markdown
# Architecture Overview — Homelab Monorepo

## Infrastructure Stack (TL;DR)

| Service    | Where                     | Purpose                     | Access              |
| ---------- | ------------------------- | --------------------------- | ------------------- |
| Coolify    | Ubuntu Desktop:8000       | Container management (PaaS) | coolify.zappro.site |
| Ollama     | localhost:11434           | LLM inference (local GPU)   | via LiteLLM :4000   |
| Qdrant     | Coolify                   | Vector database             | localhost:6333      |
| Hermes     | Ubuntu Desktop bare metal | Agent brain + messaging     | hermes.zappro.site  |
| LiteLLM    | Docker Compose            | LLM proxy + rate limiting   | localhost:4000      |
| Grafana    | Docker Compose            | Metrics dashboards          | monitor.zappro.site |
| Loki       | Docker Compose            | Log aggregation             | via Grafana         |
| Prometheus | Docker Compose            | Metrics collection          | via Grafana         |

## How Services Connect

[Diagrama em texto das conexões]

## Quick Reference

### Coolify (Container Management)

- O que é: PaaS para gerir containers Docker
- Como aceder: https://coolify.zappro.site
- API: http://localhost:8000/api/v1
- Docs skills: `.claude/skills/coolify-access/`

### Ollama (Local LLM)

- O que é: Inference engine local (RTX 4090)
- Modelo: Qwen3-VL-8B-Instruct
- Como aceder: localhost:11434
- Usado por: LiteLLM, Hermès, Perplexity Agent

[continua...]
```

### 4.2 `docs/INFRASTRUCTURE/README.md` (NEW)

Guia para toda a pasta INFRASTRUCTURE.

### 4.3 Update `docs/GOVERNANCE/README.md`

Adicionar índice centralizado de governança.

## 5. Files to Refactor

### 5.1 Root Docs (Priority 1)

| File             | Action  | Reason                                                     |
| ---------------- | ------- | ---------------------------------------------------------- |
| `docs/README.md` | Rewrite | Primeiro ponto de contacto — falta contexto crítico        |
| `AGENTS.md`      | Update  | Referenciar nova architecture overview                     |
| `SPEC.md`        | Archive | Legado, substituído por SPEC-INDEX + ARCHITECTURE-OVERVIEW |

### 5.2 GOVERNANCE Docs (Priority 2)

| File                    | Action | Reason                                    |
| ----------------------- | ------ | ----------------------------------------- |
| `APPROVAL_MATRIX.md`    | Keep   | Já bom, poucos tweaks                     |
| `CONTRACT.md`           | Keep   | Já bom                                    |
| `GUARDRAILS.md`         | Keep   | Já bom                                    |
| `IMMUTABLE-SERVICES.md` | Update | Adicionar novos serviços (Hermes, Ollama) |
| `PINNED-SERVICES.md`    | Update | Adicionar serviços novos                  |

### 5.3 INFRASTRUCTURE Docs (Priority 3)

| File             | Action  | Reason                                            |
| ---------------- | ------- | ------------------------------------------------- |
| `NETWORK_MAP.md` | Update  | Verificar se reflecte estado actual               |
| `PORTS.md`       | Update  | Adicionar Ollama :11434, MCPO :8092, Hermes :8642 |
| `SERVICE_MAP.md` | Rewrite | Criar tabela clara de serviços                    |
| `SUBDOMAINS.md`  | Update  | Verificar estado actual                           |

### 5.4 SPECS (Priority 4)

| File            | Action     | Reason                                       |
| --------------- | ---------- | -------------------------------------------- |
| `SPEC-INDEX.md` | Update     | Reforçar que ARCHITECTURE-OVERVIEW é o TL;DR |
| SPECs activos   | Keep as-is | Manter trabalho existente                    |

## 6. Stack Topology (Canonical)

```
                    ┌─────────────────────────────────────┐
                    │         Cloudflare Tunnel            │
                    │  (cloudflared — SSL termination)      │
                    └──────┬──────┬──────┬──────┬────────┘
                           │      │      │      │
              coolify.    chat.   api.  list.  hermes.
              zappro.site zappro.site      zappro.site
                           │      │      │      │
                    ┌──────▼──────▼──┐   │      │
                    │  Coolify Proxy │   │      │
                    │  (Traefik)    │   │      │
                    └───┬────────────┘   │      │
                        │                │      │
              ┌─────────▼─────────────────▼──────▼─────┐
              │           Docker Network (Coolify)      │
              │                                         │
              │  ┌──────────────────────────────────┐│
              │  │  qdrant (Coolify managed)        ││
              │  │  port: 6333                      ││
              │  └──────────────────────────────────┘│
              │  ┌──────────────────────────────────┐│
              │  │  open-webui (Coolify managed)   ││
              │  │  port: 8080                     ││
              │  └──────────────────────────────────┘│
              └────────────────────────────────────────┘
                          │
              ┌───────────▼────────────────────────────────┐
              │  Ubuntu Desktop (bare metal)              │
              │                                            │
              │  ┌──────────────────────────────────────┐│
              │  │  Hermes Agent v0.9.0                ││
              │  │  gateway :8642  |  mcp :8092        ││
              │  │  Telegram polling                    ││
              │  └──────────────────────────────────────┘│
              │                                            │
              │  ┌──────────────────────────────────────┐│
              │  │  Ollama (RTX 4090)                  ││
              │  │  port: 11434 | model: Qwen3-VL-8B-Instruct  ││
              │  └──────────────────────────────────────┘│
              │                                            │
              │  ┌──────────────────────────────────────┐│
              │  │  Docker Compose stack               ││
              │  │  - LiteLLM (:4000)                 ││
              │  │  - Grafana (:3100)                 ││
              │  │  - Loki (:3101)                    ││
              │  │  - Prometheus (:9090)               ││
              │  │  - nginx-ratelimit-*                ││
              │  │  - openwebui-bridge-agent (:3456)  ││
              │  └──────────────────────────────────────┘│
              └────────────────────────────────────────────┘
```

## 7. Services Inventory (Canonical)

| Service        | Type            | Host              | Port   | Purpose               |
| -------------- | --------------- | ----------------- | ------ | --------------------- |
| Coolify        | PaaS            | Ubuntu Desktop    | 8000   | Container management  |
| Coolify Proxy  | Reverse Proxy   | Ubuntu Desktop    | 80/443 | SSL termination       |
| Qdrant         | Vector DB       | Coolify           | 6333   | RAG / embeddings      |
| OpenWebUI      | Web UI          | Coolify           | 8080   | Chat interface        |
| Hermes Gateway | Agent           | Ubuntu bare metal | 8642   | Agent brain           |
| Hermes MCP     | MCP Server      | Ubuntu bare metal | 8092   | MCP proxy             |
| Ollama         | LLM Engine      | Ubuntu Desktop    | 11434  | Local inference       |
| LiteLLM        | LLM Proxy       | Docker Compose    | 4000   | Multi-provider proxy  |
| Grafana        | Dashboards      | Docker Compose    | 3100   | Metrics visualization |
| Loki           | Log aggregation | Docker Compose    | 3101   | Centralized logs      |
| Prometheus     | Metrics         | Docker Compose    | 9090   | Metrics collection    |
| MCPO           | MCP Proxy       | Ubuntu bare metal | 8092   | MCP protocol bridge   |

## 8. Secrets Inventory

| Secret               | Location | Used By                         |
| -------------------- | -------- | ------------------------------- |
| COOLIFY_API_KEY      | .env     | Claude Code, hermes-coolify-cli |
| CLOUDFLARE_API_TOKEN | .env     | Terraform, cloudflared          |
| GITEA_ACCESS_TOKEN   | .env     | Git push, CI                    |
| INFISICAL_TOKEN      | .env     | All apps (via .env sync)        |
| MINIMAX_API_KEY      | .env     | LiteLLM, Hermes                 |
| TELEGRAM_BOT_TOKEN   | .env     | Hermes Gateway                  |

**Rule:** All secrets sourced from `.env` (canonical). Never read from Infisical directly in code.

## 9. Governance Rules Summary

| Rule                 | Where            | Description                                           |
| -------------------- | ---------------- | ----------------------------------------------------- |
| Coolify as PaaS      | This doc         | All containers via Coolify except Hermes (bare metal) |
| .env canonical       | docs/GOVERNANCE/ | All secrets via .env, not Infisical SDK in code       |
| Immutable services   | docs/GOVERNANCE/ | SPEC-009, SPEC-027, SPEC-029 protected                |
| Port governance      | PORTS.md         | Check before using new ports                          |
| Subdomain governance | SUBDOMAINS.md    | Check before adding subdomains                        |

## 10. Acceptance Criteria

- [ ] `docs/ARCHITECTURE-OVERVIEW.md` created with full stack table
- [ ] `docs/README.md` rewritten with architecture link
- [ ] `docs/INFRASTRUCTURE/README.md` created
- [ ] `docs/GOVERNANCE/README.md` updated
- [ ] `PORTS.md` updated with all current ports
- [ ] `SERVICE_MAP.md` rewritten as clear table
- [ ] `AGENTS.md` references ARCHITECTURE-OVERVIEW
- [ ] All other \*.md in docs/ root audited and updated
- [ ] Zero placeholder content ("TODO", "FIXME", "TBD" in final docs)

## 11. Anti-Patterns to Remove

- "verificar com time" sem responsável definido
- "em caso de dúvida consulte" sem link para documentação
- Placeholder de seccções incompletas
- Referências a OpenClaw que não foram actualizadas

## 12. Dependencies

- SPEC-029 (Infisical SDK mandatory)
- SPEC-031 (maintenance)
- SPEC-043 (subdomain prune)
