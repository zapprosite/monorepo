# CANVAS — Cursor-Loop Architecture

**Data:** 2026-04-10
**Versão:** Visual Brain Dump

---

## 1. CICLO COMPLETO — Spec to Ship

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WORKFLOW PRINCIPAL                                   │
└─────────────────────────────────────────────────────────────────────────────┘

  IDÉIA
    │
    ▼
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌────────────┐
│  /spec  │───▶│  SPEC   │───▶│  /pg     │───▶│ PIPELINE   │
│ (skill) │    │  .md    │    │ (skill)  │    │  .json     │
└─────────┘    └─────────┘    └──────────┘    └────────────┘
                                                  │
                     ┌────────────────────────────┘
                     ▼
              ┌────────────┐
              │  TASKS     │
              │  /todo     │
              └────────────┘
                     │
     ┌────────────────┼────────────────┐
     ▼                ▼                ▼
┌─────────┐     ┌──────────┐    ┌──────────┐
│  BUILD  │     │   TEST   │    │  REVIEW  │
│ (agent) │     │ (agent)  │    │ (agent)  │
└─────────┘     └──────────┘    └──────────┘
     │                │                │
     ▼                ▼                ▼
┌─────────────────────────────────────────────┐
│              /ship (skill)                   │
│         stage → commit → push → PR           │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│           CURSOR LOOP (automático)           │
│  leader → research → refactor → review      │
│     → ship → mirror → sync                  │
└─────────────────────────────────────────────┘
```

---

## 2. COMANDOS — Mapa de Decisão

```
QUERO FAZER:
│
├─ /spec <desc>          → Escrever SPEC de uma feature
├─ /pg                    → Gerar pipeline.json a partir de SPECs
├─ /feature <nome>       → Criar branch feature + implementar
├─ /scaffold <tipo>      → Criar estrutura app/package
├─ /ship                  → Commitar + push + PR (precisa staged)
├─ /sync                  → Quick commit + push (sem PR)
├─ /turbo                 → Commit + merge + tag + nova branch
├─ /mirror                → Push para Gitea + GitHub
├─ /img <path|url>       → Analisar imagem (Qwen2.5-VL)
├─ /cursor-loop           → Iniciar loop autónomo
│
├─ /review                → Code review (nativo)
├─ /plan                  → Plan (nativo)
├─ /test                  → TDD (nativo)
├─ /build                 → Build (nativo)
├─ /help                  → Ajuda (nativo)
```

---

## 3. SKILLS — 3 Camadas

```
┌──────────────────────────────────────────────────────────┐
│  CAMADA 1 — Sistema Global (~/.claude/agent-skills/)    │
│  (carregadas automaticamente pelo Claude Code)           │
├──────────────────────────────────────────────────────────┤
│  /spec           → spec-driven-development               │
│  /plan           → planning-and-task-breakdown          │
│  /test           → test-driven-development              │
│  /review         → code-review-and-quality              │
│  /ship           → shipping-and-launch                  │
│  (auto)           → security-and-hardening (quando      │
│                      detecta input de rede)              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  CAMADA 2 — Monorepo Local (.claude/commands/)         │
│  (comandos específicos do repo)                          │
├──────────────────────────────────────────────────────────┤
│  /cursor-loop     → loop autónomo completo               │
│  /pg              → gera pipeline.json                  │
│  /feature         → git-feature workflow                │
│  /scaffold        → cria app/package                    │
│  /sync            → quick commit + push                 │
│  /mirror          → push gitea + github                │
│  /turbo           → commit + merge + tag                │
│  /img             → Qwen2.5-VL (via vision-local)      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  CAMADA 3 — Infraestrutura (.claude/skills/)           │
│  (operacionais — não são comandos slash)                │
├──────────────────────────────────────────────────────────┤
│  coolify-access        → Coolify API (38 tools)        │
│  gitea-access          → Gitea API (repos, PRs)       │
│  cloudflare-terraform  → Terraform + DNS                │
│  deploy-validate       → Pre-deploy check               │
│  snapshot-safe         → ZFS snapshot                  │
│  smoke-test-gen        → Gera smoke tests               │
│  secrets-audit         → Scan secrets                   │
│  human-gates           → Identifica blockers            │
│  mcp-health            → Diagnostica MCPs              │
│  context-prune          → Limpa sessões                │
└──────────────────────────────────────────────────────────┘
```

---

## 4. PIPELINE.JSON — Opções

```jsonc
{
  "version": "2.0",              // Versão do schema

  // ── ESTADO DO LOOP ──
  "currentState": "IDLE",         // IDLE | RUNNING | BLOCKED
                                  // BLOCKED_HUMAN_REQUIRED | TEST_FAILED
                                  // READY_TO_SHIP

  "currentTask": null,             // ID da task em execução
                                  // ex: "P001-T03"

  "lastCheckpoint": null,          // Última task validada

  "iterationCount": 0,            // Contagem de ciclos
  "maxIterations": 10,             // Máximo antes de parar

  "retryCount": 0,                 // Retry do loop actual
  "maxRetries": 3,                 // Máximo de retries

  // ── RESULTADOS ──
  "testsPassed": false,            // Testes passam?
  "lintPassed": false,             // Lint passa?
  "readyToShip": false,            // Pronto para merge?

  // ── BLOqueios ──
  "blockedReason": null,           // "SECRET_MISSING"
                                  // "HUMAN_GATE"
                                  // "CI_FAILED"
  "blockedAt": null,               // Timestamp do bloqueio

  "humanGateRequired": false,       // Precisa aprovação humana?
  "humanGateReason": null,         // "deploy" | "rollback"

  // ── TASKS ──
  "pendingTasks": [],              // Tasks por fazer
  "completedTasks": [],           // Tasks feitas
  "failedTasks": [],               // Tasks que falharam

  "retryHistory": [],              // Histórico de retries

  // ── METADADOS ──
  "generated": "2026-04-09",      // Data de geração
  "phase": 1,                      // Fase actual (1-7)
  "total_tasks": 73,               // Total de tasks

  // ── FASES ──
  "phases": [
    {"name": "Phase 1 — Security Foundation",  "tasks": 11, "completed": 0},
    {"name": "Phase 2 — OAuth + E2E",           "tasks": 13, "completed": 0},
    {"name": "Phase 3 — Agents Kit + CLI",      "tasks": 18, "completed": 0},
    {"name": "Phase 4 — CI/CD Enterprise",     "tasks": 12, "completed": 0},
    {"name": "Phase 5 — Complex Systems",        "tasks": 13, "completed": 0}
  ],

  // ── CRITICAL PATH (para gating) ──
  "critical_path": [
    "P000-T01",
    "P001-T01",
    "P020-T01"
  ]
}
```

---

## 5. PIPELINE-STATE.JSON — Estrutura Detalhada

```jsonc
{
  "version": "1.0",
  "generated": "2026-04-10",

  "phases": [
    {
      "name": "Phase 0 — Security Critical",

      "tasks": [
        {
          "id": "P000-T01",
          "title": "chmod 600 /data/coolify/source/.env",
          "status": "DONE",        // DONE | PENDING | IN_PROGRESS
                                    // BLOCKED | MANUAL | PARTIAL
          "priority": "critical",   // critical | high | medium | low
          "verification": "stat -c %a /data/coolify/source/.env → 600",
          "acceptance_criteria": "File permissions are 600, not world-readable",

          // Se bloqueada
          "blocked_by": ["P000-T03"],  // IDs de tasks que precisam estar DONE primeiro
          "notes": "coolify-sentinel managed by Coolify API"
        }
      ]
    }
  ],

  // ── RESUMO ──
  "total_pending": 81,
  "critical_path": [
    "P000-T01",
    "P000-T02",
    // ...
  ]
}
```

---

## 6. CURSOR LOOP — Fluxo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURSOR LOOP LEADER                            │
│  Modelo: cm (MiniMax M2.7)                                      │
│  Lê: tasks/pipeline.json antes de iniciar                       │
└─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │ PASSO 1 — INFISICAL CHECK                                  │
  │ Python SDK → 144 secrets → verifica COOLIFY_URL,          │
  │ COOLIFY_API_KEY, GITEA_TOKEN, CLAUDE_API_KEY              │
  │                                                              │
  │ ⚠️ GAP: Mostra "Bootstrap Effect" se segredo falta        │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ PASSO 2 — GITEA PUSH                                       │
  │ git push gitea HEAD && git push origin HEAD               │
  │ (branch: feature/quantum-dispatch-ax7k2)                   │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ PASSO 3 — Gitea CI                                          │
  │ gh run watch → aguarda resultado                             │
  │                                                              │
  │ ├── PASS ───────────────────────────────────────────────┐   │
  │ │                                                        │   │
  │ │    ▼                                                   │   │
  │ │ PASSO 4 — COOLIFY DEPLOY                               │   │
  │ │ Bearer token → nginx 401 (problema known)             │   │
  │ │                                                          │   │
  │ │    ▼                                                    │   │
  │ │ PASSO 5 — CLOUDFLARE DNS                               │   │
  │ │ terraform plan/apply → novo subdomain?                  │   │
  │ │                                                          │   │
  │ │    ▼                                                    │   │
  │ │ PASSO 6 — SMOKE TEST                                    │   │
  │ │ curl https://service.zappro.site/_stcore/health       │   │
  │ │                                                          │   │
  │ └──────────────────────────────────────────────────────────┘  │
  │                                                              │
  │ └── FAIL ──→ 5 RESEARCH AGENTS (parallel)                  │
  │                  │                                          │
  │                  ├── cursor-loop-research-1                 │
  │                  ├── cursor-loop-research-2                   │
  │                  ├── cursor-loop-research-3                   │
  │                  ├── cursor-loop-refactor                     │
  │                  └── cursor-loop-review                       │
  │                                                              │
  │                  Loop back to [2] retry                     │
  └─────────────────────────────────────────────────────────────┘
```

---

## 7. AGENTS — 10 Especialistas

```
┌─────────────────────────────────────────────────────┐
│              CURSOR LOOP AGENTS                      │
│  Dir: .claude/agents/cursor-loop-*.md              │
│  Modelo: cm (MiniMax M2.7 para todos)               │
└─────────────────────────────────────────────────────┘

  leader          → Orquestra o loop, lê pipeline.json
  research (x5)  → Tavily + Context7 research
  refactor        → Auto-aplica fixes
  review          → AI code review
  spec            → Gera/actualiza SPECs
  ship            → Commit + push + PR
  mirror          → Push gitea + origin
  sync            → ai-context-sync
  debug           → /debug on failures
  giteaai         → Gitea CI integration
```

---

## 8. MCPs — Estado

```
┌─────────────────────────────────────────────────────┐
│  MCP SERVERS                                        │
└─────────────────────────────────────────────────────┘

  ✅ openwebui    → http://localhost:3333/mcp
  ✅ ai-context-sync → ~/.claude/mcps/ai-context-sync/sync.sh
  ✅ context7     → regra em ~/.claude/rules/context7.md

  ⚠️ coolify     → @masonator/coolify-mcp (npx)
  ⚠️ gitea       → @masonator/gitea-mcp (npx)
  ⚠️ Infisical   → Python SDK (não é MCP)

  ❌ taskmaster-ai → NÃO INSTALADO
  ❌ Tavily       → NÃO INSTALADO
```

---

## 9. MEMORY — Fluxo de Dados

```
  docs/ (source of truth)
       │
       │  ai-context-sync
       │  (cron 30 min)
       ▼
  ~/.claude/projects/-srv-monorepo/memory/
       │
       ├── MEMORY.md (index)
       ├── ai-context.md
       ├── architecture.md
       ├── development-workflow.md
       ├── docs-index.md
       ├── glossary.md
       ├── project-overview.md
       ├── workflow.md
       └── homelab-estado.md

       │
       │  Obsidian (manual rsync)
       ▼
  obsidian/ (espelho passivo read-only)
```

---

## 10. CRON JOBS — Auto-Orchestration

```
┌─────────────────────────────────────────────────────────────────┐
│  CRON JOBS                                                      │
│  File: .claude/scheduled_tasks.json                              │
└─────────────────────────────────────────────────────────────────┘

  ID          │ Cron        │ Função
  ────────────┼─────────────┼────────────────────────────────────
  614f0574    │ */30 * * * * │ sync docs → memory
  modo-dormir  │ 0 3 * * *  │ SPEC → pipeline
  code-review  │ 0 4 * * *  │ Code review diário
  test-cover   │ 0 5 * * *  │ Test coverage
  secrets-audit│ 0 6 * * *  │ Secrets scan
  mcp-health   │ 0 8 * * *  │ MCP health check
  auto-healer   │ */5 * * * * │ Coolify auto-heal (skill)
```

---

## 11. TECNOLOGIAS

```
STACK PRINCIPAL
───────────────
  Runtime:     Node.js 22 + pnpm 9
  Backend:     Fastify + tRPC + Orchid ORM
  Frontend:    React 19 + MUI + tRPC
  Database:    PostgreSQL 15
  Validation: Zod (shared)

INFRAESTRUTURA
───────────────
  Deploy:      Coolify (localhost:8000)
  CI/CD:       Gitea Actions + GitHub Actions
  Secrets:     Infisical (vault.zappro.site:8200)
  DNS:         Cloudflare + Terraform
  Vector DB:   Qdrant (10.0.19.5:6333)

VOZ (OpenClaw)
───────────────
  STT:         wav2vec2 (:8201) via Deepgram proxy
  TTS:         Kokoro (:8880) via TTS Bridge (:8013)
  LLM:         MiniMax M2.7 (direct, não LiteLLM)
  Vision:      litellm/qwen2.5-vl
```

---

## 12. PASTA docs/ — ESTRUTURA

```
docs/
├── specflow/          ✅ CANONICAL — specs, ADRs, tasks
├── AI-CONTEXT.md     ✅ RAIZ — contexto principal
├── GOVERNANCE/       ✅ CANONICAL — regras imutáveis
├── INFRASTRUCTURE/   ✅ CANONICAL — rede, ports
├── MCPs/             ✅ MCP documentation
├── OPERATIONS/       ✅ OPERATIONAL — SKILLS, docker
├── ADRs/             ✅ CANONICAL — decisões architectural
├── TEMPLATES/        ✅ TEMPLATES — PRD, SPEC
│
├── archive/          ⚠️ ARCHIVED — antigos, não referenciados
│   ├── guides-moved-YYYYMMDD/
│   ├── logs-moved-YYYYMMDD/
│   ├── plans-moved-YYYYMMDD/
│   └── APPLICATION-moved-YYYYMMDD/
│
└── obsidian/         📎 ESPELHO PASSIVO — rsync manual
```
