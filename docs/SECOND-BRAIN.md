# Second Brain — Integração com Monorepo

> **Data:** 2026-04-22
> **Repo:** `ssh://git@127.0.0.1:2222/will-zappro/hermes-second-brain.git`
> **Token:** (via `.env` — `GITEA_TOKEN`)

---

## O que é o Second Brain

O **Hermes Second Brain** é um vault de conhecimento centralizado que mantém árvores de estrutura (`TREE.md`) de todos os projetos. Permite que qualquer agente LLM tenha contexto completo da estrutura de conhecimento antes de executar tarefas.

### Sistemas Suportados

O Second Brain serve **ambos** os sistemas Hermes:

| Sistema | Bot Telegram | Descrição |
|---------|-------------|-------------|
| **Hermes Gateway** | `@CEO_REFRIMIX_bot` | Sistema de polling próprio |

Cada sistema é **independente** — não existe routing centralizado ou `agency_router` partilhado.

### Repositórios Conhecidos

| Projeto | TREE.md | Descrição |
|---------|---------|------------|
| `hermes-second-brain` | `TREE.md` | Vault principal |
| `monorepo` | `monorepo-TREE.md` | Estrutura do monorepo |
| `crm-reflex` | `crm-TREE.md` | CRM (se existir) |

---

## Ordem de Carregamento de Contexto (Obrigatória)

**Antes de qualquer tarefa** leia nesta ordem:

```bash
# 1. Monorepo AGENTS.md (source of truth para processos)
cat /srv/monorepo/AGENTS.md | tail -200

# 2. Second Brain TREE (mapeia estrutura de conhecimento)
cat ~/.hermes/sb-context.md 2>/dev/null || bash ~/.hermes/scripts/sb-boot.sh

# 3. OPS Governance (regras operacionais)
cat /srv/ops/ai-governance/README.md 2>/dev/null
cat /srv/ops/ai-governance/CONTRACT.md 2>/dev/null

# 4. Sistema atual (se mudança de infra)
cat ~/Desktop/SYSTEM_ARCHITECTURE.md 2>/dev/null
```

---

## Comandos para Sync/Clone

### Clone Manual do Second Brain

```bash
# Clone via SSH (recomendado)
git clone ssh://git@127.0.0.1:2222/will-zappro/hermes-second-brain.git /tmp/hermes-second-brain

# Clone via HTTPS com token
GITEA_TOKEN="<redacted: source .env>"
git clone https://will-zappro:${GITEA_TOKEN}@127.0.0.1:2222/will-zappro/hermes-second-brain.git /tmp/hermes-second-brain
```

### Atualizar Second Brain Local

```bash
# Pull das últimas alterações
cd /tmp/hermes-second-brain && git pull origin main

# Verificar estrutura
ls -la /tmp/hermes-second-brain/
```

### Gerar e Sincronizar TREE.md do Monorepo

```bash
# Sincroniza TREE.md do monorepo → second-brain (via Gitea Actions)
bash /srv/monorepo/scripts/sync-second-brain.sh

# O script:
# 1. Clona/actualiza hermes-second-brain
# 2. Gera monorepo-TREE.md com a estrutura actual
# 3. Commita e faz push para main
```

### Boot do Second Brain (sb-boot.sh)

```bash
# Executar boot loader — fetch TREE.mds → ~/.hermes/sb-context.md
bash ~/.hermes/scripts/sb-boot.sh

# Com project específico
bash ~/.hermes/scripts/sb-boot.sh monorepo

# Output: ~/.hermes/sb-context.md (lido por todos os agentes)
```

---

## Estrutura do Second Brain

```
hermes-second-brain/
├── monorepo-TREE.md    # Estrutura completa do monorepo (15MB+, gerado por sync-second-brain.sh)
├── TREE.md             # TREE do vault (não do monorepo)
├── athlos/             # Projeto Athlos
│   ├── agents/
│   ├── rotinas/
│   └── skills/
├── refrimix/           # Projeto Refrimix
│   ├── Captacao/
│   ├── Context/
│   ├── Obras/
│   ├── Pos-Venda/
│   └── Skills/
└── will/               # Projeto Will (contexto pessoal)
    ├── Context/
    ├── Routines/
    └── Skills/
```

---

## Quando Carregar Qual Secção

| Cenário | Secção a Carregar |
|---------|-------------------|
| **Tarefa de código** | `AGENTS.md` → `monorepo-TREE.md` (procurar dirs `apps/`, `packages/`) |
| **Decisão arquitectural** | `AGENTS.md` → `docs/ARCHITECTURE-OVERVIEW.md` |
| **Mudança de infra** | `AGENTS.md` → `OPS Governance` → `SYSTEM_ARCHITECTURE.md` |
| **Operação de rede/porta** | `AGENTS.md` → `PORTS.md` → `SUBDOMAINS.md` |
| **Bug triage** | `AGENTS.md` → `monorepo-TREE.md` → `smoke-tests/` |
| **Revisão de código** | `AGENTS.md` → `docs/GUIDES/CODE-REVIEW-GUIDE.md` |

---

## Integração com Gitea CLI

```bash
# Obter TREE.md específico via API
GITEA_TOKEN=$(grep -i '^GITEA_TOKEN=' /srv/monorepo/.env | cut -d= -f2-)
curl -s -X GET "http://127.0.0.1:3300/api/v1/repos/will-zappro/hermes-second-brain/contents/monorepo-TREE.md" \
  -H "Authorization: Bearer $GITEA_TOKEN"

# Listar todos os ficheiros no second-brain
curl -s -X GET "http://127.0.0.1:3300/api/v1/repos/will-zappro/hermes-second-brain/contents/" \
  -H "Authorization: Bearer $GITEA_TOKEN"
```

---

## Fluxo Completo de Inicialização

```
1. sb-boot.sh → fetch TREE.mds → ~/.hermes/sb-context.md
2. Agente lê ~/.hermes/sb-context.md → contexto completo
3. Agente lê /srv/monorepo/AGENTS.md → processos e regras
4. Agente executa tarefa
5. (Opcional) sync-second-brain.sh → actualiza monorepo-TREE.md
```

---

## Ficheiros Relacionados

| Ficheiro | Propósito |
|----------|-----------|
| `~/.hermes/sb-context.md` | Digest completo dos TREE.md (gerado por sb-boot.sh) |
| `~/.hermes/scripts/sb-boot.sh` | Boot loader — fetch TREE.mds via Gitea API |
| `/srv/monorepo/scripts/sync-second-brain.sh` | Sincroniza monorepo-TREE.md → second-brain |
| `/srv/monorepo/AGENTS.md` | Source of truth para processos do monorepo |

---

## Notas

- O `monorepo-TREE.md` é **muito grande** (15MB+) — contém a estrutura completa
- Para tarefas específicas, procure directamente no `sb-context.md` em vez de ler tudo
- O sync para o second-brain é automático via Gitea Actions após merge em main
- O token GitHub (valor redigido; usar `GITEA_TOKEN` da `.env`) é apenas para clone HTTPS manual
