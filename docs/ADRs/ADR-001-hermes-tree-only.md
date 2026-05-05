# ADR-001: Hermes Tree-Only — Eliminação de State Persistente

## Status
Accepted

## Date
2026-05-05

## Context
O repositório mantinha **dois sistemas de contexto concorrentes**:

1. **~/.hermes/** — Hermes CLI gateway com `state.db` (760MB), `response_store.db`, caches, backups, sessions (139 diretórios), skills (139 diretórios), consumindo **8.6GB RAM**.
2. **/srv/hermes-second-brain/** — Uvicorn service na porta 6337 com próprio SQLite e estrutura de libs/ duplicada.
3. **HCE v2.1** — Nosso Context Engine recém-criado na porta 8642.

Problemas:
- **Porta 8642** em guerra: hermes-gateway vs HCE v2.1
- **RAM desperdiçada**: 8.6GB para um "leitor de contexto"
- **Duplicação**: 3x `manager.py`, 2x `libs/memory/`, 2x `libs/context/`
- **Poluição**: 35+ diretórios em `~/.hermes/`, 4 databases, 3 venvs
- **Conflito de propósito**: Hermes tentava ser "cérebro persistente" quando deveria ser "leitor de tree"

## Decision
**Eliminar todo state persistente do Hermes.** Converter para modelo **Aider-like: zero state, zero daemon, apenas tree.**

### Ações Executadas
1. **Parado** `hermes-gateway.service` (systemd) — port 8642 liberada
2. **Morto** `uvicorn` hermes-second-brain — port 6337 liberada
3. **Criado** `scripts/hermes-tree.py` — gera tree em 50ms e morre
4. **Consolidado** HCE v2.1 como único serviço na porta 8642
5. **Adicionada** regra absoluta no AGENTS.md § Hermes Tree-Only

### Hermes Tree-Only Rules
- ✅ **Permitido**: `scripts/hermes-tree.py`, `aider-tree.sh`, `git diff --cached --name-only`
- ❌ **Proibido**: `state.db`, `state.json`, `.skills_prompt_snapshot.json`, `models_dev_cache.json` > 1MB
- ❌ **Proibido**: Daemons Python consumindo > 512MB RAM para "contexto"
- ❌ **Proibido**: Duplicar `libs/` fora do monorepo

## Alternatives Considered

### A. Manter ambos (status quo)
- **Rejeitado**: Guerra de portas, 8.6GB RAM, salada de código

### B. Migrar ~/.hermes/state.db para Qdrant
- **Rejeitado**: Ainda é state persistente. O problema é filosofia, não tecnologia.

### C. Hermes como microservice Docker
- **Rejeitado**: Adiciona complexidade sem valor. Tree não precisa de container.

## Consequences
- **RAM liberada**: ~8.6GB
- **Portas limpas**: 8642 = HCE v2.1 único, 6337 = livre
- **Código único**: `libs/` somente em `/srv/monorepo/`
- **Contexto é tree**: 50ms para gerar, zero manutenção
- **Hierarquia clara**:
  - **Curto prazo**: `libs/memory/manager.py` (SQLite, monorepo)
  - **Médio prazo**: HCE API na porta 8642
  - **Longo prazo**: Qdrant via pipeline `/embed` → `/qdrant`

## Infração
Quebrar esta ADR = criar arquivo de state > 1MB fora do monorepo.
Penalidade: PR bloqueado, CSO alert.
