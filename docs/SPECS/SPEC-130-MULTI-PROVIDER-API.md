# SPEC-130: Multi-Provider API Base Configuration

## Problema

MINIMAX_API_BASE com caminho completo (`https://api.minimax.io/anthropic/v1`) causa duplicacao de path no LiteLLM → 404.

**Regra HC-33:** API_BASE = apenas host+porta, SEM caminho. LiteLLM adiciona o path automaticamente.

## Provedores e API Bases

| Provider | API Base (correto) | Path LiteLLM adiciona | Armadilha |
|----------|---------------------|------------------------|-----------|
| OpenAI | `https://api.openai.com` | `/v1/chat/completions` | - |
| Anthropic | `https://api.anthropic.com` | `/v1/messages` | Usa `/v1/messages` nao `/v1/chat/completions` |
| MiniMax | `https://api.minimax.io` | `/v1/chat/completions` |⚠️ NUNCA incluir `/anthropic/v1` na base |
| Google AI | `https://generativelanguage.googleapis.com` | `/v1beta/models/{model}:generateContent` | Path complexo com placeholder |
| Azure | `https://{resource}.openai.azure.com` | `/openai/deployments/{deployment}/chat/completions` |⚠️ Requer deployment name no path |
| Groq | `https://api.groq.com` | `/openai/v1/chat/completions` | Path `/openai/v1/` (diferente!) |
| Ollama | `http://localhost:11434` | `/v1/chat/completions` | API key = fake-key |
| LiteLLM | `http://localhost:4000` | `/v1/chat/completions` | Usa master key como Bearer |

## Mecanismo de Path Concatenation

LiteLLM usa: `${api_base}${path_do_model}`

Para MiniMax com `api_base=https://api.minimax.io`:
- LiteLLM chama: `https://api.minimax.io/v1/chat/completions` ✅

Para MiniMax com `api_base=https://api.minimax.io/anthropic/v1`:
- LiteLLM chama: `https://api.minimax.io/anthropic/v1/v1/chat/completions` ❌ (404!)

## Common Pitfalls

1. **MINIMAX:** Nao incluir `/anthropic/v1` na API_BASE
2. **Azure:** Nao incluir `/openai/deployments/{name}` na API_BASE — LiteLLM adiciona
3. **Anthropic:** Nao usar `/v1/chat/completions` — Anthropic usa `/v1/messages`
4. **Groq:** Path inclui `/openai/v1/` prefixo

## Configuracao Atual (zappro-lite)

```yaml
# config.yaml
- model_name: minimax-m2.7
  litellm_params:
    model: minimax/MiniMax-M2.7
    api_key: os.environ/MINIMAX_API_KEY
    api_base: os.environ/MINIMAX_API_BASE  # = https://api.minimax.io (sem path!)

# .env
MINIMAX_API_BASE=https://api.minimax.io
```

## Troubleshooting

| Erro | Causa | Solucao |
|------|-------|---------|
| 404 duplique path | API_BASE tem path | Remover path, deixar so host |
| 401 Unauthorized | Token errado ou Bearer mal formatado | Verificar API_KEY e header |
| Connection refused | Container sem rota externa | Verificar MASQUERADE iptables |
