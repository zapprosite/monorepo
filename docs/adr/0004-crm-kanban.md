# ADR 0004: CRM — Kanban Interno

## Contexto
Times internos (comercial, marketing, operação) precisam de boards Kanban configuráveis com colunas, cards, checklists, SLA e prioridades.

## Decisão

1. **Kanban Boards**: tabela `kanban_boards` com `nome`, `setor`, `criadoPorId`
2. **Colunas**: tabela `kanban_columns` com `boardId`, `nome`, `ordem`
3. **Cards**: tabela `kanban_cards` com `columnId`, `titulo`, `descricao`, `prioridade`, `responsavelId`, `vencimento`, `sla`
4. **Checklist Items**: tabela `kanban_card_items` com `cardId`, `texto`, `checked`
5. **Relacionamentos**: cards pertencem a coluna, coluna pertence a board

## Consequências
- **Positivo**: boards multi-setor, cards com metadata rica
- **Negativo**: sem filtros avançados na listagem
- **Riscos**: sem paginação em boards grandes

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-19
**Related**: adr-0001