# ADR-002: Ambiente de Desenvolvimento VRV_BOT

**Data:** 2026-03-16
**Status:** Aceito

## Contexto

O ambiente de desenvolvimento precisa de visibilidade sobre o estado dos serviços, snapshots e mudanças recentes. Também precisa de documentação de decisões arquiteturais (ADRs) e um processo de bootstrap reprodutível.

## Decisão

Implementar o "VRV_BOT" como um conjunto de ferramentas de observabilidade:

1. **Dashboard Node.js + Express** em `/home/will/vrv-dashboard/` (porta 3333)
   - Read-only: mostra estado dos serviços, health checks, snapshots ZFS, changelog
   - Sem auto-approve toggle (respeita GUARDRAILS.md)
   - Dados coletados por request, sem daemon de polling

2. **ADRs** em `/srv/monorepo/docs/ADR/` com formato MADR

3. **Bootstrap script** `init_vrv_bot.sh` para setup com um comando

4. **Modelo Claude Code**: Opus como padrão via settings.json
   - Alternância manual com `/model sonnet` quando necessário
   - Sem roteamento automático (não suportado pelo Claude Code)

## Consequências

### Positivas
- Visibilidade do estado do sistema sem precisar de terminal
- ADRs documentam o "porquê" das decisões
- Bootstrap reprodutível para recovery ou novo setup
- Integrado com governança existente (não duplica)

### Negativas
- Dashboard requer Node.js + Express (mais uma dependência)
- Dados do dashboard são point-in-time (não realtime)

## Alternativas Consideradas

### Dashboard com auto-approve toggle
- Prós: Conveniência para operações rotineiras
- Contras: Viola GUARDRAILS.md, operações perigosas devem ter aprovação humana

### HTML estático + cron
- Prós: Zero dependências runtime
- Contras: Dados obsoletos entre execuções do cron, menos interativo

### Python + FastAPI
- Prós: Async, auto-docs
- Contras: Stack diferente do monorepo (Node.js/TS)

## Referências

- `/home/will/vrv-dashboard/` — código do dashboard
- `/home/will/init_vrv_bot.sh` — bootstrap script
- `/srv/ops/ai-governance/GUARDRAILS.md` — regras de aprovação
