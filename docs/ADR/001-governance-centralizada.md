# ADR-001: Governança Centralizada em /srv/ops/ai-governance/

**Data:** 2026-03-16
**Status:** Aceito

## Contexto

O ambiente will-zappro opera com múltiplos agentes de IA (Claude Code, Codex CLI) que precisam de regras claras sobre o que podem e não podem fazer. Surgiu a necessidade de definir onde essas regras vivem — em um local central ou distribuídas em múltiplos pontos.

## Decisão

Toda governança de agentes IA fica centralizada em `/srv/ops/ai-governance/` com os seguintes documentos:

- **CONTRACT.md** — Princípios não-negociáveis (proteção de dados, integridade do host)
- **GUARDRAILS.md** — Comandos proibidos, que requerem aprovação, e seguros
- **CHANGE_POLICY.md** — Processo obrigatório para qualquer mudança
- **PARTITIONS.md** — Realidade física (discos, ZFS, mountpoints)

Os arquivos CLAUDE.md em `/etc/claude-code/` e `~/.claude/` apontam para esta source of truth, mas não duplicam conteúdo de políticas.

## Consequências

### Positivas
- Single source of truth — sem ambiguidade sobre qual regra vale
- Sobrevive a reinstalação do OS (vive em /srv, ZFS pool)
- Qualquer agente novo lê o mesmo conjunto de regras
- Versionado junto com operações do sistema

### Negativas
- Requer que todo agente seja configurado para ler /srv/ops/ai-governance/
- Se /srv estiver inacessível, agentes perdem referência de governança

## Alternativas Consideradas

### ~/.claude/governance/MASTER_POLICY.md
- Prós: Mais próximo do Claude Code, carregado automaticamente
- Contras: Duplica conteúdo, não acessível por outros agentes, não sobrevive reinstalação do OS, viola princípio de single source of truth

### Governança distribuída (cada repo tem suas regras)
- Prós: Regras específicas por contexto
- Contras: Inconsistência entre projetos, difícil manter sincronizado

## Referências

- `/srv/ops/ai-governance/CONTRACT.md`
- `/srv/ops/ai-governance/GUARDRAILS.md`
- `/etc/claude-code/CLAUDE.md`
