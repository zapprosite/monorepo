# ADR 0008: Marketing — Calendário Editorial e Estratégia

## Contexto
Marketing precisa de calendário editorial com visão de pauta, produção e aprovação. Estratégia de tráfego pago requer planejamento por funil.

## Decisão

1. **Editorial Calendar**: tabela `editorial_calendar_items` com `titulo`, `tipo` (pauta/blog/carrossel/email), `status` (Ideia/Rascunho/Revisao/Aprovado/Publicando/Publicado), `data`, `campanhaId` (nullable FK)
2. **Campanhas**: tabela `campaigns` com `nome`, `canal`, `status`, `dataInicio`, `dataFim`
3. **Content Status**: workflow linear sem validação de transições ( Issue #CRM-013 )
4. **n8n Integration**: webhook cria item automaticamente a partir de jornal inteligente

## Consequências
- **Positivo**: calendário centralizado, vínculo com campanhas
- **Negativo**: qualquer transição de status permitida ( Issue #CRM-013 )
- **Riscos**: sem validação de etapas do workflow

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-18
**Related**: adr-0009, adr-0010