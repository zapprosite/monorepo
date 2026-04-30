---
name: SPEC-009
description: Blueprint shadow-context — arquitetura para memória infinita via mclaude -p workers + Qdrant + mem0 + Hermes
status: draft
owner: will-zappro
created: 2026-04-29
---

# SPEC-009 — Shadow Context Blueprint

## Problema

O homelab tem peças desconectadas que desperdiçam potencial:

| Componente | Estado | Impacto |
|------------|--------|---------|
| **Qdrant** (:6333) | 401 — sem auth configurada | RAG/imemory não funciona |
| **mem0** (mcp-memory) | Desconectado do Qdrant | Second brain não persiste |
| **Hermes Second Brain** | 68KB em ~/.hermes, não ~Desktop | Não está acessível como tutor |
| **Context window** | Tudo carrega na tua conversa (~2000 tokens) | Lento, perde contexto com histórico longo |
| **Workers mclaude -p** | Não consomem teu contexto | Oportunidade desperdiçada |

**Resultado:** Tu carregas contexto pesado, workers têm contexto zero, brain não existe.

## Solução: Shadow Context Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TWOO CLENT INTERFACES                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  JANELA (contexto vivo, limitado a ~4000 tokens)       │   │
│  │  ├─ CLAUDE.md (regras globais)                          │   │
│  │  ├─ Histórico da conversa (cada msg pesa)                │   │
│  │  └─ Tool calls (Read/Edit/Bash)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓ não carrega histórico                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SHADOW CONTEXT (não pesa na janela)                    │   │
│  │  ├─ Files (AGENTS.md, SPECs, docs) → Read via tools      │   │
│  │  ├─ Qdrant (embeddings) → busca semântica              │   │
│  │  ├─ mem0 (via Hermes MCP) → preferences + learnings     │   │
│  │  └─ Hermes Second Brain → contexto estruturado          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WORKERS (mclaude -p, contexto zero por task)          │   │
│  │  ├─ 15x parallel via VIBE_PARALLEL=15                  │   │
│  │  ├─ Estado em queue.json (não em memória)              │   │
│  │  └─ Resultados → Qdrant learnings collection           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Funcionalidade

### P — Audit Phase (Tarefas Analíticas)

- [ ] **T-AUDIT-001:** Qdrant health — testar auth, listar collections, verificar vector counts
- [ ] **T-AUDIT-002:** mem0 connection — testar se conecta ao Qdrant, verificar collections
- [ ] **T-AUDIT-003:** Hermes Second Brain — verificar TREE.md, criar em ~/Desktop se não existir
- [ ] **T-AUDIT-004:** Hermes MCP bridge — testar :8092, verificar tool registration
- [ ] **T-AUDIT-005:** LiteLLM health — testar auth required vs open, listar modelos
- [ ] **T-AUDIT-006:** Context window audit — medir tamanho de CLAUDE.md + rules + histórico

### P — Design Phase (Decisões Arquiteturais)

- [ ] **T-DESIGN-001:** Definir Qdrant auth strategy (api-key? token?)
- [ ] **T-DESIGN-002:** Definir mem0 collections schema (learnings, skills, homelab-state)
- [ ] **T-DESIGN-003:** Definir Hermes Second Brain TREE.md structure
- [ ] **T-DESIGN-004:** Mapear quais files carregam via Read vs contexto
- [ ] **T-DESIGN-005:** Definir pipeline.json schema para tasks atomicas

### E — Fix Phase (Implementação)

- [ ] **T-FIX-001:** Configurar Qdrant auth — criar api-key, atualizar .env
- [ ] **T-FIX-002:** Criar Qdrant collections: `learnings`, `skills`, `homelab-state`
- [ ] **T-FIX-003:** Conectar mem0 ao Qdrant — configurar MCP server
- [ ] **T-FIX-004:** Criar Second Brain em ~/Desktop/hermes-second-brain/ com TREE.md
- [ ] **T-FIX-005:** Criar PRD template em ~/Desktop/hermes-second-brain/prds/
- [ ] **T-FIX-006:** Criar skills registry em ~/Desktop/hermes-second-brain/skills/
- [ ] **T-FIX-007:** Criar learnings collection schema (what worked, what failed)

### E — Pipeline Phase (Automation)

- [ ] **T-PIPE-001:** Criar pipeline.json genérico para brainstorms → PRD
- [ ] **T-PIPE-002:** Criar SPEC template (SPEC-XXX.md) com PREVC
- [ ] **T-PIPE-003:** Criar queue.json generator (tasks atomicas de 5-10 min)
- [ ] **T-PIPE-004:** Criar vibe-kit template para brain workers
- [ ] **T-PIPE-005:** Configurar cron de sync: brain ↔ Qdrant

### V — Verify Phase (Testes)

- [ ] **T-VERIFY-001:** Testar Qdrant search — buscar "gestão de tarefas"
- [ ] **T-VERIFY-002:** Testar mem0 recall — pedir "último learning"
- [ ] **T-VERIFY-003:** Testar Hermes /brain — enviar mensagem no Telegram
- [ ] **T-VERIFY-004:** Testar pipeline.json — gerar SPEC dummy via nexus
- [ ] **T-VERIFY-005:** Testar worker spawn — vibe-kit com 3 workers

### C — Document Phase (Entrega)

- [ ] **T-DOCS-001:** Escrever SHADOW-CONTEXT.md em docs/
- [ ] **T-DOCS-002:** Atualizar NEXUS_GUIDE.md com shadow context pattern
- [ ] **T-DOCS-003:** Criar BRAINSTORM-TO-DEPLOY.md guide
- [ ] **T-DOCS-004:** Atualizar ARCHITECTURE.md com nova stack

## Acceptance Criteria

1. Quando `/brain tenho ideia de app X` é enviado no Telegram, então Hermes busca Qdrant e retorna SPEC 类似 + learnings
2. Quando novo PRD é criado em `prds/`, então embeddings são gerados e armazenados em Qdrant `prds` collection
3. Quando `nexus.sh --spec SPEC-NNN --phase execute` roda, então workers (mclaude -p) executam com contexto zero — não consomem histórico da conversa
4. Quando `queue.json` é atualizado por workers, então o estado persiste — se worker morrer, outro continua
5. Quando tu perguntas "o que já fizemos sobre SPEC-009?", então sistema busca Qdrant e retorna contexto sem carregar histórico
6. Quando brainstorm acontece, então Hermes cria PRD draft → SPEC → queue.json → workers → deploy em < 1 hora

## Fluxo: Brainstorm → Deploy

```
1. Brainstorm (Tu / Hermes)
   └── Tu: "/brain quero um app de tarefas com IA"
   └── Hermes: busca Qdrant learnings + SPECs 类似
   └── Hermes: retorna "padrão Y funcionou, padrão Z falhou"

2. PRD Draft (Hermes Second Brain)
   └── Hermes: cria ~/Desktop/hermes-second-brain/prds/APP-X-PRD.md
   └── Embeddings → Qdrant `prds` collection

3. SPEC + Pipeline (Nexus)
   └── nexus.sh --spec APP-X --phase plan
   └── SPEC.md gerado de template
   └── queue.json com tasks atomicas (5-10 min cada)

4. Execute (mclaude -p workers)
   └── vibe-kit.sh com VIBE_PARALLEL=15
   └── Workers: contexto zero, leem files + Qdrant
   └── Resultados → Qdrant `learnings`

5. Verify + Deploy (Coolify)
   └── nexus.sh --phase verify
   └── deploy-agent worker: Coolify API → deploy
   └── Hermes notifica via Telegram
```

## Tech Stack

- **Workers:** mclaude -p (MiniMax-M2.7, contexto zero)
- **Vector DB:** Qdrant (:6333) — corrigir auth
- **Memory:** mem0 via mcp-memory → Qdrant backend
- **Tutor:** Hermes Gateway (:8642) + Hermes MCP (:8092)
- **Second Brain:** ~/Desktop/hermes-second-brain/ (file-based + Qdrant search)
- **Queue:** queue.json (atomic, crash-safe via fcntl.flock + os.replace)
- **Runner:** vibe-kit.sh (VIBE_PARALLEL=15, snapshot ZFS automático)

## Pipeline JSON Schema

```json
{
  "spec": "SPEC-XXX",
  "phase": "execute",
  "parallel_limit": 15,
  "tasks": [
    {
      "id": "T001",
      "name": "task-name-slug",
      "description": "Descrição da tarefa (5-10 min)",
      "agent_role": "backend-agent|deploy-agent|docs-agent|debug-agent",
      "file_context": [
        "/srv/monorepo/AGENTS.md",
        "/srv/monorepo/docs/SPECS/SPEC-XXX.md"
      ],
      "expected_output": "Descrição do output esperado",
      "acceptance_criteria": [
        "Critério 1",
        "Critério 2"
      ]
    }
  ]
}
```

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Qdrant auth quebrado | Alta | RAG não funciona | Fix T-FIX-001 primeiro |
| mem0 não conecta a Qdrant | Alta | Second brain não persiste | Fix T-FIX-002 + T-FIX-003 |
| Workers consomem contexto histórico | Baixa | Janela fica lenta | Workers usam mclaude -p (contexto zero) |
| queue.json corrompe | Baixa | Estado perdido | fcntl.flock + os.replace (atômico) |
| Hermes MCP offline | Média | Tutor não responde | Monitor :8092 health |

## Referências

- `/srv/monorepo/docs/AUDITS/SPEC-008-COMPLETION-REPORT.md` — SPEC-008 results
- `/srv/ops/ai-governance/NETWORK_MAP.md` — Network topology
- `/srv/monorepo/.claude/vibe-kit/vibe-kit.sh` — Worker runner
- `/srv/monorepo/.claude/vibe-kit/nexus.sh` — PREVC orchestrator
- `~/.claude/rules/agent-skills.rules` — Shadow context skill