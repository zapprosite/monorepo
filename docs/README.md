# Homelab Monorepo — Documentacao

**O que e:** Monorepo do homelab zappro.site — infraestrutura auto-hospedada com GPU, agentes AI, e pipelines de deploy via Cloudflare Tunnel.

**Doc de arquitetura:** [ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md) — stack completo com topologia de rede, servicos, e conexoes.

---

## Estrutura de Docs

```
docs/
├── ARCHITECTURE-OVERVIEW.md  <- Stack overview
├── GOVERNANCE/               <- CONTRACT, GUARDRAILS, SECRETS-MANDATE, PINNED-SERVICES, IMMUTABLE-SERVICES, EXCEPTIONS, CHANGE_POLICY, MASTER-PASSWORD-PROCEDURE
├── INFRASTRUCTURE/            <- PORTS, SUBDOMAINS, NETWORK_MAP, SERVICE_MAP
├── SPECS/                    <- Especificacoes (SPEC-053, 058, 059, 060, 063, 064)
├── GUIDES/                   <- discovery, backup-runbook, LANGUAGE-STANDARDS
└── ADRs/                     <- ADR-001 (denv canonical)
```

---

## Onde Ir

### GOVERNANCE/ — Regras do Sistema

| Pergunta                     | Doc                                                         |
| ---------------------------- | ----------------------------------------------------------- |
| "O que e proibido?"          | [GUARDRAILS.md](./GOVERNANCE/GUARDRAILS.md)                 |
| "Como fazer mudanca segura?" | [CHANGE_POLICY.md](./GOVERNANCE/CHANGE_POLICY.md)           |
| "Secrets: onde estao?"       | [SECRETS-MANDATE.md](./GOVERNANCE/SECRETS-MANDATE.md)       |
| "Servicos imutaveis?"        | [IMMUTABLE-SERVICES.md](./GOVERNANCE/IMMUTABLE-SERVICES.md) |
| "Servicos pinned?"           | [PINNED-SERVICES.md](./GOVERNANCE/PINNED-SERVICES.md)       |
| "Exceptions?"                | [EXCEPTIONS.md](./GOVERNANCE/EXCEPTIONS.md)                 |

### INFRASTRUCTURE/ — Infraestrutura Tecnica

| Pergunta                 | Doc                                               |
| ------------------------ | ------------------------------------------------- |
| "Qual porta esta livre?" | [PORTS.md](./INFRASTRUCTURE/PORTS.md)             |
| "Subdominio existe?"     | [SUBDOMAINS.md](./INFRASTRUCTURE/SUBDOMAINS.md)   |
| "Topologia de rede?"     | [NETWORK_MAP.md](./INFRASTRUCTURE/NETWORK_MAP.md) |
| "Servicos: onde correm?" | [SERVICE_MAP.md](./INFRASTRUCTURE/SERVICE_MAP.md) |

### SPECS/ — Features e Servicos Activos

| SPEC | Descricao                                              | Estado      |
| ---- | ------------------------------------------------------ | ----------- |
| 053  | Hermes 100% Local Voice+Vision (Ollama+Whisper+Kokoro) | DONE        |
| 058  | Hermes Agency Suite (11 skills, Telegram bot)          | IMPLEMENTED |
| 059  | Hermes Agency Datacenter Hardening (HC-23/31/33/36)    | COMPLETED   |
| 060  | Hermes Agency Post-Hardening Improvements              | COMPLETED   |
| 063  | Super Review Enterprise Refactor                       | DONE        |
| 064  | Super Polish — Prune Legacy                            | DONE        |

---

## Stack de Infraestrutura

| Servico        | Tipo          | Porta | Proposito                            |
| -------------- | ------------- | ----- | ------------------------------------ |
| ai-gateway     | OpenAI compat | 4002  | Gateway unificado para todos os LLMs |
| Hermes Gateway | Agent         | 8642  | Agent brain + routing + skills       |
| STT (whisper)  | STT           | 8204  | faster-whisper-medium-pt             |
| TTS (Kokoro)   | TTS Bridge    | 8013  | Kokoro TTS com vozes PT-BR           |
| Ollama         | LLM Engine    | 11434 | Inference local (qwen2.5vl:7b)       |

Ver [ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md) para diagrama completo.

---

## Secrets — Regra de Ouro

**Todas as secrets estao em `.env`** (fonte canonica).

Ver [SECRETS-MANDATE.md](./GOVERNANCE/SECRETS-MANDATE.md) para politica completa.

---

## Para Agentes Claude Code

1. **Ler antes de trabalhar:** [ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md)
2. **Regras de governanca:** [GOVERNANCE/](./GOVERNANCE/)
3. **Estado actual da infra:** [INFRASTRUCTURE/](./INFRASTRUCTURE/)
4. **Secrets:** `.env` na raiz do monorepo — nunca perguntar por valores

### Orchestrator (/execute)

```
/execute <desc>  → /spec → /pg → 14 agentes paralelos → SHIPPER cria PR
```

### Skills Disponiveis

| Skill                           | Uso                           |
| ------------------------------- | ----------------------------- |
| `orchestrator/`                 | 14-agent system               |
| `cloudflare-tunnel-enterprise/` | Gerir tunnels e subdomínios   |
| `gitea-access/`                 | Gitea API integration         |
| `minimax-security-audit/`       | OWASP + secrets audit         |
| `secrets-audit/`                | Scan de secrets antes de push |
| `smoke-test-gen/`               | Gerar smoke tests             |

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

# Smoke tests
bash smoke-tests/smoke-multimodal-stack.sh
```

---

## Atualizacao de Docs

Docs sao sincronizados para memory via ai-context apos cada commit.
