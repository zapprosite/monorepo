---
created: 2026-04-23
updated: 2026-04-23
owner: equipe-ops@zappro.site
status: ativo
version: 1.0.0
---

# SPEC-120: LiteLLM Embeddings Hang Fix

## Resumo

O endpoint `/v1/embeddings` do LiteLLM (porta 4000) faz hang — não retorna resposta, nem erro, nem timeout. O endpoint `/v1/chat/completions` funciona perfeitamente. O embedding direto via `192.168.15.83:11434` também funciona.

## Problema

- LiteLLM rodando em `127.0.0.1:4000` (bind local)
- `/v1/chat/completions` → funciona (~0.5s)
- `/v1/embeddings` → **HANG** (trava infinitamente, sem resposta)
- Embedding direto `curl http://192.168.15.83:11434/v1/embeddings` → funciona (~0.5s)
- LiteLLM config usa `api_base: http://192.168.15.83:11434/v1` para `embedding-nomic`

## Rede Atual

```
Host: 192.168.15.83 (enp10s0)
Ollama (nomic-embed-text): 192.168.15.83:11434
LiteLLM: 127.0.0.1:4000
```

## Arquitetura de Rede Docker

- `ai-gateway_default` (br-b33dfa19fcf5): zappro-litellm (10.0.10.3), zappro-ai-gateway (10.0.10.2)
- `zappro-lite_default` (br-67b37163c04b): zappro-litellm (10.0.2.4), qwen2-vl7b (10.0.2.5)
- `qgtzrmi6771lt8l7x8rqx72f` (br-99ef76e26cc6): zappro-litellm (10.0.19.6)

## LiteLLM Config Atual (`/home/will/zappro-lite/config.yaml`)

```yaml
- model_name: embedding-nomic
  litellm_params:
    model: openai/nomic-embed-text
    api_base: http://192.168.15.83:11434/v1
    api_key: fake-key
    rpm: 60
    max_parallel_requests: 5
  model_info:
    mode: embedding
```

## Testes Conhecidos

```bash
# Funciona - embedding direto no Ollama
curl --max-time 15 -s -X POST "http://192.168.15.83:11434/v1/embeddings" \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "input": "hello"}'
# Retorna embedding em ~0.5s

# Funciona - chat via LiteLLM
curl --max-time 15 -s -X POST "http://127.0.0.1:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1" \
  -d '{"model": "qwen2.5vl-3b", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 10}'
# Retorna resposta em ~0.5s

# HANG - embeddings via LiteLLM
curl --max-time 15 -s -X POST "http://127.0.0.1:4000/v1/embeddings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1" \
  -d '{"model": "embedding-nomic", "input": "hello"}'
# Trava infinitamente (exit 124 timeout)
```

## Hipóteses para Investigação

1. **LiteLLM embedding route bug** — A rota `/v1/embeddings` do LiteLLM tem bug conhecido?
2. **ollama translate error** — LiteLLM tenta traduzir a resposta mas trava em algum ponto
3. **api_base mismatch** — O path `/v1` vs `/api/embeddings` no Ollama
4. **Timeout config** — O Ollama pode estar com timeout muito baixo para embedding
5. **Model name mismatch** — LiteLLM usa `openai/nomic-embed-text` mas Ollama espera `nomic-embed-text`
6. **Nomic não carregado no Ollama** — O modelo pode não estar disponível via API route
7. **LiteLLM version bug** — Bug específico na versão do LiteLLM para embeddings com Ollama

## Tarefas do Pipeline

1. **NET-DEBUG**: Diagnosticar连通性 entre LiteLLM e Ollama
2. **CONFIG-FIX**: Testar diferentes configurações de api_base e model name
3. **LITELLM-LOGS**: Analisar logs do LiteLLM para embeddings
4. **OLLAMA-TEST**: Testar mais endpoints do Ollama para isolar o problema
5. **ALTERNATIVE**: Implementar fallback (OpenRouter ou MiniMax embeddings)
6. **VERIFY**: Verificar se fix funciona com testes

## Acceptance Criteria

- `/v1/embeddings` do LiteLLM retorna embedding válido em < 5s
- Nenhum hang ou timeout excessivo
- Resultado consistente com embedding direto do Ollama

## Referências

- LiteLLM embedding docs: https://docs.litellm.ai/docs/embedding
- Ollama embedding API: `/api/embeddings` vs `/v1/embeddings`
