# 🚀 Guia Operacional - will-zappro Homelab

**Versão:** 2026-04-08
**Host:** will-zappro (Ubuntu 24.04 LTS)
**Governança:** `docs/GOVERNANCE/`
**Status:** ✅ Produção estável

---

## 1. Visão Geral do Sistema

Este é um homelab de single-user com:
- **CPU/RAM:** AMD Ryzen 9 7900X 12c/24t · 32 GB DDR5
- **GPU:** RTX 4090 — 24 GB VRAM · CUDA 13 · LLM + STT + TTS local
- **Armazenamento:** ZFS pool "tank" (nvme0n1 Crucial Gen5 3.64 TB)
- **SO:** Ubuntu 24.04.4 LTS Desktop (Xorg/GNOME)
- **Acesso remoto:** Tailscale (100.83.45.79) + Cloudflare Tunnel
- **Containers:** 22 ativos (plataforma + supabase + caprover + voz)
- **Monorepo:** pnpm workspace em /srv/monorepo

```
will-zappro — Ubuntu 24.04 Desktop

PLATAFORMA                     SUPABASE              CAPROVER
├── Qdrant     :6333/6334       ├── kong    :8000     ├── nginx  :80/:443
├── n8n        :5678            ├── studio  :54323    └── captain :3000
└── n8n-postgres (interna)      ├── pooler  :5433
                                └── +10 containers internos

VOZ (GPU — RTX 4090)
├── voice-proxy :8010 → speaches     (STT Whisper large-v3, ~4 GB VRAM)
└── voice-proxy :8011 → chatterbox   (TTS ResembleAI, ~5 GB VRAM)

OLLAMA (systemd) :11434
├── qwen3.5 — 9.65B Q4_K_M, 262K ctx, vision+tools+thinking (~6.5 GB VRAM)
└── bge-m3  — 566M F16, 1024-dim embeddings (~1.2 GB VRAM)

Monorepo      /srv/monorepo       ← Desenvolvimento de apps
```

**Tudo em /srv = ZFS-backed = sobrevive reinstalação do OS**

**Arquitetura completa:** `~/Desktop/SYSTEM_ARCHITECTURE.md`
**Mapa de serviços:** `docs/GOVERNANCE/SERVICE_MAP.md`

---

## 2. Ferramentas: Como Usar

### 2.1 Claude Code

**Quando usar:** Desenvolvimento, testes, exploração de código

**O que Claude sabe:**
- Ler a maioria dos arquivos
- Propor mudanças em código
- Explicar problemas
- Debugar servos
- **Só isso:** não executa comandos perigosos automaticamente

**Como começar:**
```bash
# Abrir o host
claude-code

# No prompt, você pode:
# "entenda a estrutura do /srv/monorepo"
# "qual é a diferença entre apps/api e apps/worker-ai?"
# "faça um refactor em packages/shared"
# "me ajude a debugar esse erro de TypeScript"
```

**Importante:**
- Claude vai lembrar `/etc/claude-code/CLAUDE.md`
- Se tocar em `/srv/data`, ele pedirá confirmação
- Se for mudança estrutural, ele vai sugerir snapshot
- **Não confie apenas em sugestões:** use GUARDRAILS.md como referência

**Limitações:**
- Não carrega ~/.claude/rules automaticamente (você adiciona via /remember)
- Não tem webhooks para bloquear ops perigosas
- Enforcement é via contexto, não hardware

---

### 2.2 Codex CLI

**Quando usar:** Tarefas administrativas, infraestrutura, automação

**Dois modos:**

#### Modo Development
```bash
codex "implement new API endpoint"
codex "debug database issue"
```
- Livre em /srv/monorepo
- Pode rodar testes
- Pode usar Docker para dev

#### Modo Host Governance
```bash
codex-host "snapshot tank pool before change"
codex-host "check qdrant health"
codex-host "restore from snapshot tank@pre-20260316"
```
- Usa regras de governança obrigatoriamente
- Bloqueia operações proibidas ANTES de executar
- Registra todas as ações em log
- Pede confirmação para PROMPT ops

**Diferença crítica:**
```
codex        → dev-friendly, governança soft (via contexto)
codex-host   → infra-strict, governança hard (via rules engine)
```

**Como usar para operações:**
```bash
# Seguro (vai executar logo):
codex-host "what services are running?"
codex-host "show me zpool status"
codex-host "cat /srv/ops/ai-governance/QUICK_START.md"

# Vai pedir aprovação:
codex-host "stop qdrant for maintenance"
codex-host "snapshot tank before testing"
codex-host "restart n8n"

# Vai RECUSAR:
codex-host "rm -rf /srv/data"
codex-host "zpool destroy tank"
codex-host "wipefs /dev/nvme0n1"
```

**Rules estão em:** `~/.codex/rules/default.rules` (auto-loaded)
**Skills estão em:** `~/.codex/skills/canonical` → `/srv/ops/ai-governance/skills/`

**Skills Monitoring (INC-003):**
- `monitoring-health-check.md` — health check da stack Grafana+Prometheus
- `monitoring-diagnostic.md` — diagnóstico step-by-step de falhas
- `monitoring-zfs-snapshot.md` — snapshot ZFS antes de changes

**Skills AI Stack:**
- `ollama-health-check.md` — Ollama + VRAM
- `litellm-health-check.md` — LiteLLM proxy
- `kokoro-health-check.md` — Kokoro TTS

---

### 2.3 Coolify + GitOps (Deploy Automatizado)

**Quando usar:** Deploy de apps via Gitea Actions → Coolify API

**Arquitetura:**
```
Gitea (git push) → Gitea Action → Coolify API → Container
                                      └── Cloudflare Tunnel → web.zappro.site
```

**Skills disponíveis (em `/home/will/.claude/skills/`):**

| Skill | Uso |
|-------|-----|
| `coolify-deploy-trigger/` | Trigger deploy manual |
| `coolify-auto-healer/` | Monitora e restart se down (cron 5min) |
| `coolify-health-check/` | Verifica health após deploy |
| `coolify-resource-monitor/` | Alerta se CPU/mem > 80% (cron 15min) |
| `coolify-incident-diagnostics/` | Diagnostica erros e sugere fixes |
| `coolify-rollback/` | Rollback para versão anterior |

**Uso com Claude Code CLI:**
```bash
# Trigger deploy
claude -p "Deploy perplexity-agent via Coolify"

# Health check
claude -p "Run health check on web.zappro.site"

# Auto-healer (já roda em cron)
# Verificar status
claude -p "List all Coolify apps with resource usage"
```

**Scripts de automação (em `/home/will/.claude/skills/gitea-coolify-deploy/scripts/`):**

| Script | Função |
|--------|--------|
| `deploy.sh` | Deploy via Coolify API (SSRF protected) |
| `smoke-test.sh` | Health check HTTP 200 pós-deploy |
| `auto-healer.sh` | Restart containers degraded/down (cron 5min) |
| `resource-monitor.sh` | CPU >70%, Memory >80% alerts (cron 15min) |

**Secrets configurados (Infisical):**
- ✅ `COOLIFY_API_KEY` adicionado
- ✅ `COOLIFY_URL` disponível
- ✅ `OPENROUTER_API_KEY` disponível

### 2.4 GitHub Copilot (Opcional)

**Quando usar:** Coding no GitHub editor ou CLI

**Como funciona:**
- Lê `.github/copilot-instructions.md` automaticamente
- Oferece completions para código
- Não é obrigado, mas pode ajudar

**No seu monorepo:**
```bash
# Abrir no GitHub web editor
gh repo view --web /srv/monorepo
```

**Limitações:** Só funciona no GitHub, não em IDEs locais

---

## 3. Operações Comuns (Seguras)

### 3.1 Verificar Status

```bash
# Serviços rodando
docker ps
docker compose -f /srv/apps/platform/docker-compose.yml ps

# Health check Qdrant
curl http://localhost:6333/health

# Health check n8n
curl http://localhost:5678/api/v1/health

# PostgreSQL está respondendo
docker exec n8n-postgres pg_isready -U n8n

# ZFS pool saudável
zpool status tank

# Espaço em disco
df -h /srv

# Logs recentes
docker logs qdrant | tail -20
docker logs n8n | tail -20
docker logs n8n-postgres | tail -20
```

### 3.2 Fazer Backup (Seguro, importante!)

```bash
# Backup manual (sem parar serviço)
/srv/ops/scripts/backup-postgres.sh    # PostgreSQL
/srv/ops/scripts/backup-qdrant.sh      # Qdrant
/srv/ops/scripts/backup-n8n.sh         # n8n

# Verificar backups
ls -lh /srv/backups/

# Snapshots ZFS (ligeiros, rápidos)
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)
```

**Frequência recomendada:**
- Backup: antes de mudanças estruturais, diariamente automático
- Snapshot: antes de qualquer ZFS operation, antes de upgrade de software

### 3.3 Inspecionar Logs

```bash
# Qdrant
docker logs -f qdrant          # follow logs
docker logs qdrant | tail -50  # últimas 50 linhas

# n8n
docker logs n8n --tail 100

# PostgreSQL
docker logs n8n-postgres

# Host geral
journalctl -xe                 # últimos erros do sistema
```

### 3.4 Código & Monorepo

```bash
# Navegar
cd /srv/monorepo

# Instalar deps
pnpm install

# Desenvolvimento
pnpm dev

# Build
pnpm build

# Lint
pnpm lint

# Git
git status
git log --oneline -10
git diff
git commit -m "message"
```

---

## 4. Operações com Aprovação (Governance)

Estas requerem confirmação. Use `codex-host`:

### 4.1 Reiniciar Serviço

```bash
codex-host "restart qdrant"
```

Vai pedir:
- [ ] Qual serviço
- [ ] Quanto tempo vai ficar down
- [ ] O que pode quebrar
- [ ] Confirmação YES/NO

**Procedimento manual (se Codex não estiver disponível):**
```bash
# Preflight
docker ps | grep qdrant        # qdrant tá rodando?
docker ps | grep n8n           # n8n depende de Qdrant?

# Ação
docker compose -f /srv/apps/platform/docker-compose.yml stop qdrant
# wait 10 seconds
docker compose -f /srv/apps/platform/docker-compose.yml up -d qdrant

# Validação
curl http://localhost:6333/health
```

### 4.2 Snapshot antes de Mudança

```bash
codex-host "snapshot tank before updating Docker"
```

**Procedimento manual:**
```bash
# Criar snapshot
sudo zfs snapshot -r tank@pre-docker-upgrade-20260316

# Verificar
zfs list -t snapshot

# Se preciso rollback depois
sudo zfs rollback -r tank@pre-docker-upgrade-20260316
```

### 4.3 Upgrade de Pacote

```bash
# NÃO faça sem cuidado
apt update     # isso é seguro
apt upgrade    # isso requer snapshot + aprovação
```

**Procedimento seguro:**
```bash
# 1. Snapshot
sudo zfs snapshot -r tank@pre-apt-upgrade

# 2. Upgrade
sudo apt upgrade

# 3. Verificar
docker ps
docker compose -f /srv/apps/platform/docker-compose.yml ps
curl http://localhost:6333/health

# 4. Se quebrou: rollback
sudo zfs rollback -r tank@pre-apt-upgrade
reboot
```

---

## 5. Recovery & Rollback (Quando Tudo Quebra)

### 5.1 Serviço Parou Inesperadamente

```bash
# Diagnóstico
docker ps          # qdrant não aparece?
docker logs qdrant # qual é o erro?

# Recovery rápido
docker restart qdrant
curl http://localhost:6333/health

# Se não voltar
docker-compose -f /srv/apps/platform/docker-compose.yml up -d qdrant
```

**Se erro persiste:**
- Leia docs/GOVERNANCE/RECOVERY.md (passo a passo)
- Procure pelo serviço específico em docs/GOVERNANCE/RECOVERY.md
- Siga a procedure de restore

### 5.2 Disco Cheio

```bash
# Verificar
df -h /srv

# Limpeza segura
docker system prune -a --volumes   # CUIDADO: remove imagens/volumes não usados

# Mais agressivo (só se necessário)
docker image prune -a
```

### 5.3 ZFS Pool Corrompido

```bash
# Verificar pool
zpool status tank

# Se degradado mas online
zpool scrub tank
zpool status tank  # aguarde

# Se importação quebrou
zpool import tank

# Se muito quebrado
# → Ver docs/GOVERNANCE/RECOVERY.md seção "ZFS Pool Recovery"
```

### 5.4 PostgreSQL Não Sobe

```bash
# Lê logs
docker logs n8n-postgres

# Restart
docker restart n8n-postgres
docker logs n8n-postgres

# Se não voltar
# → Restore from backup: docs/GOVERNANCE/RECOVERY.md
```

### 5.5 Restaurar de Snapshot

```bash
# Listar snapshots
zfs list -t snapshot

# Escolher o bom (ex: tank@pre-20260316)
sudo zfs rollback -r tank@pre-20260316

# Rebootar para ter certeza
reboot

# Verificar
docker ps
curl http://localhost:6333/health
```

**⚠️ AVISO:** Rollback apaga todas as mudanças DEPOIS do snapshot. Use como último recurso.

---

## 6. Troubleshooting Específico

### "Qdrant não responde"

```bash
# 1. Está rodando?
docker ps | grep qdrant

# 2. Logs
docker logs qdrant | tail -50

# 3. Health
curl -v http://localhost:6333/health

# 4. Porta bloqueada?
ss -tulpn | grep 6333

# 5. Espaço em disco
df -h /srv/data/qdrant

# 6. Recovery
docker restart qdrant
curl http://localhost:6333/health

# 7. Se ainda não vai
sudo zfs rollback tank/qdrant@<snapshot-anterior>
docker restart qdrant
```

### "n8n travou / workflows não rodando"

```bash
# 1. Status
docker ps | grep n8n
docker logs n8n | tail -50

# 2. PostgreSQL está ok?
docker exec n8n-postgres pg_isready -U n8n

# 3. Restart n8n
docker restart n8n

# 4. Aguarde 30s, tente health
curl http://localhost:5678/api/v1/health

# 5. Se DB corrompeu
# → docs/GOVERNANCE/RECOVERY.md → "PostgreSQL Recovery"
```

### "Disco cheio, nada funciona"

```bash
# 1. Verificar o quê está grande
du -sh /srv/*
du -sh /srv/docker-data/*

# 2. Limpar containers/imagens
docker system prune -a --volumes

# 3. Se ainda cheio, revisar /srv/backups
ls -lh /srv/backups/
# Remover backups antigos manualmente

# 4. Última opção: snapshot e rollback
sudo zfs list -t snapshot
sudo zfs rollback -r tank@<anterior>
```

### "Não consigo fazer git push"

```bash
# 1. SSH funcionando?
ssh -T git@github.com

# 2. Credencial expirou?
git config user.name
git config user.email

# 3. Tentar push de novo
git push
```

---

## 7. Checklist de Estabilidade Mensal

Rode isto todo mês para garantir saúde:

```bash
# 1. Health geral (2 min)
docker ps
docker compose -f /srv/apps/platform/docker-compose.yml ps
curl http://localhost:6333/health
curl http://localhost:5678/api/v1/health
docker exec n8n-postgres pg_isready -U n8n

# 2. ZFS (1 min)
zpool status tank
zfs list | grep tank

# 3. Discos (1 min)
df -h /srv
du -sh /srv/docker-data /srv/data/* /srv/backups

# 4. Backups funcionando (5 min)
ls -lh /srv/backups/*.sql.gz       # tem backup PostgreSQL recente?
ls -lh /srv/backups/*.tar.gz       # tem backup Qdrant/n8n?

# 5. Snapshots estão criados (1 min)
zfs list -t snapshot

# 6. Logs limpos de erros (2 min)
docker logs qdrant 2>&1 | grep -i error | tail -5
docker logs n8n 2>&1 | grep -i error | tail -5

# 7. Se algo parece ruim: registre em INCIDENTS.md
# docs/GOVERNANCE/INCIDENTS.md
```

**Se tudo passou:** ✅ Sistema saudável
**Se algo falhou:** Procure a seção relevante em docs/GOVERNANCE/RECOVERY.md

---

## 8. Contatos Rápidos (Arquivos Críticos)

**Governança (leia em caso de dúvida):**
- `docs/GOVERNANCE/QUICK_START.md` - 5 min overview
- `docs/GOVERNANCE/GUARDRAILS.md` - O que é proibido
- `docs/GOVERNANCE/CHANGE_POLICY.md` - Como fazer mudança segura
- `docs/GOVERNANCE/APPROVAL_MATRIX.md` - Tabela de sim/não/ask
- `docs/GOVERNANCE/RECOVERY.md` - Recovery procedures

**Operacional:**
- `docs/GOVERNANCE/SERVICE_MAP.md` - O que temos rodando
- `docs/GOVERNANCE/RUNBOOK.md` - Comandos oficiais
- `docs/INFRASTRUCTURE/PORTS.md` - Alocações de porta

**Histórico (mantenha atualizado):**
- `~/Desktop/SYSTEM_ARCHITECTURE.md` - Seu journal operacional
- `docs/GOVERNANCE/INCIDENTS.md` - Log de issues passados
- `docs/INCIDENTS/` - Incident reports (INCIDENT-2026-04-08-*.md)

---

## 9. Padrão de Operação Segura

**Sempre que fizer mudança:**

```
1. PLANEJAMENTO
   ├─ O que vai mudar?
   ├─ Qual é o risco?
   ├─ Como rollback?
   └─ Quanto tempo vai levar?

2. PRÉVIA
   ├─ Snapshot: sudo zfs snapshot -r tank@pre-change
   ├─ Backup: /srv/ops/scripts/backup-*.sh
   └─ Registro: anote em CHANGE_POLICY.md

3. EXECUÇÃO
   ├─ Faça a mudança
   ├─ Passo a passo (não tudo de uma vez)
   └─ Registre no log

4. VALIDAÇÃO
   ├─ Serviços rodando? docker ps
   ├─ Health checks passam? curl http://localhost:*
   ├─ Logs limpos de erro? docker logs [service]
   └─ Dados intactos? ls -la /srv/data

5. DOCUMENTAÇÃO
   ├─ Atualize ~/Desktop/SYSTEM_ARCHITECTURE.md
   ├─ Registre em docs/GOVERNANCE/INCIDENTS.md se mudança
   └─ Commit no git se código modificado
```

---

## 10. Hábitos de Saúde

- **Backup semanal:** Cron jobs estão em `/srv/ops/scripts/`
- **Snapshots regulares:** Antes de QUALQUER mudança estrutural
- **Logs monitorados:** Revise erros em docker logs mensalmente
- **Discos monitorados:** `df -h` rotineiramente, nunca deixe <10% livre
- **Rollback testado:** Pratique restore de snapshot a cada 3 meses
- **Documentação viva:** Atualize SYSTEM_ARCHITECTURE.md regularmente

---

## 11. OPERATIONS SKILLS

Automated operational skills for monitoring, diagnosis, and self-healing.

### Skills Directory

All skills are in: `docs/OPERATIONS/SKILLS/`

**Index:** [SKILLS/README.md](../OPERATIONS/SKILLS/README.md)

### Quick Reference

| Command | Purpose |
|---------|---------|
| `bash docs/OPERATIONS/SKILLS/verify-network.sh` | Check container network isolation |
| `bash docs/OPERATIONS/SKILLS/container-health-check.sh` | Detailed container status |
| `bash docs/OPERATIONS/SKILLS/self-healing.sh` | Auto-restart failing containers |
| `bash docs/OPERATIONS/SKILLS/deploy-validator.sh` | Full pre-deploy validation |

### Daily Health Check

```bash
# Run container + network check
bash docs/OPERATIONS/SKILLS/container-health-check.sh
bash docs/OPERATIONS/SKILLS/verify-network.sh

# Watch self-healing logs
tail -f /srv/ops/logs/self-healing.log
```

### Incident Response

See [incident-runbook.md](../OPERATIONS/SKILLS/incident-runbook.md) for systematic triage.

### Skill Categories

| Category | Skills |
|----------|--------|
| **Diagnostic** | traefik-health-check, traefik-route-tester, verify-network, container-health-check, litellm-health-check, wav2vec2-health-check |
| **Deploy** | deploy-validator |
| **Monitoring** | self-healing-cron, container-health-check, liteLLM-usage |
| **Incident** | incident-runbook |

### Cron Jobs (if installed)

```cron
*/5 * * * * /srv/monorepo/docs/OPERATIONS/SKILLS/self-healing.sh >> /srv/ops/logs/self-healing-cron.log 2>&1
*/5 * * * * /srv/monorepo/docs/OPERATIONS/SKILLS/container-health-check.sh --json >> /srv/ops/logs/container-health.log 2>&1
```

---

## 12. Próximas Ações Recomendadas

- [ ] Leia QUICK_START.md (5 min)
- [ ] Teste `codex-host "check qdrant health"` (2 min)
- [ ] Rode checklist mensal acima (15 min)
- [ ] Pratique rollback em snapshot de teste (10 min)
- [ ] Atualize ~/Desktop/SYSTEM_ARCHITECTURE.md com skill (5 min)

---

**Última atualização:** 2026-04-08
**Manutentor:** will (você)
**Suporte:** Veja docs/GOVERNANCE/QUICK_START.md ou docs/GOVERNANCE/GUARDRAILS.md
**Incidentes:** Ver `docs/INCIDENTS/INCIDENT-2026-04-08-perplexity-gitops-gap.md`
