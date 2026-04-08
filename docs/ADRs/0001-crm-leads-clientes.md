# ADR 0001: CRM — Leads e Clientes

## Contexto
Gestão de leads e clientes é o núcleo do CRM Refrimix. Leads precisam de conversão.controlada para cliente, com rastreamento de origem e responsibility.

## Decisão

1. **Leads**: tabela `leads` com campos: `nome`, `email`, `telefone`, `origem`, `status`, `responsavelId`, `convertidoClienteId` (nullable FK para clients)
2. **Clientes**: tabela `clients` com `nome`, `tipo` (PF/PJ), `email`, `telefone`, `responsavelId`, `ativo`
3. **Conversão**: mutation `convertLeadToClient` copia dados do lead para cliente, define `convertidoClienteId`. Tipo cliente herdado da origem ou "Pessoa Física" como padrão
4. **Contatos/Endereços**: tabelas `contacts` e `addresses` com `clienteId` como FK

## Consequências
- **Positivo**: rastreamento completo de origem, histórico conversível
- **Negativo**: conversão sempre gera PF ( Issue #CRM-001 )
- **Riscos**: sem validação de duplicidade de email

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-17
**Related**: adr-0002, adr-0003
**Superseded by**: adr-0001