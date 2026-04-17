---
name: Survey
description: Mapeia estrutura do codebase, tech stack, e entry points
trigger: /survey, survey this codebase, what is this codebase, map structure
version: 1.0.0
deprecated: false
---

# Survey Skill

Mapeia a estrutura do codebase, identifica tech stack e entry points.

## Quando Usar

- Novo projeto ou área desconhecida
- Precisas entender a arquitectura antes de implementar
- Onboarding de novo membro da equipa
- Antes de criar SPEC para nova feature

## Como Executar

```bash
/survey
```

## O que faz

1. **Estrutura** — Descobre módulos, packages, apps
2. **Entry Points** — Identifica main files, routers, handlers
3. **Tech Stack** — Mapeia dependencies (package.json, requirements.txt, etc.)
4. **Git Hotspots** — Ficheiros com maior mudança (churn)
5. **Call Graphs** — Relações entre módulos

## Output

Gera relatório em `docs/SPECS/survey-{date}.md`:

```markdown
# Survey: {project}

## Estrutura
## Tech Stack
## Entry Points
## Módulos Principais
## Git Hotspots (top 10)
## Dependências
## Recomendações
```

## Fontes de Dados

- `ls -la` para estrutura de directorias
- `git log --stat` para churn analysis
- `cat package.json` / `cat requirements.txt` para tech stack
- `grep -r "export" --include="*.ts"` para entry points

## bounded Context

**Faz:**
- Análise estática do codebase
- Relatório estruturado
- Identificação de padrões

**Não faz:**
- Modificações ao código
- Sugestões de refactoring (use `/decide` para isso)
- Implementação de features
