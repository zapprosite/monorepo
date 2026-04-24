# Rollback Plan - SPEC-121 Homelab Polish

## Backup Actual
- .env backup: /home/will/monorepo-env-20260423_170328.bak
- configs relevantes: /home/will/zappro-lite/config.yaml

## Se precisar reverter .env
```bash
cp /home/will/monorepo-env-20260423_170328.bak /srv/monorepo/.env
```

## Se LiteLLM parar de funcionar
```bash
docker restart zappro-litellm
```

## Se Qdrant deixar de responder
Verificar API key, restart se necessário:
```bash
docker restart qdrant
```

## Se mcp-memory falhar
```bash
docker restart mcp-memory
```

## Sintomas e soluções:
| Sintoma | Check | Solução |
|---------|-------|---------|
| Embeddings hang | curl /v1/embeddings | Restart LiteLLM |
| Qdrant 401 | API key errada | Verificar 71cae776... |
| Container sem rede | docker exec X ip route | Verificar network mode |
