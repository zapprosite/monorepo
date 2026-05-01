# SPEC-BATCH-FIX-2 — Polish & Hardening Sprint (2026-04-23)

## Objetivo
Aplicar TODAS as correções de polish e hardening identificadas pelo review de 15 agents.

## Issues Prioritárias

### 🔴 CRÍTICO (agora)

| # | Problema | Agente | Ação |
|---|----------|--------|------|
| 1 | `GATEWAY_ALLOW_ALL_USERS=true` | fix-telegram-security | Mudar pra false, set TELEGRAM_ALLOWED_USERS |
| 2 | hermes-gateway DEAD | fix-systemd-respawn | Mudar Restart=always, instalar cron restart-on-fail |
| 3 | MCP :4012-4015 expostos | fix-mcp-firewall | iptables: bloquear ext, permitir localhost |
| 4 | 3 containers restart:no | fix-container-restart | Adicionar restart:unless-stopped |
| 5 | Audio cache 88MB | fix-audio-cleanup | Implementar cleanup_audio_cache() |
| 6 | NETWORK_MAP.md falta | fix-docs-network | Criar NETWORK_MAP.md |

### 🟠 ALTO

| # | Problema | Agente | Ação |
|---|----------|--------|------|
| 7 | LiteLLM :4000 exposto | fix-litellm-network | Bind localhost ou enable Cloudflare Access |
| 8 | hermes ↔ litellm rede | fix-docker-network | Add litellm to aurelia-net |
| 9 | cron restart-on-fail | fix-cron-restart | Instalar cron entries |
| 10 | PORTS.md desatualizado | fix-ports-doc | Atualizar com ss -tlnp real |
| 11 | TTS_BRIDGE_URL :8013 | fix-voice-config | Corrigir pra :8012 |
| 12 | Redis backup cron | fix-backup-cron | Corrigir path script |
| 13 | Whisper PT only | fix-whisper-lang | Add language detection |

### 🟡 MÉDIO

| # | Problema | Agente | Ação |
|---|----------|--------|------|
| 14 | errors.log sem filtro | fix-logging | Filtrar só ERROR |
| 15 | bot.catch() no reply | fix-bot-error-handler | Adicionar ctx.reply() |
| 16 | No uncaughtException | fix-uncaught-handler | Adicionar handlers |
| 17 | Mixed EN/PT errors | fix-i18n-consistency | Corrigir line 337 |
| 18 | No per-user rate limit | fix-rate-limiting | Implementar throttle |

## Comportamento Esperado
- Cada agent resolve seu issue
- Commita com mensagem clara
- Push final pro origin

## Definição de Pronto
- [ ] GATEWAY_ALLOW_ALL_USERS=false + TELEGRAM_ALLOWED_USERS=7220607041
- [ ] hermes-gateway com Restart=always
- [ ] MCP firewall rule aplicada
- [ ] Containers com restart policy correta
- [ ] Audio cache cleanup implementado
- [ ] NETWORK_MAP.md criado
- [ ] LiteLLM não exposto
- [ ] Docker networks conectadas
- [ ] Cron restart-on-fail instalado
- [ ] PORTS.md atualizado
- [ ] TTS_BRIDGE_URL corrigido
- [ ] Whisper com language detection
- [ ] Logging com filtro
- [ ] Error handlers implementados
- [ ] Rate limiting por usuário
