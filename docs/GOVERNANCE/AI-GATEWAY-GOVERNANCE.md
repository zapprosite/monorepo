# AI Gateway Governance

## Gateways

- chat/code canônico: `LiteLLM :4018`
- embedding canônico de produção: `llama.cpp :8002` direto
- `hermes-embed` em `LiteLLM` existe por compatibilidade best-effort
- `nexus-embed` é legado/deprecated

## Regras

- ingestão local não deve depender de `hermes-embed`
- `LLAMA_CPP_VISION_URL` deve permanecer vazio até existir serviço real de visão
- `:8081` é Dozzle, não vision
- `logs.zappro.site` é o subdomínio de observabilidade leve via Cloudflare Access
