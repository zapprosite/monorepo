---
name: Agentes
description: Lista agentes disponiveis — modos, dominios, especializacoes
trigger: /agentes, list agents, what agents exist, show agents, available agents
version: 1.0.0
deprecated: false
---

# Agentes Skill

Lista agentes disponiveis. Mostra modos, dominios e especializacoes.

## Quando Usar

- Quero saber o que existe
- Preciso de um agente especifico
- Onboarding no projeto
- Apos `/flow-next` para explorar em detalhe

## O que faz

1. **Lista modos** — 7 modos de operacao
2. **Lista agentes** — 49 agentes especializados
3. **Filtra por modo** — debug, test, backend, etc.
4. **Mostra especialidade** — stack, framework, dominio

## Como Executar

```bash
/agentes
/agentes --modo backend
/agentes --lista
```

## 7 Modos de Operacao

| Modo | Foco | Agentes |
|------|------|---------|
| **debug** | Diagnostico e troubleshooting | 7 |
| **test** | Testing e validacao | 7 |
| **backend** | API, services, database | 7 |
| **frontend** | UI, components, styling | 7 |
| **review** | Code review e quality | 7 |
| **docs** | Documentacao | 7 |
| **deploy** | Docker, infra, rollback | 7 |

## 49 Agentes Disponiveis

### Modo: debug
| Agent | Especialidade |
|-------|---------------|
| log-diagnostic | Analise de logs |
| stack-trace | Stack trace analysis |
| perf-profiler | Performance profiling |
| network-tracer | Network debugging |
| security-scanner | Vulnerability scan |
| sre-monitor | SRE metrics e alerts |
| incident-response | Incident handling |

### Modo: test
| Agent | Especialidade |
|-------|---------------|
| unit-tester | Unit tests |
| integration-tester | Integration tests |
| e2e-tester | End-to-end tests |
| coverage-analyzer | Coverage analysis |
| boundary-tester | Boundary conditions |
| flaky-detector | Flaky test detection |
| property-tester | Property-based testing |

### Modo: backend
| Agent | Especialidade |
|-------|---------------|
| api-developer | REST/GraphQL APIs |
| service-architect | Service design |
| db-migrator | Database migrations |
| cache-specialist | Redis/Memcached |
| auth-engineer | JWT, OAuth, auth |
| event-developer | Event-driven arch |
| file-pipeline | File processing |

### Modo: frontend
| Agent | Especialidade |
|-------|---------------|
| component-dev | React/Vue components |
| responsive-dev | Responsive design |
| state-manager | State management |
| animation-dev | Animations e transitions |
| a11y-auditor | Accessibility |
| perf-optimizer | Frontend performance |
| design-system | Design tokens, patterns |

### Modo: review
| Agent | Especialidade |
|-------|---------------|
| correctness-reviewer | Bug detection |
| readability-reviewer | Code clarity |
| architecture-reviewer | System design |
| security-reviewer | Security audit |
| perf-reviewer | Performance review |
| dependency-auditor | Dependency health |
| quality-scorer | Quality metrics |

### Modo: docs
| Agent | Especialidade |
|-------|---------------|
| api-doc-writer | OpenAPI/Swagger |
| readme-writer | README files |
| changelog-writer | Changelog entries |
| inline-doc-writer | JSDoc/comments |
| diagram-generator | Mermaid/diagrams |
| adr-writer | Architecture decisions |
| doc-coverage-auditor | Docs coverage |

### Modo: deploy
| Agent | Especialidade |
|-------|---------------|
| docker-builder | Docker images |
| compose-orchestrator | Docker Compose |
| coolify-deployer | Coolify deploys |
| secret-rotator | Secret rotation |
| rollback-executor | Rollback execution |
| zfs-snapshotter | ZFS snapshots |
| health-checker | Health checks |

## Quick Reference

```
/agentes              — Lista todos
/agentes --modo test — Lista agentes de test
/flow-next            — Inicializa workflow com agentes
/spec                 — Cria SPEC para usar com agentes
```

## Bounded Context

**Faz:**
- Lista agentes disponiveis
- Filtra por modo/especialidade
- Mostra capabilities

**Nao faz:**
- Executa agentes (use comando direto)
- Cria agentes novos
- Assignment de tarefas
