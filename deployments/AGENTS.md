# AGENTS.md — deployments

> 🦍 Leia: [CONTRACT.md](../homelab-context/CONTRACT.md) — Modo Gorila: direto, focado, token-efficient.

Stack de deploy do monorepo. Contém docker-compose files para todos os ambientes
(prod, staging, enterprise, test, local), serviços auxiliares (CRM, TTS, LiteLLM,
OpenWebUI, Trieve, Gitea Runner), configuração Keycloak, systemd units e monitoramento.
`.env` é symlink para `/srv/monorepo/.env`.
