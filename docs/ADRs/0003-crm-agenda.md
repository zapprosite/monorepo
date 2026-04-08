# ADR 0003: CRM — Agenda Operacional

## Contexto
Técnicos de campo precisam de agenda organizada com visualização por dia/semana, vínculo com cliente, unidade e equipamento, e controle de status.

## Decisão

1. **Schedule**: tabela `schedules` com `clienteId`, `unitId`, `equipmentId`, `tecnicoId`, `data`, `horario`, `tipo` (visita/manutencao/corretiva/instalacao/retorno), `status` (Agendada/Confirmada/EmAndamento/Concluida/Cancelada)
2. **Índices**: em `clienteId`, `status`, `data`; falta em `tecnicoId` ( Issue #CRM-007 )
3. **Triggers**: ao concluir schedule,可以选择 criar OS automaticamente
4. **Bloqueios**: capacidade do técnico por horário, sem overlap

## Consequências
- **Positivo**: agenda centralizada, vínculo completo com campo
- **Negativo**: sem validação de transições de status ( Issue #CRM-005 )
- **Riscos**: técnico sem índice impacta performance em consultas

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-17
**Related**: adr-0002, adr-0005