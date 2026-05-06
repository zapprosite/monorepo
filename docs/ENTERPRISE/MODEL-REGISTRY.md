# Model Registry

## Runtime principal

- text/code: `qwen3.6-27b-code` via `llama.cpp` em `:8001`
- embedding: `nomic-embed-cpu` via `llama.cpp` em `:8002`

## Embedding policy

- endpoint canônico: `LLAMA_CPP_EMBED_URL=http://172.17.0.1:8002/v1`
- modelo preferido: `nomic-embed-text-v1.5.Q8_0.gguf`
- dimensão: `768`
- GPU: proibida
- Ollama: proibido no caminho canônico
- LiteLLM `hermes-embed`: compatibilidade best-effort
- LiteLLM `nexus-embed`: legado/deprecated
