# Models

Lista dos modelos de IA disponíveis no padrão Hermes/LiteLLM 05/2026.

## Gateway Padrão

Todos os agentes Hermes devem usar a API OpenAI-compatible do LiteLLM:

```bash
OPENAI_BASE_URL=http://127.0.0.1:4018/v1
OPENAI_API_KEY=$LITELLM_MASTER_KEY
```

O Hermes não chama Ollama nem OpenRouter direto. O LiteLLM centraliza aliases, parâmetros, retries e fallbacks.

## Inventário Local Real

| Modelo Ollama | Uso | Observação |
|---------------|-----|------------|
| `qwen2.5-coder:14b-q6k` | Chat, code, texto | Modelo local principal |
| `qwen2.5vl:3b` | Visão | Apenas imagem/screenshot/UI visual |
| `nomic-embed-text:pinned-20260503` | Embeddings | Principal, 768D |
| `nomic-embed-text:latest` | Embeddings | Backup manual |

Não adicionar modelo local que não apareça em `ollama list`.

## Aliases LiteLLM

| Alias | Provider | Modelo real | Uso |
|-------|----------|-------------|-----|
| `hermes-auto` | Ollama via LiteLLM | `qwen2.5-coder:14b-q6k` | Padrão do Hermes, local primeiro |
| `hermes-local-code` | Ollama via LiteLLM | `qwen2.5-coder:14b-q6k` | Código, YAML, Docker, shell, refactor pequeno |
| `hermes-vision` | Ollama via LiteLLM | `qwen2.5vl:3b` | Imagem, screenshot, UI visual |
| `hermes-embed` | Ollama via LiteLLM | `nomic-embed-text:pinned-20260503` | RAG, memória, busca semântica |
| `hermes-embed-latest` | Ollama via LiteLLM | `nomic-embed-text:latest` | Backup manual de embedding |
| `hermes-cloud-cheap` | OpenRouter via LiteLLM | `deepseek/deepseek-v4-flash` | Primeiro fallback cloud |
| `hermes-cloud-pro` | OpenRouter via LiteLLM | `deepseek/deepseek-v4-pro` | Escalada de qualidade |
| `hermes-cloud-ui` | OpenRouter via LiteLLM | `moonshotai/kimi-k2.6` | UI, multimodal e visão complexa |
| `hermes-brain` | OpenRouter via LiteLLM | `deepseek/deepseek-v4-pro` | PRD, arquitetura, repo grande |

## Regras de Roteamento

| Tarefa | Alias |
|--------|-------|
| Pergunta simples, explicação, bash pequeno | `hermes-auto` |
| Código normal, debug, Docker, YAML, Go, Python | `hermes-local-code` |
| Repo inteiro, arquitetura, PRD, agente longo | `hermes-brain` |
| Imagem, screenshot, inspeção visual | `hermes-vision` |
| Visão local falhou ou tarefa visual complexa | `hermes-cloud-ui` |
| RAG, memória, busca semântica | `hermes-embed` |

## Fallbacks

OpenRouter entra somente por fallback ou por aliases cloud explícitos:

```text
hermes-auto        -> hermes-cloud-cheap -> hermes-cloud-pro
hermes-local-code  -> hermes-cloud-cheap -> hermes-cloud-pro
hermes-vision      -> hermes-cloud-ui
hermes-cloud-cheap -> hermes-cloud-pro
```

Atenção: fallback local para cloud envia prompt/código para OpenRouter. Use `hermes-local-code` sem fallback apenas se a tarefa exigir privacidade rígida.

## Critérios Negativos

Estes modelos não fazem parte do padrão 05/2026 e não devem aparecer em config ativo:

- `qwen2.5:14b`
- `qwen3-coder`
- `devstral`
- `gpt-oss`
- qualquer modelo local ausente de `ollama list`
