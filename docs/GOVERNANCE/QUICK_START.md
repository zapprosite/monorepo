---
version: 1.0
author: will-zappro
date: 2026-03-16
---

# Governança IA — Guia de Início Rápido

**Primeira vez aqui?** Comece por este arquivo (5 minutos)

---

## 🏃 Em 60 Segundos

**Esta governança responde três perguntas:**

1. **Posso fazer isso?** → Verifique APPROVAL_MATRIX.md
2. **É perigoso?** → Verifique GUARDRAILS.md
3. **Como recupero se quebrar?** → Verifique RECOVERY.md

---

## 📖 Leia Primeiro (Ordem de Prioridade)

### Para usuários do Claude Code
1. `./CONTRACT.md` (5 min) — Princípios não-negociáveis
2. `./GUARDRAILS.md` (10 min) — O que é proibido
3. `./CHANGE_POLICY.md` (10 min) — Como mudar com segurança

### Para usuários do Codex
1. `~/.codex/rules/default.rules` (10 min) — Regras de decisão
2. `codex-host` (1 min) — Testar o wrapper
3. `./RUNBOOK.md` (5 min) — Comandos oficiais

### Para operações manuais
1. `./APPROVAL_MATRIX.md` (10 min) — Tabela Sim/Não/Perguntar
2. `./RUNBOOK.md` (10 min) — Comandos seguros
3. `./RECOVERY.md` (quando necessário) — Procedimentos de emergência

---

## 🛑 Nunca Faça Isso

```bash
# NEVER do these (period):
rm -rf /srv/data/postgres/*          # Production database
rm -rf /srv/backups/*                # Backup archives
wipefs -af /dev/nvme0n1              # Wipe data disk
zpool destroy tank                   # Destroy ZFS pool
docker compose down -v               # Delete persistent volumes
```

Veja GUARDRAILS.md para lista completa.

---

## ✅ Operações Seguras

```bash
# These don't need approval:
docker ps                            # Check services
docker logs servicename              # View logs
zpool status tank                    # Check disk health
/srv/ops/scripts/backup-*.sh         # Create backups
cd /srv/monorepo && pnpm dev         # Application development
cat ./*.md      # Read documentation
```

---

## ⚠️ Operações que Precisam de Aprovação

```bash
# Ask first before doing:
docker compose restart qdrant        # Restart service
zfs snapshot -r tank@name            # Snapshot pool
docker image prune -a                # Clean images
apt upgrade                          # System update
ufw allow 1234                       # Firewall rule
```

Veja APPROVAL_MATRIX.md para tabela de decisão.

---

## 🔄 Processo Padrão de Mudança

1. **Check:** Is this in APPROVAL_MATRIX.md "safe"? If yes → proceed
2. **If not:** Take snapshot first
   ```bash
   sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-change-name
   ```
3. **Ask:** For approval (if needed)
4. **Do:** Execute the change
5. **Verify:** Did it work?
   ```bash
   docker ps
   curl http://localhost:6333/health
   ```
6. **Log:** What changed and outcome

---

## 🚨 Se Algo Quebrar

1. **Stop.** Don't make more changes.
2. **Check:** RECOVERY.md for your scenario
3. **Rollback:**
   ```bash
   sudo zfs rollback -r tank@pre-TIMESTAMP-change-name
   docker compose -f /srv/apps/platform/docker-compose.yml up -d
   ```
4. **Verify:** Services are running
5. **Report:** File incident in INCIDENTS.md

---

## 📋 Arquivos para Ter Abertos

Mantenha estes nos favoritos:
- **Referência rápida:** APPROVAL_MATRIX.md (sim/não/perguntar)
- **Leia primeiro:** GUARDRAILS.md (operações proibidas)
- **Quando travado:** RUNBOOK.md (comandos oficiais)
- **Quando quebrado:** RECOVERY.md (passos de emergência)

---

## 🎯 Tarefas Comuns

### Antes de Mudança de Infraestrutura
```
1. Leia: CONTRACT.md (2 min)
2. Verifique: GUARDRAILS.md para sua operação
3. Verifique: APPROVAL_MATRIX.md (seguro/aprovação/proibido)
4. Tire: Snapshot se for estrutural
5. Execute: A mudança
6. Verifique: Serviços ainda rodando
```

### Antes de Deletar Qualquer Coisa
```
1. Pergunte: "Está em /srv/data ou /srv/backups?"
2. Se sim: Leia GUARDRAILS.md (provavelmente proibido)
3. Se não: Tire snapshot primeiro
4. Confirme: O que exatamente será deletado?
5. Execute: Delete
```

### Quando Serviço Está Fora
```
1. Verifique: docker ps (rodando?)
2. Verifique: docker logs [serviço] (erros?)
3. Tente: docker compose restart [serviço]
4. Se ainda fora: Verifique RECOVERY.md
5. Se travado: Rollback para snapshot pré-mudança
```

---

## 📞 Precisa de Ajuda?

| Pergunta | Resposta | Arquivo |
|----------|---------|---------|
| Posso fazer X? | Verifique esta tabela | APPROVAL_MATRIX.md |
| X é proibido? | Lista de proibidos | GUARDRAILS.md |
| Como mudar X? | Processo | CHANGE_POLICY.md |
| Quais são os comandos? | Lista oficial | RUNBOOK.md |
| Como recupero de X? | Procedimentos | RECOVERY.md |
| Qual é a arquitetura? | Detalhes completos | PARTITIONS.md |
| Quais serviços estão rodando? | Status + deps | SERVICE_MAP.md |

---

## ✨ Lembre-se

- **Snapshot antes de mudanças estruturais** (habilita rollback)
- **Pergunte antes de deletar** (sem desfazer sem backup)
- **Verifique APPROVAL_MATRIX** (decisões claras sim/não)
- **Leia RECOVERY.md** (quando coisas quebram)
- **Registre suas ações** (para rastreamento de incidentes)

---

## 🖥️ Estado Atual (2026-03-17)

**22 containers ativos** em 4 stacks:
- **Plataforma:** Qdrant :6333, n8n :5678, n8n-postgres
- **Supabase:** 13 containers — kong :8000, studio :54323, pooler :5433/:6543
- **CapRover:** nginx :80/:443, captain :3000
- **Voz (GPU):** voice-proxy :8010 (STT) + :8011 (TTS), speaches, chatterbox-tts

**Ollama (systemd):** qwen3.5 + bge-m3 em :11434

**Conectividade:** Tailscale (100.83.45.79) + Cloudflare Tunnel (cloudflared.service)

```bash
# Saúde rápida de todos os stacks
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader
curl -s http://localhost:8010/health && curl -s http://localhost:8011/ && echo "voice ✓"
curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; m=json.load(sys.stdin); print('ollama:', [x['name'] for x in m.get('models',[])])"
tailscale status
```

**Arquitetura:** `~/Desktop/SYSTEM_ARCHITECTURE.md`
**Guia de voz:** `~/Desktop/guide-audio-tts-stt.md`

---

**Pronto.** Para mais detalhes, veja a governança completa em ./

Gerado: 2026-03-16 | Atualizado: 2026-03-17
