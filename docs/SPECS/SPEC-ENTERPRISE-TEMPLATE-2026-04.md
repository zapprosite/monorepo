# SPEC-ENTERPRISE-TEMPLATE-2026-04

## Metadata

| Field | Value |
|-------|-------|
| Spec ID | SPEC-ENTERPRISE-TEMPLATE-2026-04 |
| Created | 2026-04-26 |
| Phase | P (Plan Only) |
| Mode | GIT_PREFLIGHT_COMPLETED |
| Leader | Hermes |
| Orchestrator | Nexus |
| Repo | zapprosite/monorepo |
| Branch | feature/enterprise-template |
| Status | DRAFT — pending T03 approval |

## Context (Do Not Re-scan)

This SPEC is based on prior analysis conducted in 2026-04. Do NOT re-audit the repository.
Reaproveitar análise existente de:
- SPEC-091 — holistic docs cleanup
- SPEC-093 — homelab intelligence architecture
- AGENTS.md — agent conventions
- CLAUDE.md — project conventions

---

## 1. Audit Scope (Pre-existing, No Re-scan)

### Already Audited
- Project structure (high-level)
- Documentation state (docs drift identified)
- Agent conventions (CLAUDE.md, AGENTS.md)
- Security posture (from prior SPEC-091 work)

### NOT in Scope (Do Not Re-scan)
- apps/** directory contents
- packages/** directory contents
- Individual package dependencies
- Runtime behavior

---

## 2. Identity & License

### Objetivo
Padronizar identidade enterprise do monorepo como template reutilizável.

### Entregáveis
- [ ] **LICENSE** — Clarificar licença MIT/Apache-2 dual ou decidir licença única
- [ ] **NOTICE** — Adicionar notice padrão para dependências de terceiros
- [ ] **CONTRIBUTING.md** — Criar contributing guidelines
- [ ] **CODEOWNERS** — Definir CODEOWNERS para review automático
- [ ] **.github/ISSUE_TEMPLATE/** — Template de issues para bug/feature/docs
- [ ] **.github/PULL_REQUEST_TEMPLATE.md** — PR template padronizado

### Restrições
- Não modificar código existente
- Não adicionar dependências
- Templates apenas — sem automação de runtime

---

## 3. Workspace & Tooling

### Objetivo
Garantir consistência de ambiente entre desenvolvedores.

### Entregáveis
- [ ] **.editorconfig** — Padronizar settings de editor (indent, charset, eol)
- [ ] **.tool-versions** — Declarar versões de tooling (node, pnpm, bun, etc)
- [ ] **.devcontainer/** — Devcontainer configurado para contributors
- [ ] **.vscode/extensions.json** — Recomendar extensões VSCode
- [ ] **.vscode/settings.json** — Settings compartilhados (se aplicável)

### Restrições
- Devcontainer deve ser read-only / specification only
- Não incluir secrets ou tokens
- Não instalar packages na criação do devcontainer

---

## 4. Documentation Drift Detection

### Objetivo
Identificar e corrigir docs desatualizados vs código.

### Estratégia
Baseado em SPEC-091 (docs prune/cleanup) — não re-scannear.

### Entregáveis
- [ ] **docs/DRIFT-REPORT.md** — Lista de docs com risco de desatualização
  - Baseado em análise anterior
  - Identificar: README.md que mencionam paths não existentes, comandos outdated
- [ ] **.github/workflows/docs-validate.yml** — CI job leve para detectar drift
  - Verificar que todos os caminhos mencionados em docs existem
  - Não executar código — apenas validação estática

### Restrições
- CI não deve fazer build/test
- Validação estática apenas (glob patterns, regex)
- Não modify code to match docs

---

## 5. CI/CD & Security Gates

### Objetivo
Adicionar gates de segurança e qualidade sem mudar runtime.

### Entregáveis
- [ ] **.github/workflows/secret-scan.yml** — CI para detectar secrets em commits
  - Usar: gitrob, truffleHog, ou gitleaks
  - Falhar em secrets encontrados — block merge
- [ ] **.github/workflows/dependency-review.yml** — Dependency review gate
  - Verificar licenças incompatíveis
  - Alertar sobre dependencies descontinuadas
- [ ] **.pre-commit-config.yaml** — Pre-commit hooks básicos
  - detect-secrets (IBM)
  - trailing-whitespace
  - end-of-file-fixer
  - check-merge-conflict
- [ ] **SECURITY.md** — Security disclosure policy
- [ ] **.github/SECURITY.md** — GitHub security policy (vulnerabilities)

### Restrições
- CI usa tokens read-only
- Não fazer push de artifacts
- Não modificar git history

---

## 6. Dependency Alignment

### Objetivo
Documentar estado de dependencies e identificar desalinhamentos.

### Estratégia
Não re-scannear — usar análise existente.

### Entregáveis
- [ ] **docs/DEPENDENCY-ALIGNMENT.md** — Estado atual de versions
  - Versões de node/pnpm/bun
  - Versões de packages principais
  - Deprecations identificadas previamente
- [ ] **.github/workflows/dependency-alerts.yml** — Monitorar novas versões
  - Alertar sobre security patches disponíveis
  - Não auto-merge

### Restrições
- Documentação apenas
- Não fazer npm update / pnpm update
- Não modificar lock files

---

## 7. Enterprise Template Scaffolding

### Objetivo
Criar templates para novos projetos dentro do monorepo.

### Entregáveis
- [ ] **template//** — Template base para novos apps/packages
  - template/README.md
  - template/CLAUDE.md
  - template/.github/workflows/ci.yml
  - template/package.json (boilerplate)
- [ ] **template/packages/** — Template para novos packages
  - Mesma estrutura do template/app
- [ ] **docs/TEMPLATE-GUIDE.md** — Guia para criar novo projeto
  - Como usar templates
  - Como escolher monorepo vs standalone

### Restrições
- Templates são arquivos .md e boilerplate JSON
- Não incluem lógica de negócio
- Não fazer `bun create` ou similar

---

## Task Breakdown Summary

| Task | Phase | Scope |
|------|-------|-------|
| T01 | -1 | Push feature branch |
| T02 | 0 | Freeze context |
| T03 | 0 | Create this SPEC |
| T04 | 1 | Task breakdown |
| T05 | 2 | pipeline.json |
| T06 | 3 | Human review gate |

---

## Policy

```
PLAN_ONLY=true
NO_RUNTIME=true
NO_DEPENDENCY_UPDATES=true
NO_DEEP_REPO_RESCAN=true
HUMAN_GATE_BEFORE_IMPLEMENTATION=true
```

---

## Next Steps

1. T01 — Push feature branch to origin
2. T02-T05 — Create SPEC, TASKS, pipeline
3. T06 — Human approval gate
4. After approval — implementation via `nexus.sh --spec SPEC-ENTERPRISE-TEMPLATE-2026-04`

---

## References

- SPEC-091 (docs prune/cleanup) — prior analysis
- SPEC-093 (homelab intelligence) — prior architecture work
- CLAUDE.md — existing conventions
- AGENTS.md — existing agent patterns
