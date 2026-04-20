---
name: infra-from-spec
description: Infrastructure code generation — Docker Compose, Terraform, Prometheus alerts, Gitea workflows — using MiniMax LLM
trigger: /infra-gen
---

# Infra From Spec

## Objetivo

Generate infrastructure YAML/Terraform/Gitea workflow files from natural language, reading existing PORTS.md, SUBDOMAINS.md, and variables.tf for context before generating.

## Quando usar

- Adding a new Docker service with healthchecks
- Adding a new subdomain via Terraform
- Creating Prometheus alert rules
- Adding a Gitea Actions workflow

## Como usar

```
/infra-gen docker-compose [service]
/infra-gen terraform subdomain [subdomain] [ip:port]
/infra-gen prometheus alerts [service]
/infra-gen gitea workflow [name] [triggers]
```

Examples:
```
/infra-gen docker-compose loki
/infra-gen terraform subdomain chat http://10.0.5.2:8080
/infra-gen prometheus alerts loki
/infra-gen gitea workflow code-review push,pull_request
```

## Fluxo — terraform subdomain

```
/infra-gen terraform subdomain chat http://10.0.5.2:8080
  -> MiniMax le:
      /srv/ops/terraform/variables.tf
      /srv/ops/terraform/access.tf
      /srv/ops/ai-governance/PORTS.md
      /srv/ops/ai-governance/SUBDOMAINS.md
  -> Verifica conflitos de subdomain/porta
  -> Output: diff de variables.tf (services block) + access.tf (policy)
  -> Human approval -> commit
  -> smoke-tunnel.sh post-deploy
```

## Output esperado

- **docker-compose**: servico YAML completo com `healthcheck`, `networks`, `volumes`
- **terraform subdomain**: diff de `variables.tf` + `access.tf`
- **prometheus alerts**: regras YAML no padrao SPEC-023
- **gitea workflow**: `.gitea/workflows/<name>.yml` completo

## Bounded context

**Faz:**
- Le arquivos existentes antes de gerar (evita conflitos)
- Segue formatacao exata do monorepo (`map(object({...}))` para Terraform)
- Gera healthchecks para Docker services (SPEC-023 pattern)

**Nao faz:**
- Nao aplica Terraform automaticamente (`terraform apply` requer aprovacao)
- Nao atualiza PORTS.md ou SUBDOMAINS.md — gera draft para revisao humana
- Nao expoe portas publicamente sem aprovacao

## Aviso de governanca

Adicionar subdomain ou porta requer atualizacao de PORTS.md + SUBDOMAINS.md + NETWORK_MAP.md. Este skill gera o draft — a aplicacao e humana.

## Dependencias

- `MINIMAX_API_KEY` em .env
- Acesso de leitura a `/srv/ops/terraform/`
- Endpoint: `https://api.minimax.io/anthropic/v1`

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` (DevOps section)
- GOVERNANCE: `/srv/ops/ai-governance/PORTS.md` + `SUBDOMAINS.md`
