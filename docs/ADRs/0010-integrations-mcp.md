# ADR 0010: Integrações — MCP Connectors e Provider Abstraction

## Contexto
Conectores MCP permitem integrar providers de IA (OpenAI, Claude, Ollama) com abstração de implementação. Providers podem falhar e o sistema deve ter fallback.

## Decisão

1. **MCP Connectors Registry**: tabela `mcp_connectors` com `nome`, `tipo` (openai/claude/ollama), `endpoint`, `apiKey` (encrypted), `status` (ativo/inativo), `healthCheckUrl`
2. **Provider Abstraction**: adapter pattern com interface `IProviderAdapter`, implementações específicas por provider
3. **AI Interactions Log**: tabela `ai_interactions` com `connectorId`, `prompt`, `response`, `durationMs`, `success`
4. **Fallback**: se provider primário falha, tentar secundário automaticamente
5. **Timeout/Retry**: 30s timeout, 3 retries, exponential backoff

## Consequências
- **Positivo**: múltiplos providers, fallback automático, logs de interação
- **Negativo**: sem rate limit global entre providers
- **Riscos**: credenciais expostas em plaintext em `apiKey` field ( Needs encryption at rest )

---
**Status**: implemented
**Autor**: will
**Data**: 2026-03-17
**Related**: adr-0009