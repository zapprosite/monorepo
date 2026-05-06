# Docling Qdrant Pipeline

## Política canônica de embedding

- critical path de ingestão: `LLAMA_CPP_EMBED_URL=http://172.17.0.1:8002/v1`
- endpoint local equivalente: `http://127.0.0.1:8002/v1`
- modelo: `nomic-embed-text-v1.5.Q8_0.gguf`
- alias: `nomic-embed-cpu`
- dimensão obrigatória: `768`
- GPU para embedding: proibida
- Ollama para embedding: proibido
- LiteLLM para embedding: compatibilidade best-effort, não critical path

## Prefixos

- `search_document:` para chunks persistidos
- `search_query:` para consultas
- `classification:` para rotulagem
- `clustering:` para agrupamento

## Regra operacional

Docling, ingestão RAG e indexação Qdrant devem chamar `:8002` direto.
`hermes-embed` em `:4018` só entra como compatibilidade best-effort quando o teste de health passar.
