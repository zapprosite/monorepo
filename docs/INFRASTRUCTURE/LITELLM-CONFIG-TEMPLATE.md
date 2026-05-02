# LiteLLM Proxy Configuration Template
# Generated: 2026-04-26
# For zappro-lite deployment

# ─────────────────────────────────────────────
# GENERAL SETTINGS
# ─────────────────────────────────────────────
general_settings:
  # Master key for all admin operations
  # Override via LITELLM_MASTER_KEY environment variable
  master_key: os.environ/LITELLM_MASTER_KEY

  # UI settings (optional)
  # ui_access_mode: "admin"  # uncomment to restrict UI access

# ─────────────────────────────────────────────
# LITELLM SETTINGS (module-level defaults)
# ─────────────────────────────────────────────
litellm_settings:
  # Drop unsupported parameters from requests
  drop_params: true

  # Enforce rate limits per model
  enforce_model_rate_limits: true

  # Retry configuration
  num_retries: 3
  request_timeout: 300
  stream_timeout: 300

  # Optional: Custom callback URLs
  # callbacks: ["http://your-callback-endpoint.com"]

# ─────────────────────────────────────────────
# MODEL LIST
# ─────────────────────────────────────────────
model_list:

  # ── TTS (Text-to-Speech) ───────────────────
  # Edge TTS — Microsoft neural voices (PT-BR)
  # OpenAI /v1/audio/speech compatible
  - model_name: tts-1
    litellm_params:
      model: openai/tts-1
      api_base: http://127.0.0.1:8012
      api_key: fake-key
      timeout: 60
      rpm: 30
      stream: false
    model_info:
      mode: audio_speech
      supports_vision: false

  # ── STT (Speech-to-Text) ───────────────────
  # Groq Whisper Turbo — Cloud API
  - model_name: whisper-1
    litellm_params:
      model: groq/whisper-large-v3-turbo
      api_key: os.environ/GROQ_API_KEY
      rpm: 30
    model_info:
      mode: audio_transcription
      supports_vision: false

  # ── STT FALLBACK (Local) ───────────────────
  # faster-whisper via local container
  - model_name: whisper-local
    litellm_params:
      model: openai/whisper-1
      api_base: http://host.docker.internal:8204
      api_key: fake-key
      timeout: 300
      rpm: 30
    model_info:
      mode: audio_transcription
      supports_vision: false

  # ── TEXT (Chat Completion) ─────────────────
  # MiniMax-M2.7 — Primary LLM
  - model_name: minimax-m2.7
    litellm_params:
      model: minimax/MiniMax-M2.7
      api_key: os.environ/MINIMAX_API_KEY
      api_base: os.environ/MINIMAX_API_BASE
      rpm: 30
      max_parallel_requests: 3
    model_info:
      mode: chat_complete
      supports_vision: false

  # ── VL (Vision-Language) — Primary ─────────
  # Qwen2.5-VL-3B via Ollama (GPU local)
  - model_name: qwen2.5vl-3b
    litellm_params:
      model: ollama/qwen2.5vl:3b
      api_base: http://host.docker.internal:11434
      rpm: 10
    model_info:
      mode: chat_complete
      supports_vision: true

  # ── VL FALLBACK (Cloud — no GPU) ───────────
  # Qwen3.5-Flash via OpenRouter
  - model_name: qwen3.5-vl
    litellm_params:
      model: openrouter/qwen/qwen3.5-flash-02-23
      api_key: os.environ/OPENROUTER_API_KEY
      rpm: 60
    model_info:
      mode: chat_complete
      supports_vision: true

  # ── VL FALLBACK #2 ─────────────────────────
  # Seed-2.0-Mini via OpenRouter
  - model_name: seed-vl-mini
    litellm_params:
      model: openrouter/bytedance-seed/seed-2.0-mini
      api_key: os.environ/OPENROUTER_API_KEY
      rpm: 60
    model_info:
      mode: chat_complete
      supports_vision: true

  # ── EMBEDDINGS ─────────────────────────────
  # Ollama — nomic-embed-text (local)
  - model_name: embedding-nomic
    litellm_params:
      model: ollama/nomic-embed-text
      api_base: http://host.docker.internal:11434
      api_key: fake-key
      rpm: 120
    model_info:
      mode: embedding

# ─────────────────────────────────────────────
# ROUTER SETTINGS
# ─────────────────────────────────────────────
router_settings:
  # Routing strategy
  routing_strategy: least-busy  # Options: simple-shuffle, least-busy, latency-based

  # Retry configuration
  num_retries: 3
  allowed_fails: 3
  cooldown_time: 30

  # Redis for distributed caching
  redis_host: zappro-redis
  redis_port: 6379
  redis_password: os.environ/REDIS_PASSWORD

# ─────────────────────────────────────────────
# ENVIRONMENT FILTERS (optional)
# ─────────────────────────────────────────────
# model_list:
#   - model_name: gpt-4o
#     litellm_params:
#       model: azure/gpt-4o
#       api_base: https://example.openai.azure.com
#       api_key: os.environ/AZURE_API_KEY
#     model_info:
#       supported_environments:
#         - production
#         - staging

# ─────────────────────────────────────────────
# NOTES
# ─────────────────────────────────────────────
# 1. api_base should NOT include paths — LiteLLM adds them automatically
#    WRONG: http://localhost:11434/v1/chat/completions
#    RIGHT: http://localhost:11434 (LiteLLM adds /v1/chat/completions)
#
# 2. For Docker networking, use host.docker.internal to reach host from container
#    OLLAMA_HOST=host.docker.internal:11434
#
# 3. OpenRouter does NOT need api_base — native LiteLLM support
#
# 4. Environment variables use os.environ/VAR_NAME syntax
#
# 5. Start proxy: litellm --config /path/to/config.yaml