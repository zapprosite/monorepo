# CLI Integration — nexus + vibe-kit

**Versao:** 1.0.0
**Data:** 2026-04-30
**Status:** Ativo

---

## 1. Overview

Este documento descreve a integracao entre as CLIs do monorepo (`mclaude`, `nexus.sh`, `vibe-kit.sh`) e o framework nexus/vibe-kit para orquestracao de agentes em paralelo.

### O que e integrado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLI INTEGRATION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   mclaude                     nexus.sh                    vibe-kit.sh      │
│  ┌────────┐                  ┌─────────┐                 ┌──────────┐       │
│  │ Headless │ ─────────────▶ │ Orchest │ ──────────────▶ │  Runtime  │       │
│  │ Worker  │                  │  rates  │                  │ (15 workers) │
│  └────────┘                  └─────────┘                 └──────────┘       │
│       │                            │                          │             │
│       │                            ▼                          ▼             │
│       │                     ┌─────────────┐            ┌─────────────┐      │
│       └────────────────────▶│  queue.json │◀───────────┤   agents    │      │
│         (task prompt)        └─────────────┘            └─────────────┘      │
│                                        │                                     │
│                                        ▼                                     │
│                               ┌─────────────────┐                           │
│                               │   state.json    │                           │
│                               │ (phase, counters)│                           │
│                               └─────────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Funcao de cada CLI

| CLI | Funcao | Tipo |
|-----|--------|------|
| `mclaude` | Worker headless que executa tarefas via Claude Code | Executor |
| `nexus.sh` | Orquestrador PREVC — coordena workflow, transicoes de fase | Orchestrator |
| `vibe-kit.sh` | Runtime runner — gerencia workers paralelos, polling da queue | Runtime |

### Fluxo de integracao

1. `nexus.sh --phase plan` — Cria `queue.json` a partir do SPEC.md
2. `nexus.sh --phase review` — Aprova/cancela gate humano
3. `nexus.sh --phase execute` — Dispara `vibe-kit.sh` com VIBE_PARALLEL workers
4. `vibe-kit.sh` — Executa N workers `mclaude -p` em paralelo
5. Cada worker consome tarefas da `queue.json` e atualiza status

---

## 2. Setup

### 2.1 Variaveis de ambiente

Configure no ambiente antes de executar qualquer CLI:

```bash
# Diretorios (ja configurados via cron)
export VIBE_DIR=/srv/monorepo/.claude/vibe-kit
export MONOREPO_DIR=/srv/monorepo

# Parallelismo (default: 15)
export VIBE_PARALLEL=15

# Limites de tempo
export VIBE_HOURS=8           # Tempo maximo de execucao
export VIBE_POLL_INTERVAL=5  # Intervalo de polling (segundos)

# Snapshot automatico
export VIBE_SNAPSHOT_EVERY=3 # ZFS snapshot a cada N tarefas

# Rate limiting
export NEXUS_RPM=500         # Requests por minuto
```

### 2.2 Verificacao de dependencias

```bash
# Verificar estrutura de diretorios
ls -la /srv/monorepo/.claude/vibe-kit/

# Verificar lock file (nao deve existir se nao ha runner ativo)
cat /srv/monorepo/.claude/vibe-kit/.vibe-kit.lock 2>/dev/null || echo "OK: sem lock"

# Verificar Redis (task queue)
redis-cli ping

# Verificar Qdrant (embeddings)
curl -s localhost:6333/collections | jq '.result | length'

# Verificar ZFS snapshots
zfs list tank -t snapshot -r | grep nexus | tail -5
```

### 2.3 Configuracao do mclaude para nexus

O `mclaude` e o worker headless usado pelo vibe-kit. Para configurar:

```bash
# Verificar instalacao
which mclaude
mclaude --version

# Verificar providers configurados
ls ~/.multi-claude/config.json

# Configurar provider padrao para nexus (opcional)
mclaude --provider minimax --model MiniMax-M2.7 -p "test"
```

### 2.4 Permissoes necessarias

```bash
# Usuario deve ter acesso a:
# - /srv/monorepo (leitura/escrita)
# - /srv/monorepo/.claude/vibe-kit/ (leitura/escrita)
# - Redis localhost:6379
# - ZFS tank pool
# - mclaude (bun install -g)

groups  # Deve incluir grupo com acesso a /srv/monorepo
```

---

## 3. Usage

### 3.1 Iniciar workflow via nexus

```bash
# Navigate to monorepo
cd /srv/monorepo

# Phase 1: Plan — cria queue.json a partir do SPEC.md
nexus.sh --spec SPEC-XXX --phase plan

# Phase 2: Review — gate humano para aprovar execucao
nexus.sh --spec SPEC-XXX --phase review

# Phase 3: Execute — inicia workers em paralelo
nexus.sh --spec SPEC-XXX --phase execute

# Phase 4: Verify — executa suite de testes
nexus.sh --spec SPEC-XXX --phase verify

# Phase 5: Complete — deploy + docs + PR
nexus.sh --spec SPEC-XXX --phase complete
```

### 3.2 Executar vibe-kit diretamente

Para executar sem o workflow PREVC completo:

```bash
# Executar com parallelismo padrao (15 workers)
VIBE_DIR=/srv/monorepo/.claude/vibe-kit \
VIBE_PARALLEL=15 \
bash .claude/vibe-kit/vibe-kit.sh

# Executar com paralelo customizado
VIBE_PARALLEL=8 \
VIBE_POLL_INTERVAL=10 \
bash .claude/vibe-kit/vibe-kit.sh

# Dry-run (nao executa workers)
VIBE_DRY_RUN=1 \
bash .claude/vibe-kit/vibe-kit.sh
```

### 3.3 Executar worker unico mclaude

```bash
# Worker unico com provider minimax
mclaude --provider minimax --model MiniMax-M2.7 -p "Implement authentication module"

# Worker com provider ollama (local)
mclaude --provider ollama --model qwen2.5 -p "Review this PR"

# Worker com timeout customizado
timeout 300 mclaude --provider minimax --model MiniMax-M2.7 -p "Task..."

# Ver logs do worker
tail -f .claude/vibe-kit/logs/workers/worker-01.log
```

### 3.4 Gerenciar workers ativos

```bash
# Ver workers ativos
ps aux | grep "mclaude -p" | grep -v grep

# Ver lock file (PID do runner ativo)
cat .claude/vibe-kit/.vibe-kit.lock

# Forcar parada (cuidado: pode deixar tasks orfaas)
pkill -f "mclaude -p"
rm -f .claude/vibe-kit/.vibe-kit.lock

# Ver tasks pendentes
jq '.stats' .claude/vibe-kit/queue.json
```

---

## 4. Configuration

### 4.1 Per-CLI Settings

#### mclaude

```bash
# Configuracao via ~/.multi-claude/config.json
{
  "providers": {
    "minimax": {
      "api_key": "${MINIMAX_API_KEY}",
      "model": "MiniMax-M2.7",
      "base_url": "https://api.minimax.chat/v1"
    },
    "ollama": {
      "model": "qwen2.5",
      "base_url": "http://localhost:11434/v1"
    }
  },
  "active_provider": "minimax"
}
```

#### nexus.sh

```bash
# Flags disponiveis
nexus.sh --spec SPEC-XXX --phase <plan|review|execute|verify|complete>
nexus.sh --status              # Ver estado atual
nexus.sh --resume              # Retomar de checkpoint
nexus.sh --abort               # Abortar workflow
nexus.sh --snapshot            # ZFS snapshot manual
nexus.sh --mode <mode>         # Listar agentes por modo
nexus.sh --mode debug --agent log-diagnostic  # Ver prompt de agente especifico
```

#### vibe-kit.sh

```bash
# Variaveis de ambiente
VIBE_PARALLEL=15              # Numero de workers paralelos
VIBE_POLL_INTERVAL=5          # Intervalo de polling da queue (segundos)
VIBE_HOURS=8                   # Tempo maximo de execucao (horas)
VIBE_SNAPSHOT_EVERY=3         # ZFS snapshot a cada N tarefas
VIBE_DRY_RUN=                  # Se definido, nao executa workers
VIBE_SKIP_RATE_LIMIT=         # Se definido, ignora rate limiting
```

### 4.2 Rate Limiting

```bash
# Status do rate limiter
bash scripts/nexus-rate-limiter.sh --status

# Reset manual (diario automatico as 3AM)
bash scripts/nexus-rate-limiter.sh --reset

# Ver requests restantes
redis-cli GET rate_limit:remaining
redis-cli GET rate_limit:reset
```

### 4.3 ZFS Snapshots

```bash
# Listar snapshots do nexus
zfs list tank -t snapshot -r | grep nexus

# Criar snapshot manual
zfs snapshot tank@nexus-SPEC-XXX-manual-$(date +%Y%m%d%H%M%S)

# Rollback (cuidado: perder alteracoes)
sudo zfs rollback -r tank@nexus-SPEC-XXX-execute-20260430T120000
```

### 4.4 Task Queue (Redis)

```bash
# Ver tasks pendentes
redis-cli LRANGE queue:pending 0 -1

# Ver tasks em execucao
redis-cli LRANGE queue:running 0 -1

# Forcar redistribuicao de tasks orfaas
redis-cli SMEMBERS tasks:orphaned | while read task; do
  redis-cli LPUSH queue:pending "$task"
done

# Limpar queue (cuidado)
redis-cli FLUSHDB
```

---

## 5. Troubleshooting

### 5.1 Problemas comuns

#### Lock file preso

**Sintoma:** `Error: vibe-kit is already running (PID: XXXX)`

**Solucao:**
```bash
# Verificar se processo existe
ps aux | grep -E "vibe-kit|mclaude" | grep -v grep

# Se processo nao existe mas lock permanece, remover lock
rm -f /srv/monorepo/.claude/vibe-kit/.vibe-kit.lock
```

#### Rate limit exhausted

**Sintoma:** `Rate limit exhausted. Waiting for refill...`

**Solucao:**
```bash
# Ver tempo ate reset
redis-cli GET rate_limit:reset | xargs -I{} date -d @{}

# Reset manual se necessario
bash scripts/nexus-rate-limiter.sh --reset
```

#### Worker nao inicia

**Sintoma:** `mclaude: command not found` ou workers nao aparecem

**Solucao:**
```bash
# Verificar instalacao do mclaude
which mclaude
bun install -g @leogomide/multi-claude

# Verificar PATH
echo $PATH | tr ':' '\n' | grep -E "bun|local"

# Testar mclaude diretamente
mclaude --provider minimax --model MiniMax-M2.7 -p "echo test"
```

#### Tasks orfaas (stuck)

**Sintoma:** Tasks com status `running` ha muito tempo sem output

**Solucao:**
```bash
# Ver tasks orfaas
redis-cli SMEMBERS tasks:orphaned

# Redistribuir para queue pendente
ORPHANED=$(redis-cli SMEMBERS tasks:orphaned)
for task in $ORPHANED; do
  redis-cli SREM tasks:orphaned "$task"
  redis-cli LPUSH queue:pending "$task"
done

# Verificar heartbeat dos workers
tail -n 100 .claude/vibe-kit/logs/vibe-daemon.log | grep heartbeat
```

#### Redis indisponivel

**Sintoma:** `Could not connect to Redis at localhost:6379`

**Solucao:**
```bash
# Verificar servico Redis
systemctl status redis-server
redis-server --daemonize yes

# Ver logs
journalctl -u redis-server --no-pager -n 50
```

#### ZFS snapshot falha

**Sintoma:** `cannot create snapshot: dataset is busy` ou `permission denied`

**Solucao:**
```bash
# Verificar permissoes ZFS
zfs list -t snapshot -r tank | grep nexus

# Verificar se dataset existe
zfs list tank

# Snapshot manual como teste
zfs snapshot tank@test-$(date +%s)
zfs rollback tank@test-$(date +%s)
zfs destroy tank@test-$(date +%s)
```

### 5.2 Debugging avanzado

```bash
# Ativar modo debug verbose
set -x
bash .claude/vibe-kit/vibe-kit.sh
set +x

# Ver todos os logs
tail -f .claude/vibe-kit/logs/nexus.log
tail -f .claude/vibe-kit/logs/vibe-daemon.log

# Ver logs de worker especifico
tail -f .claude/vibe-kit/logs/workers/worker-01.log

# Ver tasks em tempo real
watch -n 1 'jq ".stats" /srv/monorepo/.claude/vibe-kit/queue.json'

# Ver estrutura completa da queue
jq '.' /srv/monorepo/.claude/vibe-kit/queue.json
```

### 5.3 Recovery procedures

#### Recovery de workflow abortado

```bash
# Ver estado atual
nexus.sh --status

# Resume do checkpoint
nexus.sh --resume

# Se checkpoint invalido, voltar para phase especifica
nexus.sh --spec SPEC-XXX --phase verify

# Se ZFS rollback necessario
sudo zfs rollback -r tank@nexus-SPEC-XXX-verify-20260430T120000
nexus.sh --spec SPEC-XXX --phase verify
```

#### Recovery de workers travados

```bash
# Parar todos os workers
pkill -f "mclaude -p"

# Limpar lock
rm -f .claude/vibe-kit/.vibe-kit.lock

# Resetar tasks running para pending
RUNNING=$(redis-cli LRANGE queue:running 0 -1)
for task in $RUNNING; do
  redis-cli LREM queue:running 1 "$task"
  redis-cli LPUSH queue:pending "$task"
done

# Restart vibe-kit
bash .claude/vibe-kit/vibe-kit.sh
```

---

## Appendix: Quick Reference

```bash
# Setup
export VIBE_DIR=/srv/monorepo/.claude/vibe-kit
export VIBE_PARALLEL=15

# Workflow completo
nexus.sh --spec SPEC-XXX --phase plan
nexus.sh --spec SPEC-XXX --phase review
nexus.sh --spec SPEC-XXX --phase execute
nexus.sh --spec SPEC-XXX --phase verify
nexus.sh --spec SPEC-XXX --phase complete

# Status
nexus.sh --status
redis-cli LRANGE queue:pending 0 -1

# Debug
tail -f .claude/vibe-kit/logs/nexus.log
VIBE_DRY_RUN=1 bash .claude/vibe-kit/vibe-kit.sh
```
