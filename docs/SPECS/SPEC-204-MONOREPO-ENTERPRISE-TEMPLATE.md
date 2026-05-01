# SPEC-202: Monorepo Enterprise Reorganization

**Status:** draft
**Created:** 2026-05-01
**Author:** Nexus SRE

---

## Contexto

Raiz do monorepo `/srv/monorepo/` tem **74 files + 53 dirs** — organização caótica:

```
/srv/monorepo/
├── 32 .md files no root                    # CLAUDE.md, SPEC*.md, GUIA*, etc
├── SPEC-001 ~ SPEC-008 no root            # Duplicados de docs/SPECS/
├── SPEC-BATCH-FIX*.md no root             # Arquivos batch obsoletos
├── pnpm-lock.yaml.backup-pre-spec010      # 133KB backup órfão
├── playwright.config.ts.bak                # Backup órfão
├── docker-compose.*.yml (6 arquivos)      # Scattered no root
├── pipeline.json, state.json               # State files no root
├── swarm/ (22MB binário)                   # Executável no root
├── .claude-events/ (81KB)                  # Estado local/runtime no root (gitignored)
├── logs/                                   # Diretório de logs no root
├── configs/, config/ (2 dirs)             # Duplicação de config
├── .vscode/, .windsurf/, .zed/, .trae/    # 4 IDE configs no root
└── 56 items totais no root                 # Target: <15
```

## Estrutura Alvo (Enterprise Template)

```
/srv/monorepo/
├── .claude/                    # Agent framework (skills, agents, rules)
├── .github/                    # GitHub configs
├── apps/                       # Aplicações production
│   ├── api/
│   ├── ai-gateway/
│   └── monitoring/
├── packages/                   # Bibliotecas compartilhadas
├── services/                   # Docker services configs
├── ops/                       # → /srv/ops (IaC, terraform, secrets)
├── docs/                       # Documentação enterprise
│   ├── SPECS/                  # SPEC-*.md canonical location
│   ├── GUIDES/
│   ├── GOVERNANCE/
│   └── ARCHITECTURE-OVERVIEW.md
├── scripts/                    # Scripts utilitários
├── smoke-tests/                # Testes de integração
├── .env.example                # Template de variáveis
├── README.md                   # Visão geral do projeto
├── CLAUDE.md                   # Instruções para Claude Code
├── AGENTS.md                   # Definição de agentes
├── tsconfig.base.json          # TS base config
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml         # PNPM workspace
├── .gitignore
└── SECURITY.md
```

**Limpeza:**
- Remover todos os `.md` do root (exceto README.md, CLAUDE.md, AGENTS.md, SECURITY.md)
- Mover SPECs órfãos para `docs/SPECS/`
- Deletar backups (.bak, *.backup-*)
- Deletar state files (pipeline.json, state.json, pipeline-organization.json)
- Mover docker-compose.*.yml para `services/`
- Deletar swarm/ se confirmado sem uso (22MB binário legado)
- Manter .claude-events/ fora do commit; fonte operacional versionada fica em .claude/events/
- Mover logs/ para ops/logs/
- Consolidar configs/ + config/ → ops/configs/
- IDE configs → .vscode/ (escolher melhor, deletar outros)
- Deletar .Trash-1000/

## Regras

1. **NUNCA mover** arquivos de `apps/`, `packages/`, `ops/`, `.claude/`
2. **Preservar** symlinks existentes (edge-tts, hermes, hermes-second-brain, ops)
3. **备份 primeiro** — snapshot ZFS antes de qualquer move
4. **Testar** `pnpm install && pnpm build` após reorganização

## Tasks

- [ ] 1. ZFS snapshot do monorepo
- [ ] 2. Mover SPECs órfãos (SPEC-001~008, SPEC-BATCH-*, SPEC.md) → docs/SPECS/
- [ ] 3. Deletar: pnpm-lock.yaml.backup-*, *.bak, state.json, pipeline*.json
- [ ] 4. Mover docker-compose.*.yml → services/
- [ ] 5. Deletar swarm/ se confirmado sem uso
- [x] 6. Marcar .claude-events/ como estado local/runtime gitignored
- [ ] 7. Mover logs/ → ops/logs/
- [ ] 8. Consolidar configs/ + config/ → ops/configs/
- [ ] 9. IDE configs — manter .vscode/, deletar .windsurf/, .zed/, .trae/
- [ ] 10. Limpar .md duplicados do root (GUIA*, QUICKREF*, development-plan*, REFERENCE*, SRE-DASHBOARD*, etc)
- [ ] 11. Verificar pnpm install && tsc --noEmit
- [ ] 12. Commit e PR

## Cancelamento

Reverter snapshot ZFS se qualquer app quebrar.
