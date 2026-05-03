# ADR-VIBE-LOOP — Infinite Vibe Coding Loop Architecture

**Status:** aceito
**Date:** 2026-04-24
**Author:** Principal Engineer
**Spec:** SPEC-VIBE-BRAIN-REFACTOR (FASE 5)

---

## Context

O desenvolvimento autónomo emulando o workflow Cursor AI + Perplexity Computer requer um loop infinito de planeamento, execução e verificação — sem intervenção humana contínua. O sistema atual (Hermes + Mem0 + Qdrant) consegue raciocinar mas não consegue operar autonomamente num ciclo fechado.

O desafio: criar uma arquitetura onde múltiplos workers `mclaude` consigam operar continuamente, com estado partilhado via filesystem, usando Gitea como orquestrador cloud e ZFS como rede de segurança.

---

## Decision

Implementar o padrão **Vibe Coding Loop** — um ciclo autónomo de 3 camadas de memória + workers filesystem-based + Gitea cloud runner + ZFS safety net.

```
                    ┌─────────────────────────────────────────┐
                    │         INFINITE VIBE CODING LOOP        │
                    └─────────────────────────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
              ┌─────▼─────┐          ┌───────▼───────┐        ┌──────▼──────┐
              │  LAYER 1  │          │   LAYER 2    │        │  LAYER 3    │
              │   REPO    │─────────▶│    QDRANT     │───────▶│    MEM0     │
              │ (source   │  index   │    (RAG)      │ recall │ (preferências)│
              │  of truth)│          │               │        │              │
              └───────────┘          └───────────────┘        └──────────────┘
                     │                       │                        │
                     │                       │                        │
                     ▼                       ▼                        ▼
              ┌─────────────────────────────────────────────────────────────┐
              │                    HERMES EXECUTOR                          │
              │  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
              │  │ mclaude  │  │ mclaude  │  │   mclaude worker N      │  │
              │  │ worker 1 │  │ worker 2 │  │                          │  │
              │  └────┬─────┘  └────┬─────┘  └────────────┬─────────────┘  │
              └───────┼────────────┼─────────────────────┼─────────────────┘
                      │            │                     │
                      │   ┌────────▼────────┐           │
                      │   │  WORKDIR STATE  │           │
                      │   │  (filesystem)   │           │
                      │   │  queue.json     │           │
                      │   │  results/       │           │
                      │   │  checkpoint.json │           │
                      │   └─────────────────┘           │
                      │            │                     │
                      └────────────┼─────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │         GITEA CLOUD          │
                    │        (cloud runner)        │
                    │   PR → review → merge → job  │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │      ZFS SNAPSHOT SAFE NET    │
                    │   pre-run snapshot + diff     │
                    └──────────────────────────────┘
```

---

## 3-Layer Memory Pattern

### Layer 1 — REPO (Source of Truth)

Arquivo_versionado + revisado. Texto completo, buscável por grep.

```
Second Brain (~/Desktop/hermes-second-brain/)
├── AGENTS.md               # Agent instructions (fonte primária)
├── llms.txt                # Índice do repo (gerado automaticamente)
├── architecture-map.yaml   # Mapa de entrada do sistema
├── adr/                    # Architecture Decision Records
│   └── *.md
├── specs/                  # SPECs do projeto
│   └── SPEC-*.md
├── runbooks/               # Procedimentos operacionais
│   └── *.md
└── glossary/               # Glossário de termos
    └── *.md
```

**Regras:**
- REPO = source of truth (versionado, reviewed)
- Nunca escrever documentação em Qdrant ou Mem0 — apenas no REPO
- Todas as changes passam por PR review antes de merge

### Layer 2 — QDRANT (RAG)

Vector store local para retrieval semântico com metadata filters.

```
Collection: hermes-brain
├── doc_type: adr | runbook | architecture | api | prompt | glossary
├── project: hermes-second-brain
├── service: hermes-agents | mcloud | codex
├── source_path: path/to/file.md
├── updated_at: ISO8601
├── owner: william
└── version: v1
```

**Busca híbrida:**
```python
# Pseudo-code — hybrid search
results = qdrant.hybrid_search(
    query=text,
    filter={"doc_type": "runbook", "service": "hermes-agents"},
    top_k=5
)
```

### Layer 3 — MEM0 (Preferências)

Memória dinâmica: padrões de coding, preferências do utilizador, contexto de projeto.

```
UserPreferences:
  coding_style: "concise, no-comments"
  llm_provider: "minimax/MiniMax-M2.7"
  memory_recall_threshold: 0.85
  preferred_stack: ["fastify", "tRPC", "react", "postgres"]
```

**Nota:** Mem0 está atualmente quebrado (embedding model mismatch). Fix em FASE 1 do SPEC-VIBE-BRAIN-REFACTOR.

---

## Autonomous mclaude Workers

### Filesystem-Based State

Cada worker comunica através do filesystem — sem redis, sem DB central.

```
WORKDIR/
├── queue.json           # Fila de tasks (LIFO ou FIFO)
├── checkpoint.json      # Estado do loop (última task, timestamp, retry count)
├── results/             # Resultados de cada task
│   ├── task-001.json
│   ├── task-002.json
│   └── ...
└── logs/                # Logs estruturados por worker
    ├── worker-001.log
    └── worker-002.log
```

### Worker Lifecycle

```
1. READ  queue.json → pick task
2. EXEC  mclaude <task> --context=$(cat context.json)
3. WRITE results/task-N.json
4. UPDATE checkpoint.json
5. GOTO 1
```

### State Machine

```
         ┌─────────────┐
         │    IDLE     │◀────────────────┐
         └──────┬──────┘                 │
                │ dequeue task           │ no tasks (backoff 5min)
                ▼                        │
         ┌─────────────┐                 │
    ┌───▶│  EXECUTING  │─────────────────┤
    │    └──────┬──────┘                 │
    │           │ task complete          │ error / SIGSEGV
    │           ▼                        │
    │    ┌─────────────┐                 │
    │    │   SUCCESS   │─────────────────┘
    │    └──────┬──────┘  retry (max 3)
    │           │ task failed
    │           ▼
    │    ┌─────────────┐
    └────│   FAILED    │───▶ (alert + skip)
         └─────────────┘
```

### Self-Healing

- **SIGSEGV / OOM:** worker morre → cron watchdog reinicia com checkpoint
- **Loop infinito:** max 50 iterações por task → force-kill + skip
- **Qdrant down:** backoff 5min, retry com circuit-breaker
- **Mem0 timeout:** fallback para REPO lookup

---

## Gitea as Cloud Runner

### Pipeline

```
Worker complete
    │
    ▼
git add results/
git commit -m "vibe: task N complete"
git push origin worker-branch
    │
    ▼
PR created (auto)
    │
    ▼
CI: smoke tests + lint
    │
    ▼
Reviewer (human ou AI): /review
    │
    ▼
Merge to main
    │
    ▼
Gitea webhook → trigger next worker
```

### Branch Strategy

```
main                   # código reviewed
├── worker/w1-001     # worker 1 tasks
├── worker/w2-001     # worker 2 tasks
└── ...
```

**Vantagens:**
- Gitea CI executa testes automaticamente
- PRs são audit trail completo
- Merge = approved by design (human reviewed)

---

## ZFS Snapshot Safety Net

### Pre-Run Snapshot

Antes de cada task massiva (refactor, delete, schema change):

```bash
# Snap pre-run
sudo zfs snapshot srv/docker-data@pre-task-$(date +%Y%m%d%H%M%S)

# Executar task
mclaude "refactor the auth middleware"

# Se OK → destroy snapshot
sudo zfs destroy srv/docker-data@pre-task-YYYYMMDDHHMMSS

# Se FAIL → rollback
sudo zfs rollback srv/docker-data@pre-task-YYYYMMDDHHMMSS
```

### Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `vibe-brain-fix` | once | Fix Mem0 + index |
| `vibe-brain-workers` | `*/15min` | Launch mclaude workers |
| `vibe-brain-monitor` | `*/30min` | Check progress + self-heal |

---

## Consequences

### Positive

- **Autonomous:** loop corre 24/7 sem intervenção humana contínua
- **Safe:** ZFS snapshots permitem rollback instantâneo
- **Auditable:** Gitea PRs são audit trail completo
- **Resilient:** filesystem state funciona mesmo se Mem0/Qdrant falharem
- **Scalable:** workers adicionam-se via cron sem alterar arquitetura

### Negative

- **Disk I/O:** state em filesystem é mais lento que Redis
- **Race conditions:** workers concurrentes podem conflictar em queue.json (mitigado: flock ou task-level lock)
- **No real-time visibility:** precisa de polling para monitorar

### Mitigations

- **flock(1):** lock ficheiro na leitura/escrita de queue.json
- **Atomic moves:** `mv new.json queue.json` (atomic rename)
- **Prometheus metrics:** exporter para métricas em vez de polling

---

## Alternatives Considered

### Redis-based state

Rejeitado: adiciona dependência externa, não tem snapshots, não é versionável.

### Direct Mem0 as state

Rejeitado: Mem0 é para preferências, não para queue de tasks. Misturar use cases quebra o padrão.

### GitHub Actions como cloud runner

Rejeitado: Gitea já existe no homelab, menos dependências externas.

---

## Related Documents

- SPEC-VIBE-BRAIN-REFACTOR.md
- ADR-001-denv-as-canonical-secrets-source.md
- docs/SECOND-BRAIN.md
- docs/ARCHITECTURE-OVERVIEW.md

---

**Authority:** Platform Governance
**Last updated:** 2026-04-24
