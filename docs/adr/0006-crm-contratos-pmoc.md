# ADR 0006: CRM — Contratos PMOC e Planos Residenciais

## Contexto
Clientes empresariais precisam de contratos PMOC (Plano de Manutenção Operacional) com vigência, frequência e unidades. Planos residenciais são recorrentes com benefícios.

## Decisão

1. **Contracts**: tabela `contracts` com `clienteId`, `tipo` (PMOC/Residencial/Corporativo), `status`, `dataInicio`, `dataFim` (nullable), `valor`, `frequencia`
2. **PMOC específico**: `pmocPlano` com `contractId`, `unidadeId`, `frequenciaMeses`, `proximoVencimento`
3. **Residential Plans**: catálogo de planos com `nome`, `periodicidade`, `beneficios`, `preco`
4. **Vencimento**: `dataFim` validado como após `dataInicio` ( Issue #CRM-006 )

## Consequências
- **Positivo**: contratos vencidos geram alertas, PMOC vinculado a unidades
- **Negativo**: sem validação automática de renovação
- **Riscos**: alertas de vencimento precisam de job scheduler

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-18
**Related**: adr-0001, adr-0007