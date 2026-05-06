# Qdrant Collections

## HVAC

- coleção principal: `hvac_manuals_v1`
- dimensão vetorial: `768`
- distância: `Cosine`
- origem canônica dos vetores: `nomic-embed-cpu` em `http://172.17.0.1:8002/v1`

## Política de gravação

- validar `len=768` antes de gravar
- usar `search_document:` na indexação
- usar `search_query:` nas buscas
- se LiteLLM embedding falhar, continuar com endpoint direto
