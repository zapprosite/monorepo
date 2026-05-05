# ADR-002 — Descontinuação do Motor PREVC e Adoção do GSD

**Data:** 2026-05-05  
**Status:** Aceito  
**Autor:** Antigravity (Arquiteto de Sistemas)

---

## Contexto

O Homelab Monorepo utilizava um "Motor PREVC" customizado composto por três scripts em `~/.hermes/scripts/`:

| Arquivo | Tamanho | Função |
|---------|---------|--------|
| `queue-control.sh` | 16KB | Orquestrador de pipeline em bash — gerenciava chunks, checkpoints e renovação de contexto |
| `pipeline-plan.py` | 9KB | Divisor de pipelines grandes em chunks sequenciais (≤CHUNK_SIZE tarefas) |
| `pipeline-executor.py` | 11KB | Executor auto-destrutivo — lia `pipeline.json`, executava tarefas, deletava o arquivo ao final |

Esses scripts implementavam uma solução de orquestração contextual "artesanal" para contornar a limitação de janela de contexto do Claude Code.

## Problema

- **Manutenção:** Scripts proprietários exigiam manutenção contínua conforme o Claude Code evoluía.
- **Context rot:** A estratégia de chunking não resolvia o problema de degradação de qualidade ao longo de sessões longas.
- **Overhead:** Sistema paralelo ao Claude Code CLI, sem integração com as melhores práticas da comunidade.
- **Sem comunidade:** Zero suporte externo, zero atualizações automáticas.

## Decisão

**Remover o Motor PREVC e adotar o GSD (Get Shit Done) v1.40.0** como sistema oficial de orquestração spec-driven.

### O que foi removido (2026-05-05)

```
~/.hermes/scripts/queue-control.sh      → DELETADO
~/.hermes/scripts/pipeline-plan.py      → DELETADO
~/.hermes/scripts/pipeline-executor.py  → DELETADO
~/.hermes/scripts/__pycache__/          → DELETADO
~/.hermes/pipeline-logs/                → ARQUIVADO em ~/.hermes/pipeline-logs.archive/
```

### O que foi instalado

**GSD v1.40.0** via `npx get-shit-done-cc@latest`:
- Runtime: **Antigravity** (suporte oficial)
- Escopo: **Global** (`~/.gemini/antigravity/`)
- 65 skills instaladas em `~/.gemini/antigravity/skills/gsd-*/`
- SDK em `~/.gemini/antigravity/sdk/`

#### Comandos GSD disponíveis (principais)

| Comando | Função |
|---------|--------|
| `/gsd-new-project` | Inicializa estrutura de planejamento GSD |
| `/gsd-map-codebase` | Escaneia e indexa o estado atual do codebase |
| `/gsd-help` | Exibe ajuda do sistema |
| `/gsd-discuss-phase` | Fase de discussão |
| `/gsd-plan-phase` | Fase de planejamento |
| `/gsd-execute-phase` | Fase de execução |
| `/gsd-progress` | Status do progresso |
| `/gsd-code-review` | Code review integrado |

## Preservação (Não Alterado)

As seguintes estruturas **NÃO foram tocadas**:

- `/srv/monorepo/scripts/nexus-*.sh` — SRE do Homelab (monitoramento, alertas, crons)
- `/srv/monorepo/.claude/hooks/` — Hooks de validação (`PreToolUse-Bash-validate.bash`, `PreToolUse-Edit-validate.bash`)
- `/srv/monorepo/.claude/skills/snapshot-safe/` — Proteção ZFS
- Integração CCR/LiteLLM (:4018) — Gateway canônico de LLM

## Referências Históricas (Não Modificadas)

Os seguintes SPECs referenciam o Motor PREVC e são mantidos como registro histórico imutável:

- `docs/SPECS/SPEC-007.md` — referência a `queue-control.sh`
- `docs/SPECS/SPEC-009.md` — referência a `queue-control.sh`
- `docs/SPECS/SPEC-010.md` — referência a `queue-control.sh`
- `docs/SPECS/SPEC-011.md` — referência a `queue-control.sh`
- `docs/SPECS/SPEC-208-nexus-prevc-unified-architecture.md` — arquitetura do Motor PREVC (legado)

## Consequências

### Positivas
- Manutenção zero: GSD é atualizado pela comunidade (`npx get-shit-done-cc@latest`)
- Context engineering embutido: soluciona "context rot" sistematicamente
- 65 skills especializadas disponíveis (code review, audit, milestones, etc.)
- Suporte oficial ao runtime Antigravity
- Comunidade ativa (60k stars, 5.1k forks no GitHub em 2026-05)

### Neutras
- GSD não é um binário no PATH — funciona como slash commands dentro do Antigravity/Claude Code
- O GSD não interfere com ZFS hooks, Nexus, ou CCR — todos continuam ativos
- Para usar o GSD em um projeto existente: executar `/gsd-map-codebase` depois `/gsd-new-project`

### Negativas
- Dependência externa: atualizações do GSD podem introduzir breaking changes
- Mitigação: versão fixada via `VERSION` file; atualizar manualmente quando necessário

---

*Registrado conforme Governança Homelab — Regra: Mudanças estruturais devem ser documentadas em `docs/ADRs/`.*
