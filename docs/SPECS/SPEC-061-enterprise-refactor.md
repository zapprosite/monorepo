---
name: SPEC-061-enterprise-refactor
description: Refatoração enterprise de CLAUDE.md e AGENTS.md com 14 agentes de pesquisa
spec_id: SPEC-061
status: IN_PROGRESS
created: 2026-04-17
---

# SPEC-061: Enterprise Refactor — CLAUDE.md + AGENTS.md

## Objetivo

Refatorar CLAUDE.md e AGENTS.md ao nível enterprise, integrando:

- Sistema de orquestrador de 14 agentes (`/execute`)
- Skill-that-calls-skills patterns
- Cron jobs estratégicos diários
- Gitea Actions com credenciais do `.env`
- Padrões April 2026 de skill orchestration

## Tech Stack

- Claude Code CLI (subprocess orchestration)
- Gitea Actions + Gitea API
- Skill format (SKILL.md com YAML frontmatter)
- Bash scripts para coordenação de agentes
- .env como fonte canónica de secrets

## Os 14 Agentes de Pesquisa

| #   | Agent       | Focus                                                                 |
| --- | ----------- | --------------------------------------------------------------------- |
| 1   | RESEARCH-1  | CLAUDE.md enterprise patterns (skill orchestration, cron, delegation) |
| 2   | RESEARCH-2  | AGENTS.md com 14-agent parallel execution patterns                    |
| 3   | RESEARCH-3  | Daily cron strategy para homelab/monorepo                             |
| 4   | RESEARCH-4  | Skill-that-calls-skills patterns (meta-skills)                        |
| 5   | RESEARCH-5  | Gitea Actions best practices + Claude Code CLI integration            |
| 6   | RESEARCH-6  | Memory system patterns para AI agents                                 |
| 7   | RESEARCH-7  | Spec-driven development + pipeline patterns                           |
| 8   | RESEARCH-8  | Security/secrets audit automation patterns                            |
| 9   | RESEARCH-9  | Self-healing + observability patterns                                 |
| 10  | RESEARCH-10 | Documentation drift prevention patterns                               |
| 11  | RESEARCH-11 | Git workflow automation (commit, PR, mirror)                          |
| 12  | RESEARCH-12 | Code review automation patterns                                       |
| 13  | RESEARCH-13 | Skill lifecycle + versioning patterns                                 |
| 14  | RESEARCH-14 | Homelab-specific patterns (ZFS, Docker, Traefik)                      |

## Tarefas de Refatoração

### Task 1: Refatorar CLAUDE.md

- Secção Orchestrator atualizada com `/execute`
- Secção Cron com jobs diários estratégicos
- Skill delegation patterns
- Memory sync integrado
- Anti-alucinação rules

### Task 2: Refatorar AGENTS.md

- 14-agent parallel execution
- Agent coordination via filesystem
- SHIPPER pattern documentado
- Gitea Actions workflow
- Skill-that-calls-skills

### Task 3: Criar SKILL.md do orchestrator

- Documentar `/execute` workflow
- 14 agentes com responsabilidades
- Error handling
- Monitoring commands

### Task 4: Integrar Gitea Credentials

- Usar GITEA_TOKEN do .env
- Usar GITEA_INSTANCE_URL do .env
- Documentar em SKILL.md

## Acceptance Criteria

- [ ] CLAUDE.md com secção `/execute` documentada
- [ ] AGENTS.md com 14-agent patterns
- [ ] Cron jobs documentados e funcionais
- [ ] Skill-that-calls-skills pattern demonstrado
- [ ] Gitea integration via .env credentials
- [ ] Memory sync pós-commit automatizado
- [ ] 14 agentes de pesquisa executados

## Non-Goals

- Não modificar a arquitetura de aplicações
- Não alterar políticas de segurança estabelecidas
- Não criar novos workflows complexos demais
