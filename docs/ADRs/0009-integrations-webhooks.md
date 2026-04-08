# ADR 0009: Integrações — Webhooks e n8n

## Contexto
Automações de negócio (reativação 90d, alertas de vencimento, distribuição de leads) precisam de webhooks assinados e fila assíncrona.

## Decisão

1. **Webhook Events**: tabela `webhook_events` com `evento`, `payload`, `status` (recebido/processando/sucesso/falha), `tentativas`, `ultimoErro`
2. **Assinatura**: HMAC-SHA256 com secret por endpoint
3. **Idempotência**: header `X-Idempotency-Key` persiste, replay é ignorado
4. **n8n**: consume webhooks Refrimix, dispara automações, logs em `automation_runs`
5. **Retry Policy**: exponential backoff, máx 5 tentativas

## Consequências
- **Positivo**: automações desacopladas, fila resiliente
- **Negativo**: sem monitoramento em tempo real de filas
- **Riscos**: webhook sem resposta em 30s pode ser re-enviado

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-17
**Related**: adr-0010