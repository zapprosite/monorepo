# ADR 0007: CRM — Lembretes e Fidelização

## Contexto
Clientes sem manutenção há 90+ dias precisam de reativação automática. Lembretes são críticos para compliance PMOC e operação.

## Decisão

1. **Reminders**: tabela `reminders` com `clienteId`, `tipo` (vencimento/followup/fidelizacao), `status` (pendente/concluido/cancelado), `dataProgramada`, `descricao`
2. **ScheduleId/ContractId**: colunas nullable, sem FK constraints ( Issue #CRM-002 )
3. **Fidelização**: `loyalty_events` com `clienteId`, `tipo`, `data`, `pontos`, ` expirou`
4. **Gatilhos**: job n8n identifica clientes sem OS há 90 dias, gera reminder automaticamente

## Consequências
- **Positivo**: lembretes programáveis, eventos de fidelidade rastreáveis
- **Negativo**: sem FK em `scheduleId` e `contractId` ( Issue #CRM-002 )
- **Riscos**: constraints missing podem causar dados órfãos

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-18
**Related**: adr-0006, adr-0010