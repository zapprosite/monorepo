# Homelab Monorepo — Documentacao

**O que e:** Monorepo do homelab zappro.site — infraestrutura auto-hospedada com GPU, agentes AI, e pipelines de deploy via Cloudflare Tunnel.

**Doc de arquitetura:** [ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md) — stack completo com topologia de rede, servicos, e conexoes.

---

## Estrutura de Docs

```
docs/
├── GOVERNANCE/         <- Regras, permissoes, politicas (imutavel)
├── INFRASTRUCTURE/     <- Rede, portas, subdomínios, ZFS
├── SPECS/              <- Especificacoes de features e servicos
├── GUIDES/             <- Guias operacionais
├── ADRs/               <- Architecture Decision Records
├── OPERATIONS/         <- Skills e scripts operacionais
├── MCPs/               <- MCP servers e integracoes
├── REFERENCE/          <- Referencia tecnica
└── TEMPLATES/          <- Templates para incidentes, mudancas, etc.
```

---

## Onde Ir

### GOVERNANCE/ — Regras do Sistema

| Pergunta                     | Doc                                                   |
| ---------------------------- | ----------------------------------------------------- |
| "Posso fazer X?"             | [APPROVAL_MATRIX.md](./GOVERNANCE/APPROVAL_MATRIX.md) |
| "O que e proibido?"          | [GUARDRAILS.md](./GOVERNANCE/GUARDRAILS.md)           |
| "Como fazer mudanca segura?" | [CHANGE_POLICY.md](./GOVERNANCE/CHANGE_POLICY.md)     |
| "Secrets: onde estao?"       | [SECRETS-MANDATE.md](./GOVERNANCE/SECRETS-MANDATE.md) |
| "Recuperacao de incidente?"  | [RECOVERY.md](./GOVERNANCE/RECOVERY.md)               |
| "Onboarding rapido?"         | [QUICK_START.md](./GOVERNANCE/QUICK_START.md)         |

### INFRASTRUCTURE/ — Infraestrutura Tecnica

| Pergunta                   | Doc                                               |
| -------------------------- | ------------------------------------------------- |
| "Qual porta esta livre?"   | [PORTS.md](./INFRASTRUCTURE/PORTS.md)             |
| "Subdominio existe?"       | [SUBDOMAINS.md](./INFRASTRUCTURE/SUBDOMAINS.md)   |
| "Topologia de rede?"       | [NETWORK_MAP.md](./INFRASTRUCTURE/NETWORK_MAP.md) |
| "ZFS: quais pools/discos?" | [PARTITIONS.md](./INFRASTRUCTURE/PARTITIONS.md)   |
| "Servicos: onde correm?"   | [SERVICE_MAP.md](./INFRASTRUCTURE/SERVICE_MAP.md) |

### SPECS/ — Features e Servicos

| Pergunta                   | Doc                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| "O que faz Hermes?"        | [SPEC-038-hermes-agent-migration.md](./SPECS/SPEC-038-hermes-agent-migration.md)           |
| "Como funciona o tunnel?"  | [SPEC-039-hermes-gateway-tunnel.md](./SPECS/SPEC-039-hermes-gateway-tunnel.md)             |
| "Alertas e rate limiting?" | [SPEC-040-homelab-alerting-rate-limit.md](./SPECS/SPEC-040-homelab-alerting-rate-limit.md) |
| "Infraestrutura overview?" | [ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md)                                     |

Ver [SPEC-INDEX.md](./SPECS/SPEC-INDEX.md) para lista completa de SPECs activos.

---

## Stack de Infraestrutura (TL;DR)

| Servico        | Tipo            | Host              | Porta | Proposito                            |
| -------------- | --------------- | ----------------- | ----- | ------------------------------------ |
| Coolify        | PaaS            | Ubuntu Desktop    | 8000  | Gestao de containers Docker          |
| Qdrant         | Vector DB       | Coolify           | 6333  | RAG / embeddings                     |
| Hermes Gateway | Agent           | Ubuntu bare metal | 8642  | Agent brain + messaging              |
| Hermes MCP     | MCP Server      | Ubuntu bare metal | 8092  | MCP proxy                            |
| Ollama         | LLM Engine      | Ubuntu Desktop    | 11434 | Inference local (RTX 4090)           |
| LiteLLM        | LLM Proxy       | Docker Compose    | 4000  | Multi-provider proxy + rate limiting |
| Grafana        | Dashboards      | Docker Compose    | 3100  | Visualizacao de metricas             |
| Loki           | Log aggregation | Docker Compose    | 3101  | Logs centralizados                   |
| Prometheus     | Metrics         | Docker Compose    | 9090  | Coleccao de metricas                 |

Ver [ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md) para diagrama completo de topologia.

---

## Secrets — Regra de Ouro

**Todas as secrets estao em `.env`** (fonte canonica). Nunca ler de Infisical directamente em codigo.

| Variavel               | Descricao                   |
| ---------------------- | --------------------------- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token        |
| `COOLIFY_ACCESS_TOKEN` | Coolify Bearer Token        |
| `GITEA_ACCESS_TOKEN`   | Gitea Personal Access Token |
| `INFISICAL_TOKEN`      | Infisical Service Token     |
| `TELEGRAM_BOT_TOKEN`   | Hermes Gateway Telegram     |

Ver [SECRETS-MANDATE.md](./GOVERNANCE/SECRETS-MANDATE.md) para politica completa.

---

## Para Agentes Claude Code

1. **Ler antes de trabalhar:** [ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md)
2. **Regras de governanca:** [GOVERNANCE/](./GOVERNANCE/)
3. **Estado actual da infra:** [INFRASTRUCTURE/](./INFRASTRUCTURE/)
4. **Secrets:** `.env` na raiz do monorepo — nunca perguntar por valores

### Skills Disponiveis

| Skill                           | Uso                               |
| ------------------------------- | --------------------------------- |
| `cloudflare-tunnel-enterprise/` | Gerir tunnels e subdomínios       |
| `coolify-access/`               | Deploy e gestao de containers     |
| `new-subdomain/`                | Criar novo subdominio (fast path) |
| `secrets-audit/`                | Scan de secrets antes de push     |

---

## Comandos Uteis

```bash
# Ver ports em uso
ss -tlnp | grep -E ':[0-9]+'

# Ver subdomínios activos
cat docs/INFRASTRUCTURE/SUBDOMAINS.md

# Ver servicos e estado
cat docs/INFRASTRUCTURE/SERVICE_MAP.md

# Audit de branches (antes de push)
bash /srv/ops/scripts/audit-branches.sh
```

---

## Atualizacao de Docs

Docs sao sincronizados para memory via ai-context apos cada commit. Ver [AI-CONTEXT.md](./AI-CONTEXT.md).

**Regra:** Todo doc em `docs/` e source of truth. Não fazer commit de .env ou secrets.
