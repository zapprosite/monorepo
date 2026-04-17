---
name: SPEC-036-infinite-memory-architecture
description: Arquitetura de memoria infinita de 4 camadas para Claude Code
status: PROPOSED
priority: high
author: Principal Engineer
date: 2026-04-13
specRef: SPEC-023, SPEC-026
---

# SPEC-036: Arquitetura de Memoria Infinita para Claude Code

> **Governance:** Antes de modificar servicos imutaveis ou configuracoes de backup, verificar docs/GOVERNANCE/IMMUTABLE-SERVICES.md e .claude/rules/ para regras de aprovacao.

---

## Objective

Projetar e documentar a arquitetura de memoria infinita de 4 camadas para o Claude Code, garantindo persistencia, recuperacao e continuidade de contexto entre sessoes. Esta arquitetura permite que o agente mantenha memoria de longo prazo sem perda de dados ao reiniciar sessoes, combinando armazenamentos complementares para diferentes tipos de informacao.

---

## Tech Stack

| Component                        | Technology            | Notes                                      |
| -------------------------------- | --------------------- | ------------------------------------------ |
| Memoria de curto prazo           | Context window        | Inerente ao Claude Code                    |
| Memoria semantica de longo prazo | Qdrant                | Colecoes hvacr_knowledge + hermes-agent-memory |
| Memoria episodica                | memory-keeper SQLite  | ~450KB, backup diario 3AM                  |
| Memoria procedural               | CLAUDE.md + AGENTS.md | Skill anchors                              |
| Obsidian Vault                   | obsidian-git          | Sync para monorepo-obsidian GitHub         |
| Cron system                      | crontab               | Backup 24/7                                |

---

## Memory Layers

### Layer 1: Short-term (Context Window)

**Descricao:** Janela de contexto inerente ao Claude Code.

**Caracteristicas:**

- Capacidade inerente de contexto
- Disponivel imediatamente em cada sessao
- Limitado ao token window do modelo

**Responsabilidade:** Mantem contexto imediato da sessao atual.

---

### Layer 2: Long-term Semantic (Qdrant)

**Descricao:** Armazenamento vetorial para busca semantica de conhecimento.

**Colecoes:**

| Collection      | Chunk Size | Dimensoes | Uso                         |
| --------------- | ---------- | --------- | --------------------------- |
| hvacr_knowledge | 768        | 1536      | Conhecimento tecnico HVAC/R |
| hermes-agent-memory | 768        | 1536      | Memoria do Hermes Agent     |

**Caracteristicas:**

- Busca semantica por similaridade
- Persistencia em disco via Qdrant
- Ingestao via pipeline de chunking

**Responsabilidade:** Conhecimento consultavel por similaridade semantica.

---

### Layer 3: Episodic (memory-keeper SQLite)

**Descricao:** Banco SQLite para memoria episodica via memory-keeper.

**Caracteristicas:**

- Tamanho aproximado: 450KB
- Backup diario automatico as 3AM
- Local: `/srv/backups/memory-keeper/`
- Script de backup ja operacional

**Estrutura:**

```
/srv/backups/memory-keeper/
└── memory-keeper-YYYYMMDD.db
```

**Responsabilidade:** Memoria de eventos e episodios passados.

---

### Layer 4: Procedural (CLAUDE.md + AGENTS.md)

**Descricao:** Arquivos de configuracao e skill anchors.

**Arquivos:**

- `/srv/monorepo/CLAUDE.md` — Regras do projeto
- `/srv/monorepo/.claude/CLAUDE.md` — Regras do monorepo
- `/srv/monorepo/.claude/rules/*.md` — Skills e regras

**Caracteristicas:**

- Versionado em Git
- Sincronizado via mirror (SPEC-026)
- Inclui ganchos de comandos customizados

**Responsabilidade:** Conhecimento procedural, regras e comandos.

---

## Commands

```bash
# Analise de imagem com Qwen2.5-VL
/img

# End-of-session sync (docs -> memory, commit, push, merge)
/ship

# Quick feature ship (commit, merge, tag, nova branch)
/turbo
```

---

## Project Structure

```
/srv/monorepo/
├── CLAUDE.md                              # Regras do projeto
├── .claude/
│   ├── CLAUDE.md                         # Regras do monorepo
│   └── rules/
│       ├── backend.md                    # Regras API
│       ├── REVIEW-SKILLS.md             # Skills de code review
│       ├── search.md                    # Regras de pesquisa
│       └── hermes-agent-audio-governance.md # Audio stack (imutavel)
│
├── docs/
│   ├── SPECS/                           # Especificacoes
│   ├── ADRs/                            # Architecture Decision Records
│   ├── GUIDES/                          # How-to guides
│   ├── REFERENCE/                       # Technical references
│   └── obsidian/                        # Espelho read-only do Obsidian
│
└── ~/obsidian-vault/                    # Obsidian vault (sync GitHub)
    └── monorepo-obsidian/               # Repo GitHub
```

---

## Sync Architecture

### Obsidian Vault

**Fluxo:**

1. obsidian-git plugin faz sync in-app
2. System cron garante backup 24/7
3. GitHub repo: `monorepo-obsidian`

**Caminho:**

```
~/obsidian-vault/ -> monorepo-obsidian GitHub repo
```

### memory-keeper Backup

**Fluxo:**

1. Script operacional em `/srv/ops/scripts/`
2. Cron: `0 3 * * *` diario
3. Destino: `/srv/backups/memory-keeper/`

---

## Qdrant Collections

### hvacr_knowledge

| Param         | Valor                       |
| ------------- | --------------------------- |
| chunk_size    | 768                         |
| embedding_dim | 1536                        |
| uso           | Conhecimento tecnico HVAC/R |

### hermes-agent-memory

| Param         | Valor                   |
| ------------- | ----------------------- |
| chunk_size    | 768                     |
| embedding_dim | 1536                    |
| uso           | Memoria do Hermes Agent |

---

## Code Style

### Naming Conventions

| Element     | Convention      | Example                              |
| ----------- | --------------- | ------------------------------------ |
| Files       | `kebab-case.md` | `infinite-memory-architecture.md`    |
| Collections | `snake_case`    | `hvacr_knowledge`, `hermes-agent_memory` |
| Commands    | `slash-case`    | `/img`, `/ship`, `/turbo`            |

### Padroes de Arquitetura

- **Separacao de responsabilidades:** Cada layer tem funcao clara
- **Backup automatico:** Cron para dados criticos
- **Versionamento:** Git para configs e docs
- **Mirror sync:** Obsidian <-> GitHub

---

## Testing Strategy

| Level       | Scope                   | Framework       | Location                 |
| ----------- | ----------------------- | --------------- | ------------------------ |
| Smoke       | Health check das layers | `curl`          | Manual                   |
| Integration | Qdrant queries          | `qdrant-client` | `/srv/monorepo/apps/api` |
| Backup      | Validacao backup SQLite | `sqlite3`       | Cron job                 |

### Running Tests

```bash
# Verificar Qdrant health
curl -sf http://localhost:6333/collections

# Verificar memory-keeper backup
ls -la /srv/backups/memory-keeper/

# Verificar obsidian sync
cd ~/obsidian-vault && git status
```

---

## Success Criteria

| #    | Criterion                               | Verification                                       |
| ---- | --------------------------------------- | -------------------------------------------------- |
| SC-1 | Todas as 4 camadas operacionais         | Qdrant + memory-keeper + obsidian + context window |
| SC-2 | Obsidian vault sincroniza para GitHub   | `git log` mostra commits recentes                  |
| SC-3 | memory-keeper backup diario executa     | Log em `/srv/backups/memory-keeper/`               |
| SC-4 | Qdrant consultavel para busca semantica | Query retorna resultados                           |
| SC-5 | Zero perda de dados ao reiniciar sessao | Verificar persistencia entre sessoes               |

---

## Open Questions

| #    | Question                                           | Impact | Priority |
| ---- | -------------------------------------------------- | ------ | -------- |
| OQ-1 | Qual estrategia para cleanup automatico do SQLite? | Med    | Med      |
| OQ-2 | Frequencia de reindexacao do Qdrant?               | Med    | Med      |

---

## User Story

Como **agente Claude Code**, quero **manter memoria de longo prazo entre sessoes**, para **continuar trabalhos passados sem perda de contexto e recuperar conhecimento relevante**.

---

## Goals

### Must Have (MVP)

- [ ] Layer 1 (context window) operacional
- [ ] Layer 2 (Qdrant) com colecoes configuradas
- [ ] Layer 3 (memory-keeper) com backup diario
- [ ] Layer 4 (CLAUDE.md + AGENTS.md) versionados

### Should Have

- [ ] Obsidian vault sincroniza para GitHub
- [ ] Qdrant queryavel via API
- [ ] Validacao de backup automatica

### Could Have

- [ ] Dashboard Grafana para monitoring de memoria
- [ ] Auto-sync para Qdrant via cron

---

## Non-Goals

Esta especificacao NAO cobre:

- Implementacao de novos agentes de IA
- Modificacao do audio stack (SPEC-009)
- Infraestrutura host-level (ZFS, Docker)
- Autenticacao ou authorization

---

## Acceptance Criteria

| #    | Criterion                                           | Test                                            |
| ---- | --------------------------------------------------- | ----------------------------------------------- |
| AC-1 | Qdrant responde queries semanticas                  | `curl` para /collections/hvacr_knowledge/points |
| AC-2 | Backup SQLite existe em /srv/backups/memory-keeper/ | `ls -la` mostra arquivo com data atual          |
| AC-3 | Obsidian sync commit existe no GitHub               | `git log` no repo monorepo-obsidian             |
| AC-4 | CLAUDE.md e AGENTS.md versionados                   | `git status` mostra arquivos                    |

---

## Dependencies

| Dependency    | Status   | Notes                     |
| ------------- | -------- | ------------------------- |
| Qdrant        | READY    | ja configurado no homelab |
| memory-keeper | READY    | Script operacional        |
| obsidian-git  | READY    | Plugin configurado        |
| SPEC-023      | APPROVED | Unified monitoring        |
| SPEC-026      | APPROVED | Git mirror                |

---

## Decisions Log

| Date       | Decision              | Rationale                                   |
| ---------- | --------------------- | ------------------------------------------- |
| 2026-04-13 | 4 camadas de memoria  | Separação por tipo de acesso e persistencia |
| 2026-04-13 | Qdrant para semantico | Busca vetorial ja configurada               |
| 2026-04-13 | SQLite para episodico | memory-keeper ja operacional                |

---

## Checklist

- [ ] SPEC escrito e revisado
- [ ] Decisoes de arquitetura documentadas
- [ ] Criterios de aceite testaveis
- [ ] Dependencias identificadas
- [ ] Tasks geradas via `/pg`
- [ ] Zero hardcoded secrets
- [ ] Memory index atualizado (sync.sh)
