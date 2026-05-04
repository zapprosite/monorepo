# LLM Provider Architecture

## Overview

Padrão 05/2026: Hermes usa o LiteLLM como gateway único OpenAI-compatible em `http://127.0.0.1:4018/v1`.
Ollama é a rota econômica e padrão. OpenRouter entra somente por fallback controlado ou por aliases cloud explícitos.

```
Hermes Agent
  -> LiteLLM :4018/v1
    -> Ollama local para economia
    -> OpenRouter para fallback/escalada
```

## Inventário Local Permitido

| Modelo | Uso |
|--------|-----|
| `qwen2.5-coder:14b-q6k` | Texto, code, debug, YAML, Docker |
| `qwen2.5vl:3b` | Visão local |
| `nomic-embed-text:pinned-20260503` | Embeddings principais |
| `nomic-embed-text:latest` | Backup manual de embeddings |

Não referenciar modelos locais ausentes de `ollama list`.

## Provider Endpoints

| Provider | Endpoint | Uso |
|----------|----------|-----|
| LiteLLM | `http://127.0.0.1:4018/v1` | Gateway único para Hermes |
| Ollama | `http://127.0.0.1:11434` | Backend local acessado pelo LiteLLM |
| OpenRouter | `https://openrouter.ai/api/v1` | Backend cloud acessado pelo LiteLLM |

## Aliases

| Alias | Backend | Modelo |
|-------|---------|--------|
| `hermes-auto` | Ollama | `ollama_chat/qwen2.5-coder:14b-q6k` |
| `hermes-local-code` | Ollama | `ollama_chat/qwen2.5-coder:14b-q6k` |
| `hermes-vision` | Ollama | `ollama_chat/qwen2.5vl:3b` |
| `hermes-embed` | Ollama | `ollama/nomic-embed-text:pinned-20260503` |
| `hermes-embed-latest` | Ollama | `ollama/nomic-embed-text:latest` |
| `hermes-cloud-cheap` | OpenRouter | `openrouter/deepseek/deepseek-v4-flash` |
| `hermes-cloud-pro` | OpenRouter | `openrouter/deepseek/deepseek-v4-pro` |
| `hermes-cloud-ui` | OpenRouter | `openrouter/moonshotai/kimi-k2.6` |
| `hermes-brain` | OpenRouter | `openrouter/deepseek/deepseek-v4-pro` |

## Task-to-Alias Mapping

| Task Type | Alias | Notes |
|-----------|-------|-------|
| Pergunta simples, explicação, bash pequeno | `hermes-auto` | Local primeiro |
| Código normal, debug, Docker, YAML, Go, Python | `hermes-local-code` | Qwen2.5 Coder local |
| Repo inteiro, arquitetura, PRD, agente longo | `hermes-brain` | Escalada cloud explícita |
| Imagem, screenshot, UI visual | `hermes-vision` | Qwen2.5 VL local |
| Visão complexa ou falha local | `hermes-cloud-ui` | Kimi K2.6 |
| RAG, memória, busca semântica | `hermes-embed` | Nomic pinned, 768D |

## Fallbacks

Fallbacks ficam no LiteLLM, não nos agentes:

```yaml
litellm_settings:
  fallbacks:
    - hermes-auto:
        - hermes-cloud-cheap
        - hermes-cloud-pro
    - hermes-local-code:
        - hermes-cloud-cheap
        - hermes-cloud-pro
    - hermes-vision:
        - hermes-cloud-ui
    - hermes-cloud-cheap:
        - hermes-cloud-pro
```

Atenção: fallback local para cloud envia prompt/código ao OpenRouter.

## Embedding Strategy

```typescript
const EMBEDDING_CONFIG = {
  provider: 'litellm',
  model: 'hermes-embed',
  dimensions: 768,
  endpoint: 'http://127.0.0.1:4018/v1/embeddings',
};
```

`nomic-embed-text` não deve ser usado como chat. `qwen2.5vl:3b` não deve ser usado como padrão de texto/code.

## Implementation Notes

- Agentes escolhem apenas aliases LiteLLM.
- Agentes não duplicam fallback, budget ou provider routing.
- Redis, cache e budget entram em patch separado depois do gateway estável.
- Config ativo: `config/litellm/config.yaml`.
