# SPEC-TRANSFORM: Monorepo Refinement + Template Extraction

**Status:** READY
**Date:** 2026-04-09
**Author:** will + agents (inventory by 5 parallel agents)
**Type:** SPEC

---

## VEREDITO DO ESTADO ATUAL

**Diagnóstico:** Monorepo funcional com cérebro documental INTACTO mas estrutura operacional POLUÍDA.

| Área | Veredito | Detalhe |
|------|----------|---------|
| Cérebro MD | ✅ SAUDÁVEL | 150+ docs em docs/, .context/, obsidian/ |
| Obsidian | ✅ INTACTO | Vault funcional, configs OK |
| CI/CD | ✅ OPERACIONAL | 8 workflows Gitea + 2 GitHub reais |
| Apps | ⚠️ MISTURADO | 3 reais (backend, frontend, perplexity-agent), 2 stubs (, orchestrator) |
| Scripts | ✅ REAIS | 6 scripts operacionais com lógica real |
| .claude | ⚠️ FRAGMENTADO | 17 commands OK, 32 skills com 1 broken symlink |
| .agent | ⚠️ DECORATIVO | 10 stub dirs vazios em workflows/ |
| Packages | ✅ REAIS | 3 packages compartilhados funcionais |
| Hooks | ✅ PARCIAL | pre-commit real, PreToolUse/PostToolUse ausente |

**Problema central:** Estrutura .claude/.agent/.context com redundância e stubs, não ausência de conteúdo.

---

## PRINCÍPIOS DE TRANSFORMAÇÃO

1. **Preservar cérebro MD** — todos *.md úteis são source of truth organizacional
2. **Separar doc de runtime** — Markdown documenta, Scripts executam
3. **Zero placeholder operacional** — workflow sem executor vira ARCHIVE/DELETE
4. **Monorepo real** — apps com boundaries claros, packages compartilhados, tooling centralizado
5. **Template reutilizável** — extrair estrutura como template para outros projetos
6. **Redundânciaconscious** — .claude/.agent/.context têm overlap deliberado mas organizado

---

## OBRIGATÓRIOS — KEEP (NUNCA APAGAR)

### Cérebro Documental
- `docs/ADRs/` — Architecture Decision Records
- `docs/GOVERNANCE/` — CONTRATO, GUARDRAILS, APPROVAL_MATRIX, CHANGE_POLICY
- `docs/ARCHITECTURE/` — decisões arquiteturais
- `docs/INFRASTRUCTURE/` — NETWORK_MAP, PORTS, SERVICE_MAP, MONITORING
- `docs/specflow/SPEC-*.md` — especificações
- `docs/OPERATIONS/` — runbooks, guias
- `docs/MCPs/` — MCP documentation
- `docs/guides/` — guias de ferramentas
- `docs/INCIDENTS/` — relatórios de incidente

### Obsidian
- `obsidian/` — vault completo com plugins e configurações
- `.obsidian/` — configurações do vault

### Context
- `.context/docs/` — índice de conhecimento organizacional
- `.context/skills/` — skills compiladas
- `.context/workflow/` — estado e planos

### Configs CI/CD
- `.github/workflows/*.yml` — GitHub Actions
- `.gitea/workflows/*.yml` — Gitea Actions
- `.claude/hooks/pre-commit` — secrets scanner real

### Apps Reais
- `apps/backend/` — Fastify + tRPC + OrchidORM
- `apps/frontend/` — React + MUI + TanStack
- `apps/perplexity-agent/` — Python + Streamlit + browser-use

### Packages Reais
- `packages/typescript-config/`
- `packages/ui-mui/`
- `packages/zod-schemas/`

### Scripts Reais
- `scripts/backup.sh`
- `scripts/deploy.sh`
- `scripts/health-check.sh`
- `scripts/mirror-push.sh`
- `scripts/restore.sh`
- `scripts/sync-env.js`

### Commands e Agents
- `.claude/commands/*.md` — 17 comandos funcionais
- `.claude/agents/*.md` — 31 agents funcionais
- `.claude/rules/*.md` — 4 rules reais
- `.claude/workflows/*.md` — 6 workflows reais
- `.agent/workflows/*.md` — 10 workflows reais
- `.agent/agents/*.md` — 18 agents reais
- `.agent/skills/` — 10 skills reais

---

## PODAR / MOVER / ARQUIVAR

### DELETE (lixo operacional)
| Path | Razão |
|------|-------|
| `trigger-gitea.txt` | Arquivo vazio placeholder |
| `.npmrc` | Arquivo vazio |
| `.Trash-1000/` | Lixeira abandonada |
| `apps//` | Directory vazio (stub) |
| `build.log` | Artefacto de build antigo |
| `development-plan.md` | Plano datado (March 2026) |
| `data/` | Directory vazio |
| `.claude/skills/spec-driven-development/` | Symlink quebrado (aponta para ~/.claude fora do repo) |

### ARCHIVE (preservar mas isolar)
| Path | Destino | Razão |
|------|---------|-------|
| `logs/` | `docs/archive/logs/` | Logs de runtime |
| `test-results/` | `docs/archive/test-results/` | Resultados de teste |
| `docs/ARCHIVE/` (existente) | MANTER | Docs antigos já arquivados |
| `docs/logs/` | `docs/archive/runtime-logs/` | Logs documentais |
| `runner/data/actcache/cache` | LIMPAR | Cache vazio |

### MERGE / CONSOLIDATE
| Path | Ação | Razão |
|------|------|-------|
| `.agent/workflows/api-design/` (stub) | MERGE → `.claude/skills/api-design/` | Stub vazio, skill real já existe |
| `.agent/workflows/bug-investigation/` (stub) | MERGE → `.claude/skills/bug-investigation/` | Stub vazio, skill real já existe |
| `.agent/workflows/code-review/` (stub) | MERGE → `.claude/skills/code-review/` | Stub vazio, skill real já existe |
| `.agent/workflows/commit-message/` (stub) | MERGE → `.claude/skills/commit-message/` | Stub vazio, skill real já existe |
| `.agent/workflows/documentation/` (stub) | MERGE → `.claude/skills/documentation/` | Stub vazio, skill real já existe |
| `.agent/workflows/feature-breakdown/` (stub) | MERGE → `.claude/skills/feature-breakdown/` | Stub vazio, skill real já existe |
| `.agent/workflows/pr-review/` (stub) | MERGE → `.claude/skills/pr-review/` | Stub vazio, skill real já existe |
| `.agent/workflows/refactoring/` (stub) | MERGE → `.claude/skills/refactoring/` | Stub vazio, skill real já existe |
| `.agent/workflows/security-audit/` (stub) | MERGE → `.claude/skills/security-audit/` | Stub vazio, skill real já existe |
| `.agent/workflows/test-generation/` (stub) | MERGE → `.claude/skills/test-generation/` | Stub vazio, skill real já existe |
| `.claude/skills/testsprite/` | DELETE | Stub vazio (2 bytes) |

---

## ESTRUTURA FINAL PROPOSTA — MONOREPO

```
/srv/monorepo/
├── apps/                          # Aplicações production
│   ├── backend/                   # Fastify + tRPC + OrchidORM
│   ├── frontend/                  # React + MUI + TanStack
│   └── perplexity-agent/          # Python + Streamlit + browser-use
│
├── packages/                      # Workspace packages compartilhados
│   ├── typescript-config/         # JSON base/library/react configs
│   ├── ui-mui/                   # Shared MUI components
│   └── zod-schemas/              # Shared Zod schemas
│
├── scripts/                       # Runtime scripts (exECUTÁVEIS)
│   ├── backup.sh
│   ├── deploy.sh
│   ├── health-check.sh
│   ├── mirror-push.sh
│   ├── restore.sh
│   └── sync-env.js
│
├── tests/                         # Testes organizados
│   ├── smoke-tests/
│   ├── e2e/
│   └── integration/
│
├── docs/                          # CÉREBRO DOCUMENTAL (source of truth)
│   ├── core/                      # README, ARCHITECTURE, glossary
│   ├── governance/                # CONTRACT, GUARDRAILS, APPROVAL_MATRIX
│   ├── architecture/              # ADRs, decisions
│   ├── infrastructure/            # NETWORK_MAP, PORTS, SERVICE_MAP
│   ├── specflow/                  # SPEC-*.md, reviews, templates
│   ├── operations/               # Runbooks, procedures, guides
│   ├── mcps/                     # MCP documentation
│   ├── obsidian/                  # Obsidian vault e configs
│   ├── guides/                    # Ferramentas e setups
│   ├── incidents/                # Incident reports
│   └── archive/                   # Docs antigos isolados
│
├── .claude/                       # Claude Code CLI
│   ├── commands/                  # 17 slash commands
│   ├── agents/                    # 31 agents (cursor-loop + specialists)
│   ├── skills/                    # Skills locais + symlinks para ~/.claude/
│   ├── rules/                     # 4 rules (backend, audio, REVIEW, search)
│   ├── workflows/                 # 6 workflows git/scaffold
│   └── hooks/                     # pre-commit (secrets scanner)
│
├── .agent/                        # Antigravity Kit (external, readonly)
│   ├── workflows/                 # 10 workflows REAIS (sem stubs)
│   ├── agents/                    # 18 specialist agents
│   └── skills/                    # 10 skills reais
│
├── .context/                      # AI-CONTEXT sync layer
│   ├── docs/                     # Knowledge index
│   ├── skills/                   # Skills compiladas
│   └── workflow/                 # Plans e status
│
├── .github/                       # GitHub Actions
│   └── workflows/                 # 2 workflows (ci, deploy)
│
├── .gitea/                        # Gitea Actions
│   └── workflows/                 # 6 workflows (ci, deploy, rollback)
│
├── tasks/                         # Pipeline de tasks
│   ├── pipeline.json             # 73 tasks
│   ├── pipeline-state.json       # Estado persistente
│   └── smoke-tests/
│
├── obsidian/                      # Obsidian vault
│
├── .vscode/                       # Editor configs
├── .windsurf/
├── .zed/
├── .cursor/
├── .continue/
├── .cline/
├── .codex/
├── .turbo/
├── .gemini/
├── .cursorrules
│
├── docker-compose.yml
├── docker-compose.gitea-runner.yml
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── CLAUDE.md
├── AGENTS.md
├── README.md
└── .gitignore
```

---

## ESTRUTURA FINAL — docs/ (CÉREBRO DOCUMENTAL)

```
docs/
├── core/                           # Documentação raiz do projeto
│   ├── README.md                  # Índice central
│   ├── ARCHITECTURE.md
│   ├── GLOSSARY.md
│   ├── CONVENTIONS.md
│   ├── CONTRIBUTING.md
│   └── index.md
│
├── governance/                     # Governança organizacional
│   ├── CONTRACT.md                # Non-negotiable principles
│   ├── GUARDRAILS.md              # Forbidden/requires-approval
│   ├── APPROVAL_MATRIX.md
│   ├── CHANGE_POLICY.md
│   ├── DATABASE_GOVERNANCE.md
│   └── ANTI-FRAGILITY.md
│
├── architecture/                   # Decisões arquiteturais
│   ├── ADRs/                      # Architecture Decision Records
│   ├── ARCHITECTURE-MODELS.md
│   └── ARCHITECTURE-MASTER.md
│
├── infrastructure/                 # Infraestrutura e rede
│   ├── NETWORK_MAP.md
│   ├── PORTS.md
│   ├── SERVICE_MAP.md
│   ├── MONITORING.md
│   ├── PARTITIONS.md
│   └── SUBDOMAINS.md
│
├── specflow/                       # Spec-driven development
│   ├── SPEC-*.md                   # Todas as especificações
│   ├── SPEC-TEMPLATE.md
│   ├── reviews/                    # Code reviews
│   ├── SPEC-INDEX.md
│   └── tasks.md
│
├── operations/                     # Operações e runbooks
│   ├── RUNBOOK.md
│   ├── HOMELAB-SURVIVAL-GUIDE.md
│   ├── CI-CD-PATTERNS.md
│   ├── SKILLS/                    # Skills operacionais
│   │   ├── /
│   │   ├── doc-librarian/
│   │   ├── container-health-check.sh
│   │   ├── self-healing.sh
│   │   ├── verify-network.sh
│   │   ├── voice-api.py
│   │   └── tts-bridge.py
│   └── guides/                     # Guias de ferramentas
│       ├── gitea-coolify/
│       ├── /
│       ├── security-hardening/
│       └── manutencao-continua/
│
├── mcps/                          # MCP documentation
│   ├── MCP_BLUEPRINT.md
│   ├── AI_CONTEXT_MCP.md
│   └── MCP_TOKENS_GUIDE.md
│
├── obsidian/                       # Interface Obsidian
│   ├── vault-config/
│   ├── plugins/
│   └── INDEX.md
│
├── incidents/                      # Relatórios de incidente
│   └── INCIDENT-2026-04-09-*.md
│
├── context/                       # AI context docs
│   └── AI-CONTEXT.md
│
└── archive/                        # Docs antigos isolados
    ├── logs/
    ├── test-results/
    └── legacy/
```

---

## ESTRUTURA FINAL — .claude/

```
.claude/
├── CLAUDE.md                      # Este arquivo (project rules)
├── commands/                      # 17 slash commands
│   ├── code-review.md
│   ├── commit.md
│   ├── cursor-loop.md             # SPEC-CURSOR-LOOP.md
│   ├── dv.md
│   ├── feature.md                 # → .agent/workflows/git-feature.md
│   ├── hg.md
│   ├── img.md
│   ├── next-task.md
│   ├── pg.md
│   ├── plan.md
│   ├── rs.md
│   ├── scaffold.md                # → .agent/workflows/scaffold.md
│   ├── sec.md
│   ├── ship.md                    # → .agent/workflows/git-ship.md
│   ├── ss.md
│   ├── turbo.md                  # → .agent/workflows/git-turbo.md
│   └── update-docs.md
│
├── agents/                        # 31 agents
│   ├── cursor-loop-leader.md
│   ├── cursor-loop-giteaai.md
│   ├── cursor-loop-research.md
│   ├── cursor-loop-refactor.md
│   ├── cursor-loop-spec.md
│   ├── cursor-loop-debug.md
│   ├── cursor-loop-ship.md
│   ├── cursor-loop-review.md
│   ├── cursor-loop-sync.md
│   ├── cursor-loop-mirror.md
│   ├── backend-specialist.md
│   ├── frontend-specialist.md
│   ├── security-auditor.md
│   ├── code-reviewer.md
│   ├── refactoring-specialist.md
│   ├── test-writer.md
│   ├── bug-fixer.md
│   ├── performance-optimizer.md
│   ├── devops-specialist.md
│   ├── documentation-writer.md
│   ├── database-specialist.md
│   ├── mobile-specialist.md
│   ├── planner.md
│   ├── debugger.md
│   ├── researcher.md
│   ├── reviewer.md
│   ├── feature-developer.md
│   ├── implementer.md
│   ├── mcp-operator.md
│   ├── architect-specialist.md
│   ├── orchestrator.md
│   └── reviewer.md
│
├── skills/                        # Skills locais + symlinks
│   ├── api-design/
│   ├── browser-dev/
│   ├── bug-investigation/
│   ├── code-review/
│   ├── commit-message/
│   ├── context-prune/
│   ├── cost-reducer/
│   ├── create-skill/
│   ├── customer-support/
│   ├── deploy-validate/
│   ├── documentation/
│   ├── feature-breakdown/
│   ├── frontend-design/
│   ├── human-gates/
│   ├── know-me/
│   ├── mcp-health/
│   ├── n8n/
│   ├── pipeline-gen/
│   ├── pr-review/
│   ├── refactoring/
│   ├── repo-scan/
│   ├── researcher/
│   ├── scalability/
│   ├── secrets-audit/
│   ├── security/
│   ├── security-audit/
│   ├── self-healing/
│   ├── smoke-test-gen/
│   ├── snapshot-safe/
│   ├── test-generation/
│   ├── trigger-dev/
│   └── vision-local.md
│
├── rules/                         # 4 rules
│   ├── backend.md
│   ├── .md
│   ├── REVIEW-SKILLS.md
│   └── search.md
│
├── workflows/                     # 6 workflows (ponte para .agent/)
│   ├── GIT-WORKFLOWS.md
│   ├── git-feature.md
│   ├── git-mirror-gitea-github.md
│   ├── git-ship.md
│   ├── git-turbo.md
│   ├── scaffold.md
│   └── sincronizar-tudo.md
│
└── hooks/
    └── pre-commit                 # Secrets scanner (executável)
```

---

## ESTRUTURA FINAL — .agent/

```
.agent/                            # Antigravity Kit (EXTERNAL, readonly)
├── SKILL.md                       # Documentation
├── README.md
├── agents/                        # 18 agents
│   ├── architect-specialist.md
│   ├── backend-specialist.md
│   ├── bug-fixer.md
│   ├── code-reviewer.md
│   ├── database-specialist.md
│   ├── debugger.md
│   ├── devops-specialist.md
│   ├── documentation-writer.md
│   ├── feature-developer.md
│   ├── frontend-specialist.md
│   ├── mobile-specialist.md
│   ├── module-architect.md
│   ├── orchestrator.md
│   ├── performance-optimizer.md
│   ├── refactoring-specialist.md
│   ├── security-auditor.md
│   └── test-writer.md
│
├── skills/                        # 10 skills
│   ├── api-patterns/
│   │   ├── SKILL.md
│   │   ├── auth.md
│   │   ├── response.md
│   │   ├── rest.md
│   │   └── trpc.md
│   ├── architecture/
│   ├── behavioral-modes/
│   ├── clean-code/
│   ├── database-design/
│   ├── frontend-design/
│   ├── nextjs-react-expert/
│   ├── nodejs-best-practices/
│   ├── port-governance/
│   └── systematic-debugging/
│
└── workflows/                     # 10 workflows REAIS (sem stubs)
    ├── GIT-WORKFLOWS.md
    ├── code-review-workflow.md
    ├── debug.md
    ├── git-feature.md
    ├── git-mirror-gitea-github.md
    ├── git-ship.md
    ├── git-turbo.md
    ├── scaffold.md
    ├── sincronizar-tudo.md
    └── ui-ux-pro-max.md
```

---

## MATRIZ KEEP / MOVE / MERGE / ARCHIVE / DELETE / REWRITE

### DELETE (execução imediata)
| Path | Prioridade |
|------|------------|
| `trigger-gitea.txt` | IMMEDIATE |
| `.npmrc` | IMMEDIATE |
| `.Trash-1000/` | IMMEDIATE |
| `apps//` | IMMEDIATE |
| `.claude/skills/testsprite/` | IMMEDIATE |
| `.claude/skills/spec-driven-development/` | IMMEDIATE (broken symlink) |

### ARCHIVE (mover para docs/archive/)
| Path | Destino |
|------|---------|
| `logs/` | `docs/archive/runtime-logs/` |
| `test-results/` | `docs/archive/test-results/` |
| `docs/logs/` | `docs/archive/runtime-logs/` (se não existir) |

### MERGE STUBS (10 dirs .agent/workflows/* → .claude/skills/*)
| Stub Path | Target |
|-----------|--------|
| `.agent/workflows/api-design/` | `.claude/skills/api-design/` |
| `.agent/workflows/bug-investigation/` | `.claude/skills/bug-investigation/` |
| `.agent/workflows/code-review/` | `.claude/skills/code-review/` |
| `.agent/workflows/commit-message/` | `.claude/skills/commit-message/` |
| `.agent/workflows/documentation/` | `.claude/skills/documentation/` |
| `.agent/workflows/feature-breakdown/` | `.claude/skills/feature-breakdown/` |
| `.agent/workflows/pr-review/` | `.claude/skills/pr-review/` |
| `.agent/workflows/refactoring/` | `.claude/skills/refactoring/` |
| `.agent/workflows/security-audit/` | `.claude/skills/security-audit/` |
| `.agent/workflows/test-generation/` | `.claude/skills/test-generation/` |

### LIMPEZA DE CACHE
| Path | Ação |
|------|------|
| `runner/data/actcache/cache` | LIMPAR (diretório vazio) |
| `build.log` | DELETE (artefacto antigo) |
| `development-plan.md` | ARCHIVE → `docs/archive/development-plan-2026-03.md` |
| `data/` | ARCHIVE → `docs/archive/empty-data-dir/` |

---

## PLANO DE PRUNE SEGURO

### Fase Prune (execução via cursor-loop, 3 agents)

**Agent 1: Delete Crew**
```
- Remove trigger-gitea.txt
- Remove .npmrc
- Remove .Trash-1000/
- Remove apps//
- Remove .claude/skills/testsprite/
- Remove .claude/skills/spec-driven-development/
```

**Agent 2: Archive Crew**
```
- Move logs/ → docs/archive/runtime-logs/
- Move test-results/ → docs/archive/test-results/
- Move build.log → docs/archive/
- Move development-plan.md → docs/archive/
- Limpar runner/data/actcache/cache
```

**Agent 3: Merge Crew**
```
- Para cada stub em .agent/workflows/*/ → criar symlink em .claude/skills/
- Ou copiar conteúdo real para .claude/skills/ e remover stub
- Validar que comandos ainda funcionam
```

---

## PLANO DE PRESERVAÇÃO DO CÉREBRO MD

### Reorganização docs/ (execução via cursor-loop, 2 agents)

**Agent 4: Docs Reorg Crew**
```
1. Criar docs/core/ se não existir
2. Mover README.md, ARCHITECTURE.md, GLOSSARY.md → docs/core/
3. Criar docs/governance/ se não existir
4. Mover arquivos de GOVERNANCE/ → docs/governance/
5. Criar docs/infrastructure/ se não existir
6. Mover arquivos de INFRASTRUCTURE/ → docs/infrastructure/
7. Criar docs/obsidian/ se não existir
8. Documentar estrutura Obsidian em docs/obsidian/
9. Criar docs/archive/ se não existir
10. Atualizar docs/index.md
```

### Indexes (atualizar)

**Agent 5: Index Crew**
```
1. Atualizar docs/index.md com nova estrutura
2. Atualizar .context/docs/ com novos paths
3. Atualizar obsidian/ vault com novos índices
4. Gerar docs/specflow/SPEC-INDEX.md atualizado
```

---

## PLANO DE SANEAMENTO DE RUNTIME

### Apps Cleanup
```
- apps// → DELETE (vazio)
- apps/orchestrator/ → AVALIAR (pode ser futuro, manter mas noted)
```

### CI/CD Alignment
```
- Sincronizar .github/workflows/ que estão só no .gitea/
  - code-review.yml
  - deploy-main.yml
  - rollback.yml
- Adicionar PreToolUse hooks se necessário
```

### Hooks Enhancement
```
- Documentar ausência de PreToolUse/PostToolUse hooks
- Opcional: criar settings.json para ativar hooks
```

---

## PLANO DE EXTRAÇÃO DO TEMPLATE

### Template Structure
```
template/
├── .claude/                       # Commands, agents, skills, rules, workflows
├── .github/workflows/             # CI/CD mínimo
├── docs/                          # Documentação template
├── apps/                          # App skeleton
├── packages/                      # Package skeleton
├── scripts/                       # Scripts mínimos
├── tests/                         # Test skeleton
├── CLAUDE.md                      # Project rules
├── AGENTS.md                      # Agent definitions
├── README.md                      # Template README
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── .gitignore
```

### Template Extract Steps
```
1. Criar /template como sibling do monorepo
2. Copiar estrutura .claude/ (comuns)
3. Copiar estrutura docs/ (template version)
4. Copiar configs (package.json, pnpm-workspace.yaml, turbo.json)
5. Criar README-template.md
6. Documentar como usar como template
```

---

## COMMITS ATÔMICOS SUGERIDOS

### Batch 1: Delete Junk (1 commit)
```
DELETE: trigger-gitea.txt, .npmrc, .Trash-1000/, apps//, testsprite/, broken symlink
```

### Batch 2: Archive Old (1 commit)
```
ARCHIVE: logs/, test-results/, build.log, development-plan.md
```

### Batch 3: Merge Stubs (1 commit)
```
MERGE: 10 stub dirs .agent/workflows/*/ → .claude/skills/
```

### Batch 4: Reorg Docs (1 commit)
```
REORG: docs/core/, docs/governance/, docs/infrastructure/, docs/obsidian/
```

### Batch 5: Cleanup Runtime (1 commit)
```
CLEANUP: empty dirs, cache, noted apps/orchestrator/
```

### Batch 6: CI/CD Sync (1 commit)
```
SYNC: code-review.yml, deploy-main.yml, rollback.yml → .github/workflows/
```

### Batch 7: Template Extract (1 commit)
```
TEMPLATE: extract template/ structure
```

---

## ORDEM DE EXECUÇÃO POR FASES

### Fase 1: Prune (execute NOW via cursor-loop)
- Batch 1: DELETE
- Batch 2: ARCHIVE
- Batch 3: MERGE stubs

### Fase 2: Reorganize Docs (cursor-loop agents)
- Batch 4: REORG docs/

### Fase 3: Runtime Cleanup (cursor-loop agents)
- Batch 5: CLEANUP runtime
- Batch 6: CI/CD sync

### Fase 4: Template (cursor-loop agents)
- Batch 7: Extract template

### Fase 5: Validate (1 agent)
- Verify all commands work
- Verify workflows valid
- Verify docs index updated

---

## RISCOS E CUIDADOS

| Risco | Mitigação |
|-------|-----------|
| Apagar docs úteis | WHITELIST explícito de KEEP antes de qualquer DELETE |
| Broken symlinks pós-move | Validar todos os symlinks após reorg |
| Commands quebrados | Testar cada command após mover arquivos |
| Obsidian vault quebrado | Backup do vault antes de qualquer reorg |
| Perplexity-agent quebrado | Verificar referências antes de mover |
| Pipeline.json quebrado | Verificar paths após reorg |

**REGRA DE OURO:** Antes de apagar qualquer coisa, verificar se está em WHITELIST (KEEP list).

---

## RESULTADO FINAL ESPERADO

| Métrica | Antes | Depois |
|---------|-------|--------|
| Docs organizados | 150+ em salada | docs/core/, governance/, infra/, specflow/, ops/ |
| Stubs operacionais | 10+ stubs vazios | 0 stubs vazios |
| Broken symlinks | 1 (spec-driven-development) | 0 broken symlinks |
| Empty dirs | 5+ | 0 |
| CI/CD workflows | Fragmentados (Gitea + GitHub) | Sincronizados |
| Template | Nenhum | Extraído para /template |
| Obsidian | Parcialmente indexado | Index completo em docs/obsidian/ |
| Comandos | 17 funcionais | 17 funcionais + validados |

---

## SUCCESS CRITERIA

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | Zero broken symlinks | `find . -type l ! -exec test -e {} \; -print` |
| SC-2 | Docs reorganizados | `ls docs/` mostra core/, governance/, infra/, specflow/ |
| SC-3 | Zero empty stubs | `find . -empty -type d` |
| SC-4 | Commands still work | Testar cada command manualmente |
| SC-5 | CI/CD workflows valid | `docker compose -f docker-compose.yml config` |
| SC-6 | Obsidian index updated | `obsidian-cli index --regenerate` |
| SC-7 | Template extracted | `/template` existe com estrutura |

---

## OPEN QUESTIONS

| # | Question | Blocks |
|---|----------|--------|
| OQ-1 | `.agent/workflows/stubs/` — remover dirs ou manter vazios como skeletor? | Batch 3 |
| OQ-2 | `apps/orchestrator/` — apagar ou manter como placeholder futuro? | Batch 5 |
| OQ-3 | Template deve ser extraído como `/template` ou como separate git repo? | Batch 7 |
| OQ-4 | PreToolUse/PostToolUse hooks — ativar ou documentar apenas? | CI/CD |

---

**Última atualização:** 2026-04-09
**Autores:** 5 agents de auditoria parallel + will
