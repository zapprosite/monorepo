---
trigger: /equipe
purpose: Mostrar guia da equipe
when: Novo membro quer entender
---

# /equipe — Guia da Equipe

## Proposito
Apresentar a estrutura da equipe, papis, e como os agentes especializados trabalham juntos.

## Quando Usar
- "Novo membro quer entender"
- "Como funciona o time?"
- Onboarding
- Entender responsabilidades

## Estrutura da Equipe

### Modos do Nexus (7 agentes por modo = 49 total)

| Modo | Foco | Agentes |
|------|------|---------|
| debug | Troubleshooting | diagnose, reproduce, isolate, fix, verify, document, escalate |
| test | Qualidade | write-tests, run-tests, coverage, quality, security, performance, smoke |
| backend | APIs e Dados | api-design, database, auth, endpoints, middleware, scalability, observability |
| frontend | UI e UX | components, pages, routing, state, styling, accessibility, i18n |
| review | Code Review | style, logic, security, performance, docs, merge, rollback |
| docs | Documentacao | specs, readmes, api-docs, guides, tutorials, changelog, diagrams |
| deploy | DevOps | build, test, stage, prod, monitor, rollback, scale |

### Entry Point
```bash
cd /srv/monorepo && .claude/vibe-kit/nexus.sh --help
```

## Documentacao

| Documento | Local | Descricao |
|-----------|-------|-----------|
| NEXUS_GUIDE | docs/NEXUS_GUIDE.md | Guia completo do framework |
| SPEC-204 | docs/SPEC-204.md | Especificacao técnica |
| CLAUDE.md | CLAUDE.md | Configuracao do projeto |

## Fluxo de Trabalho

1. **Planejar** → `/plan` cria task queue
2. **Executar** → `/flow-next:work` distribui para agentes
3. **Revisar** → `/code-review` valida mudancas
4. **Publicar** → `/ship` sincroniza docs e commita

## Papis dos Agentes

| Papel | Responsabilidade |
|------|------------------|
| planner | Cria e prioriza tasks |
| designer | Define arquitetura |
| developer | Implementa funcionalidades |
| qa | Testa e valida |
| reviewer | Revisa codigo |
| documenter | Mantem documentacao |

## Recursos

- **Dashboard:** `cd /srv/monorepo && .claude/vibe-kit/nexus.sh status`
- **Logs:** `tail -f /srv/monorepo/logs/*.log`
- **Config:** `cat /srv/monorepo/.claude/config.yaml`
