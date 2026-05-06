# Daily Healthcheck

## Embedding stack

1. `systemctl is-active nomic-embed-cpu`
2. `curl http://127.0.0.1:8002/v1/models`
3. `curl http://127.0.0.1:8002/v1/embeddings` e validar `len=768`
4. `docker exec litellm-proxy` até `172.17.0.1:8002/v1/embeddings`
5. `curl http://127.0.0.1:4018/v1/embeddings` com `hermes-embed` como compatibilidade best-effort
6. se LiteLLM falhar e `:8002` passar: `WARN`, não incidente crítico
7. `nvidia-smi` não deve mostrar o PID do `nomic-embed-cpu` como compute
