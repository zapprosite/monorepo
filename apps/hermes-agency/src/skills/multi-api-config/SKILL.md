# Skill: multi-api-config

## Descrição

Este skill responde perguntas sobre configuração de API base para múltiplos provedores LLM (OpenAI, Anthropic, MiniMax, Google AI, Azure, Groq, Ollama, LiteLLM).

## Quando usar

Usuário pergunta sobre:
- "Qual API base do OpenAI?"
- "Como configuro Anthropic no LiteLLM?"
- "Por que MiniMax dá 404?"
- "Como trocar provider?"
- "Quais providers estão configurados?"

## Como responder

1. Consultar `/srv/monorepo/docs/SPECS/SPEC-130-MULTI-PROVIDER-API.md` para info técnica
2. Consultar `/home/will/zappro-lite/config.yaml` para config atual
3. Consultar `/home/will/zappro-lite/.env` para tokens e variáveis

## Regra HC-33 (Anti-hardcoded)

⚠️ API_BASE deve ser SEM caminho!
- Correto: `https://api.minimax.io`
- Errado: `https://api.minimax.io/anthropic/v1` (causa 404)

## Provedores atualmente configurados

| Provider | Model | API Base | Status |
|----------|-------|----------|--------|
| MiniMax | minimax-m2.7 | https://api.minimax.io | ✅ OK |
| OpenRouter | qwen3.5-vl, seed-vl-mini | https://openrouter.ai | ✅ OK |
| Ollama | qwen2.5vl-3b | http://10.0.2.5:11434 | ✅ OK |
| Ollama | embedding-nomic | http://10.0.2.5:11434 | ✅ OK |
| Groq | whisper-1 | https://api.groq.com | ✅ OK |

## Troubleshooting rápido

| Problema | Solução |
|----------|---------|
| 404 duplicado | API_BASE tem path → remover |
| 401 Unauthorized | Verificar token, verificar Bearer header |
| Connection refused | Verificar MASQUERADE iptables |
| Timeout | Container sem rota externa |
