# LiteLLM Proxy Configuration Template

Padrão Hermes/LiteLLM 05/2026. O arquivo ativo é `config/litellm/config.yaml`.

```yaml
# LiteLLM Proxy: http://127.0.0.1:4018
# Ollama host:    http://127.0.0.1:11434

model_list:
  - model_name: hermes-local-code
    litellm_params:
      model: ollama_chat/qwen2.5-coder:14b-q6k
      api_base: os.environ/LITELLM_OLLAMA_URL
      keep_alive: -1
      temperature: 0.1
      timeout: 300
    model_info:
      mode: chat
      description: "Local principal: Qwen2.5 Coder 14B Q6_K para code/texto"

  - model_name: hermes-auto
    litellm_params:
      model: ollama_chat/qwen2.5-coder:14b-q6k
      api_base: os.environ/LITELLM_OLLAMA_URL
      keep_alive: -1
      temperature: 0.1
      timeout: 300
    model_info:
      mode: chat
      description: "Alias padrão do Hermes: local primeiro"

  - model_name: hermes-vision
    litellm_params:
      model: ollama_chat/qwen2.5vl:3b
      api_base: os.environ/LITELLM_OLLAMA_URL
      keep_alive: 10m
      temperature: 0.15
      timeout: 240
    model_info:
      mode: chat
      supports_vision: true
      description: "Visão local: Qwen2.5 VL 3B"

  - model_name: hermes-embed
    litellm_params:
      model: ollama/nomic-embed-text:pinned-20260503
      api_base: os.environ/LITELLM_OLLAMA_URL
      timeout: 180
    model_info:
      mode: embedding
      description: "Embedding local pinned"

  - model_name: hermes-embed-latest
    litellm_params:
      model: ollama/nomic-embed-text:latest
      api_base: os.environ/LITELLM_OLLAMA_URL
      timeout: 180
    model_info:
      mode: embedding
      description: "Embedding local latest, backup manual"

  - model_name: hermes-cloud-cheap
    litellm_params:
      model: openrouter/deepseek/deepseek-v4-flash
      api_key: os.environ/OPENROUTER_API_KEY
      temperature: 0.15
      timeout: 360
      extra_headers:
        HTTP-Referer: "http://localhost"
        X-Title: "will-hermes-litellm"
    model_info:
      mode: chat
      description: "DeepSeek V4 Flash via OpenRouter"

  - model_name: hermes-cloud-pro
    litellm_params:
      model: openrouter/deepseek/deepseek-v4-pro
      api_key: os.environ/OPENROUTER_API_KEY
      temperature: 0.1
      timeout: 600
      extra_headers:
        HTTP-Referer: "http://localhost"
        X-Title: "will-hermes-litellm"
    model_info:
      mode: chat
      description: "DeepSeek V4 Pro via OpenRouter"

  - model_name: hermes-cloud-ui
    litellm_params:
      model: openrouter/moonshotai/kimi-k2.6
      api_key: os.environ/OPENROUTER_API_KEY
      temperature: 0.15
      timeout: 600
      extra_headers:
        HTTP-Referer: "http://localhost"
        X-Title: "will-hermes-litellm"
    model_info:
      mode: chat
      supports_vision: true
      description: "Kimi K2.6 via OpenRouter"

  - model_name: hermes-brain
    litellm_params:
      model: openrouter/deepseek/deepseek-v4-pro
      api_key: os.environ/OPENROUTER_API_KEY
      temperature: 0.1
      timeout: 600
      extra_headers:
        HTTP-Referer: "http://localhost"
        X-Title: "will-hermes-litellm"
    model_info:
      mode: chat
      description: "Alias forte para arquitetura, PRD e repo grande"

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY

litellm_settings:
  drop_params: true
  set_verbose: false
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

router_settings:
  routing_strategy: simple-shuffle
  num_retries: 1
  timeout: 600
  enable_pre_call_checks: true
  allowed_fails: 3
  cooldown_time: 30
```

Notas:

- Usar `ollama_chat` para chat Ollama.
- `api_base` deve apontar para o servidor Ollama, sem caminho `/v1`.
- No Docker, `LITELLM_OLLAMA_URL=http://host.docker.internal:11434`.
- OpenRouter usa `model: openrouter/<slug>`.
- Redis, cache e budgets devem entrar em patch separado depois do gateway estável.
