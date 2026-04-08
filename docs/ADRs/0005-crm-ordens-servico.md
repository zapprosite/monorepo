# ADR 0005: CRM — Ordens de Serviço e Relatórios Técnicos

## Contexto
OS (Ordens de Serviço) são o executor operacional do campo. Cada OS tem relatório técnico, checklist e materiais aplicados.

## Decisão

1. **Service Orders**: tabela `service_orders` com `clienteId`, `unitId`, `equipmentId`, `scheduleId`, `tecnicoId`, `numero` (auto: OS-YYYYMMDD-uuid), `status`, `tipo`, `dataAbertura`, `dataFechamento`
2. **Technical Reports**: tabela `technical_reports` com `serviceOrderId`, `laudo`, `assinaturaTecnico`, `assinaturaCliente`
3. **Material Items**: tabela `material_items` com `serviceOrderId`, `produto`, `quantidade`, `preco`
4. **Numeração**: `gen_random_uuid()` para uniqueness, não sequencial ( Issue #CRM-016 )

## Consequências
- **Positivo**: OS vinculada a schedule, relatório e materiais
- **Negativo**: sem validação de transições de status válido ( Issue #CRM-005 )
- **Riscos**: `dataFechamento` pode ser anterior a `dataAbertura`

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-18
**Related**: adr-0003, adr-0002