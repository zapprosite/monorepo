---
name: SPEC-REVIEW-HELIX-MAX
description: Review enterprise via Helix em modo maximo + Nexus agents
status: draft
owner: platform-engineering
created: 2026-04-26
---

# SPEC-REVIEW-HELIX-MAX — Review Enterprise via Helix + Nexus

## Problema

O monorepo precisa de um review enterprise completo usando:
1. **Helix editor** em modo máximo poder (LSP, tree-sitter, multi-cursor, macros)
2. **Nexus 7 review agents** em paralelo
3. **Rate limit** de 500 RPM respeitado

## Solução: Abordagem Híbrida

### Fase 1: Helix como Scanner Primário
Ferramentas nativas do Helix para discovery rápido:

| Comando Helix | Uso |
|---------------|-----|
| `:grep -r "TODO\|FIXME\|BUG"` | Find tech debt |
| `:grep -r "sk-\|api_key\|password"` | Find secrets |
| `:lf /srv/monorepo` | File tree |
| `gd` (goto definition) | Trace dependencies |
| `g?` (hover docs) | LSP diagnostics |
| `*` (multi-cursor search) | Bulk operations |

### Fase 2: Nexus Agents como Analistas
7 agents executando análise profunda em paralelo:
- correctness-reviewer
- readability-reviewer
- architecture-reviewer
- security-reviewer
- perf-reviewer
- dependency-auditor
- quality-scorer

## Scope

- `/srv/monorepo/` completo
- Rate limit: 500 RPM (MiniMax M2.7)
- Max parallel workers: 7

## Execução

```bash
# 1. Helix: Scan rápido com grep
hx --batch /srv/monorepo -c 'grep -r "TODO\|FIXME"'
hx --batch /srv/monorepo -c 'grep -r "sk-\|api_key"'

# 2. Nexus: 7 agents em paralelo
cd /srv/monorepo
for AGENT in correctness readability architecture security perf dependency quality; do
  claude --model minimax-minimax -p "$(cat .claude/vibe-kit/agents/review/${AGENT}-reviewer/system-prompt.md)" &
done
```

## Acceptance Criteria

1. ✅ Helix scan completo (TODOs, secrets, errors)
2. ✅ 7 Nexus agents executando em paralelo
3. ✅ Reports individuais salvos em `docs/REVIEW-*-2026-04-26.md`
4. ✅ Report agregado final com quality score
5. ✅ Zero rate limit violations (500 RPM)

## Riscos

- Rate limit excedido → mitigated by 500ms delay entre chamadas
- Helix batch mode limitado → mitigated by using grep before helix
