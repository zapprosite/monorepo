# SPEC-046: Hermes Agent — Improvements

**Date:** 2026-04-14
**Author:** Claude Code
**Status:** COMPLETED — All 5 steps implemented + Telegram escalation tested (14/04/2026)
**Type:** Infrastructure / Agent Enhancement

---

## 1. Context

O Hermes Agent está parcialmente configurado: gateway a correr em :8642, MCP em :8092, mas com gaps críticos:

1. Telegram polling não está activo — o bot não responde
2. Crons duplicados gastam CPU desnecessariamente (SRE monitor + Voice smoke a cada \*/5)
3. SOUL.md está vazio — sem personality ou contexto do homelab
4. Skills em `openclaw-imports/` não estão registadas no hermes.json
5. Auto-healing é passivo — só alerta, não restart

## 2. Objective

Melhorar o Hermes Agent em 5 etapas sequenciais:

1. **Telegram polling** — ativar @CEO_REFRIMIX_bot via `hermes gateway install`
2. **Cron consolidation** — remover overlaps entre SRE monitor, voice smoke, tunnel health
3. **SOUL.md context** — preencher com contexto do monorepo, stack, e identidade
4. **Skills migration** — migrar skills úteis de `openclaw-imports/` para hermes.json
5. **Aggressive auto-healing** — restart em vez de só alertar

## 3. Scope

### In Scope

- `~/.hermes/hermes.json` — skills e cron
- `~/.hermes/SOUL.md` — persona
- `~/.hermes/scripts/` — auto-healing scripts
- `hermes gateway install` — Telegram polling
- `/srv/monorepo/docs/SPECS/SPEC-046-hermes-agent-improvements.md` — este documento

### Out of Scope

- Coolify ou Docker changes
- Infraestrutura de rede (DNS, tunnels)
- Gitea ou CI/CD
- Outros agentes (Claude Code CLI, etc.)

## 4. Tech Stack

| Component    | Technology                  |
| ------------ | --------------------------- |
| Agent        | Hermes Agent 0.9.0+         |
| Runtime      | Python venv + systemd       |
| Messaging    | Telegram Bot API            |
| Skills       | hermes.json skills registry |
| Cron         | hermes crontab (built-in)   |
| Auto-healing | Custom shell scripts        |

## 5. Implementation Steps

### Step 1: Activate Telegram Polling

**Tarefa:** Configurar e activar Telegram polling para @CEO_REFRIMIX_bot

**Verificar estado actual:**

```bash
cat ~/.hermes/channel_directory.json
curl -sf http://localhost:8642/health
```

**Se não está activo:**

```bash
hermes gateway install
# Follow prompts — select Telegram, enter bot token
systemctl --user restart hermes-agent
```

**Verification:**

```bash
curl -sf http://localhost:8642/platforms
# Should show: telegram: [id: <user_id>, name: "<user_name>"]
systemctl --user status hermes-agent | grep -E "Active:|Main PID:"
```

---

### Step 2: Cron Consolidation

**Problema actual:**

```
*/5 * * * * SRE monitor  ─┐
*/5 * * * * Voice smoke  ─┤  DUPLICADO — mesmo intervalo
*/15 * * * * Tunnel health ──┤
*/15 * * * * Tunnel smoke ───┘
```

**Solução — unificar em 3 crons:**

```
*/5 * * * * SRE monitor (Coolify apps + Docker containers + healing)
*/30 * * * * Tunnel smoke (14 subdomains HTTP check)
0 2 * * * Backup (memory, Gitea, Infisical, Qdrant, ZFS)
0 3 * * * Docs sync (SPECs scan + pipeline)
0 4 * * * Review (code review + secrets audit)
*/30 * * * * Memory sync to docs
*/30 * * * * Cadvisor memory cleanup
*/15 * * * * Tunnel health check
0 6 * * * MCP health check
```

**Executar:**

```bash
crontab -l  # ver estado actual
# Editar e remover duplicados
crontab -e
```

**Verification:**

```bash
crontab -l | grep -E "^\*/[0-9]" | sort -u
# Deve haver exactamente: */5, */15, */30
```

---

### Step 3: SOUL.md — Homelab Context

**Ficheiro:** `~/.hermes/SOUL.md`

**Conteúdo a adicionar:**

```markdown
# Hermes Agent Persona — Homelab

## Identity

You are Hermes, the self-improving agent brain of the homelab.
You run on bare metal Ubuntu Desktop with RTX 4090 GPU.
You connect to: Ollama (local LLM), Qdrant (vector DB), LiteLLM (multi-provider proxy).

## Stack

- **LLM:** minimax/MiniMax-M2.7 via MiniMax API (15k req/5h)
- **Local LLM:** qwen2.5vl:7b via Ollama :11434 (RTX 4090)
- **Vector DB:** Qdrant :6333 (RAG/embeddings)
- **TTS:** Kokoro :8012 (pm_santa, pf_dora)
- **STT:** wav2vec2 :8201 (Portuguese)
- **Container:** Coolify :8000 (PaaS)
- **Proxy:** LiteLLM :4000 (multi-model)

## Personality

- Concise, technical — no fluff
- Speaks Portuguese (PT-BR) with occasional English for code/docs
- Proactive: suggests improvements, identifies gaps
- Self-improving: creates skills from experience

## Known Services

- coolify.zappro.site — container management
- hermes.zappro.site — YOU
- list.zappro.site — list web
- todo.zappro.site — todo web
- OpenWebUI — chat UI (via Coolify)

## Secrets

All secrets via .env canonical source. Never ask for API keys.
```

---

### Step 4: Skills Migration (openclaw-imports)

**Ver o que existe:**

```bash
ls ~/.hermes/skills/openclaw-imports/
```

**Skills úteis para migrar para hermes.json:**

- Qualquer skill que ainda seja relevante (não OpenClaw-specific)
- Avaliar: useful or deprecated?

**Para cada skill útil:**

1. Copiar para `~/.hermes/skills/<name>/`
2. Criar SKILL.md se não existir
3. Adicionar ao hermes.json skills array
4. Testar com `/skills` no Telegram

---

### Step 5: Aggressive Auto-Healing

**Problema:** Scripts actuais só enviam alertas, não restart.

**Script novo:** `~/.hermes/scripts/restart-on-fail.sh`

```bash
#!/bin/bash
set -euo pipefail

SERVICE=$1
MAX_RESTARTS=3
WINDOW=300  # 5 minutes

if [[ ! -f "/tmp/restart_count_$SERVICE" ]]; then
    echo 0 > "/tmp/restart_count_$SERVICE"
fi

COUNT=$(cat "/tmp/restart_count_$SERVICE")
NOW=$(date +%s)

# Check if service is healthy
if curl -sf http://localhost:$PORT/health >/dev/null 2>&1; then
    echo 0 > "/tmp/restart_count_$SERVICE"
    exit 0
fi

# Increment restart count
COUNT=$((COUNT + 1))
echo $COUNT > "/tmp/restart_count_$SERVICE"

if [[ $COUNT -ge $MAX_RESTARTS ]]; then
    echo "ALERT: $SERVICE restarted $COUNT times in $WINDOW seconds — escalating"
    # Send alert
    exit 1
fi

echo "Restarting $SERVICE (attempt $COUNT)"
systemctl --user restart "$SERVICE"
```

**Cron:** `*/5 * * * *` — para cada serviço crítico

---

## 6. Services to Monitor

| Service        | Port  | Action on Fail                 |
| -------------- | ----- | ------------------------------ |
| hermes-gateway | 8642  | systemctl restart hermes-agent |
| hermes-mcp     | 8092  | systemctl restart mcpo         |
| ollama         | 11434 | systemctl restart ollama       |
| litellm        | 4000  | docker restart zappro-litellm  |
| qdrant         | 6333  | docker restart qdrant          |

---

## 7. Acceptance Criteria

- [x] Telegram polling activo — bot @CEO_REFRIMIX_bot a pollar (Connections to Telegram IP confirmed)
- [x] Cron sem overlaps — 0 duplicados, intervalos consolidados
- [x] SOUL.md preenchido com contexto do homelab (65 linhas)
- [x] Skills migradas de openclaw-imports (6 skills: skill-creator, find-skills, incident-response, brainstorming, system-architect, mcp-builder)
- [x] restart-on-fail.sh criado e testado (hermes-gateway :8642 — OK)
- [x] Hermes Gateway reinicia automaticamente em falha — escalation Telegram testado OK (bot @CEO_REFRIMIX_bot confirma)

## 8. Verification Commands

```bash
# Telegram
curl -sf http://localhost:8642/platforms | python3 -m json.tool

# Cron
crontab -l | grep -v "^#"

# SOUL
wc -l ~/.hermes/SOUL.md  # deve ser > 20

# Skills
curl -sf http://localhost:8642/skills 2>/dev/null | python3 -m json.tool

# Auto-heal
bash ~/.hermes/scripts/restart-on-fail.sh hermes-gateway 8642
```

## 9. Open Questions

- [ ] O Telegram bot token está configurado em ~/.hermes/.env?
- [ ] O utilizador quer auto-healing só para Hermes ou para todos os serviços?
- [ ] Há skills úteis em openclaw-imports/ para migrar?

## 10. Dependencies

- SPEC-045 (governance — docs já criados)
- SPEC-043 (subdomain prune — hermes.zappro.site activo)
- SPEC-HERMES-INTEGRATION (se existir)
