# SPEC-077: pgAdmin Enterprise Governance & Standardization

> **Status:** Concluída
> **Data:** 2026-04-18
> **Domínio:** Infraestrutura / Observabilidade de Banco de Dados

## 1. Visão Geral
A infraestrutura do monorepo (Sovereign 2026) exige padrões rigorosos para a exposição e gerenciamento de serviços críticos. Esta SPEC estabelece o **pgAdmin** como a ferramenta de interface de usuário (UI) padrão para bancos de dados relacionais (PostgreSQL), emparelhando com o **Qdrant** (para dados vetoriais), sob as mesmas diretrizes de segurança e governança.

## 2. Padrões Enterprise (Anti-Fragility)

### 2.1 Mapeamento via Proxy (Sem Exposição Direta)
- O pgAdmin não deve ter portas mapeadas diretamente para `0.0.0.0` no host (`AP-1 Docker TCP Bridge`). 
- Toda requisição deve fluir via **Traefik** (Coolify Proxy) usando a porta 80 e 443 do host.

### 2.2 Subdomínio Canônico
- URL obrigatória: `https://pgadmin.zappro.site`
- Subdomínios temporários gerados dinamicamente (`*.sslip.io`) são expressamente descontinuados para evitar vulnerabilidade DNS e links quebrados.
- **Integração:** DNS configurado no Cloudflare (via Terraform) apontando para o servidor.

### 2.3 Controle de Porta Interna
- Para fins de registro na documentação (`PORTS.md`), foi reservada a porta interna `5050` como o padrão para a instância do pgAdmin containerizada, evitando choques futuros.

### 2.4 Credenciais (Single-User Local)
- O ambiente será de uso local (single-user), dispensando a necessidade de proteções rigorosas multi-usuário como `MASTER_PASSWORD_REQUIRED`.
- As credenciais de configuração (`PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`) não poderão existir "soltas" ou *hardcoded*. Elas **devem** seguir o padrão estabelecido no `.env` e espelhado de forma genérica em `.env.example`.

## 3. Topologia Atualizada de Banco de Dados

| Serviço | Papel | UI Subdomain | Rede/Mapeamento | Credenciais |
|---------|-------|--------------|-----------------|-------------|
| **PostgreSQL (zappro-litellm-db)** | Dados relacionais, transacionais (OrchidORM) | `pgadmin.zappro.site` | Docker rede coolify | Via `.env` |
| **Qdrant** | Dados vetoriais, RAG, Memória do Agente | `qdrant.zappro.site` | Rede interna (Coolify/Traefik) | Via `.env` |

### 3.1 connected_repo_db (API tRPC)

Banco de dados para a API Fastify + OrchidORM (`apps/api`).

| Variável | Valor | Fonte |
|----------|-------|-------|
| `DB_HOST` | `zappro-litellm-db` | Docker network alias |
| `DB_PORT` | `5432` | Padrão PostgreSQL |
| `DB_NAME` | `connected_repo_db` | Criado manualmente |
| `DB_USER` | `litellm` | Mesmo user do LiteLLM |
| `DB_PASSWORD` | `uUnUZrdGFl7rCJqUFYeMMUW4vKNhbDJX` | `.env` |

**Container:** `zappro-litellm-db` (PostgreSQL partilhado com LiteLLM)
**Status:** ✅ Criado, migrações pendentes (executar via Coolify ao fazer deploy)

**Credenciais no `.env`:** ✅ Adicionadas
**Credenciais no `.env.example`:** ✅ Adicionadas com placeholders

## 4. Critérios de Aceite
- [x] Subdomínio `pgadmin.zappro.site` provisionado via Terraform (execução manual pelo operador).
- [x] `PORTS.md` e `SUBDOMAINS.md` atualizados.
- [x] Dependência e governança oficializadas neste documento.
- [x] `connected_repo_db` criado e variáveis `DB_*` adicionadas ao `.env`.
- [x] Variáveis documentadas no `.env.example`.
