# ADR 0002: CRM — Equipamentos e Unidades

## Contexto
Equipamentos de climatização são ativos centrais para manutenção, histórico e contratos. Cada equipamento pertence a uma unidade (local) que pertence a um cliente.

## Decisão

1. **Unidades**: tabela `units` com `clienteId` (FK), `nome`, `enderecoId` (FK). Cliente pode ter múltiplas unidades
2. **Equipamentos**: tabela `equipment` com `clienteId` (FK RESTRICT), `unitId` (FK SET NULL), `tipo`, `marca`, `modelo`, `numeroSerie`, `status`
3. **Índices**: em `clienteId`, `status`; lacking `tecnicoId` ( Issue #CRM-007 )
4. **OnDelete**: ao deletar cliente, equipamento é RESTRICT (bloqueado); ao deletar unidade, `unitId` set NULL

## Consequências
- **Positivo**: estrutura hierárquica clara (cliente→unidade→equipamento)
- **Negativo**: exclusão de cliente exige primeiro remover equipamentos
- **Riscos**: `tecnicoId` sem índice, queries por técnico podem ser lentas

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-17
**Related**: adr-0001, adr-0003