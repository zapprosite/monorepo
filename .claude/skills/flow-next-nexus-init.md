---
name: flow-next-nexus-init
description: Inicializa Nexus workflow — lê SPEC, mostra modos/agentes, printing quick reference
trigger: /flow-next
version: 1.0.0
type: skill
---

# /flow-next — Nexus Workflow Init

Inicializa o Nexus workflow, lê o SPEC atual, mostra modos e agentes disponíveis, e imprime quick reference.

## Commands

### 1. Inicializar Nexus context

```bash
# Lê SPEC.md do diretório atual ou especifica caminho
SPEC_PATH="${SPEC_PATH:-$(find . -maxdepth 2 -name 'SPEC-*.md' -type f 2>/dev/null | head -1)}"

if [ -f "$SPEC_PATH" ]; then
  echo "📋 SPEC: $SPEC_PATH"
  cat "$SPEC_PATH"
else
  echo "⚠️  Nenhum SPEC.md encontrado. Cria um primeiro com /spec"
fi
```

### 2. Listar modos e agentes

```bash
# Listar todos os 7 modos
echo "=== MODOS NEXUS (7) ==="
echo "debug   — Diagnóstico e troubleshooting"
echo "test    — Testing e validação"
echo "backend — API, services, database"
echo "frontend— UI, components, styling"
echo "review  — Code review e quality gates"
echo "docs    — Documentação"
echo "deploy  — Docker, Coolify, rollback"

echo ""
echo "=== 49 AGENTES DISPONÍVEIS ==="

MODES="debug test backend frontend review docs deploy"
for mode in $MODES; do
  echo ""
  echo "[$mode]"
  case $mode in
    debug)
      echo "  log-diagnostic, stack-trace, perf-profiler, network-tracer"
      echo "  security-scanner, sre-monitor, incident-response"
      ;;
    test)
      echo "  unit-tester, integration-tester, e2e-tester, coverage-analyzer"
      echo "  boundary-tester, flaky-detector, property-tester"
      ;;
    backend)
      echo "  api-developer, service-architect, db-migrator, cache-specialist"
      echo "  auth-engineer, event-developer, file-pipeline"
      ;;
    frontend)
      echo "  component-dev, responsive-dev, state-manager, animation-dev"
      echo "  a11y-auditor, perf-optimizer, design-system"
      ;;
    review)
      echo "  correctness-reviewer, readability-reviewer, architecture-reviewer"
      echo "  security-reviewer, perf-reviewer, dependency-auditor, quality-scorer"
      ;;
    docs)
      echo "  api-doc-writer, readme-writer, changelog-writer, inline-doc-writer"
      echo "  diagram-generator, adr-writer, doc-coverage-auditor"
      ;;
    deploy)
      echo "  docker-builder, compose-orchestrator, coolify-deployer"
      echo "  secret-rotator, rollback-executor, zfs-snapshotter, health-checker"
      ;;
  esac
done
```

### 3. Quick Reference

```
╔════════════════════════════════════════════════════════════════╗
║                    NEXUS QUICK REFERENCE                       ║
╠════════════════════════════════════════════════════════════════╣
║  Workflow:  P → R → E → V → C                                 ║
║  Modes:     debug, test, backend, frontend, review, docs, deploy║
║  Agents:    49 total (7 por modo)                             ║
║  Parallel:  ate 15 workers via vibe-kit                      ║
╠════════════════════════════════════════════════════════════════╣
║  COMMANDS                                                  ║
║  /flow-next              — Este comando                      ║
║  /spec "descricao"       — Criar SPEC.md                    ║
║  /execute "descricao"    — Executar 14 agentes (orchestrator)║
║  nexus.sh --mode list    — Listar agentes                   ║
║  nexus.sh --spec SPEC-X --phase plan   — Iniciar workflow   ║
╠════════════════════════════════════════════════════════════════╣
║  PREVC PHASES                                               ║
║  P (Plan)      — SPEC → queue.json                          ║
║  R (Review)    — Risk assessment + approval                 ║
║  E (Execute)   — 15 workers parallel                        ║
║  V (Verify)    — Test suite + review + quality gates        ║
║  C (Complete)  — Deploy + docs + PR                         ║
╠════════════════════════════════════════════════════════════════╣
║  MODE → AGENT EXAMPLES                                      ║
║  /flow-next --mode debug --agent stack-trace    # Crash     ║
║  /flow-next --mode test --agent unit-tester     # Testes    ║
║  /flow-next --mode backend --agent auth-engineer # Auth JWT ║
║  /flow-next --mode review --agent security-reviewer # Audit ║
╚════════════════════════════════════════════════════════════════╝
```

## Prompts

### Modo: debug
```
Eres debug-agent. Analisa o problema reportado e identifica a root cause.
Modos disponibles: log-diagnostic, stack-trace, perf-profiler, network-tracer, security-scanner, sre-monitor, incident-response.
Output: JSON com { "diagnosis": "...", "root_cause": "...", "fix_suggestion": "..." }
```

### Modo: test
```
Eres test-agent. Cria testes para o código reportado.
Modos disponibles: unit-tester, integration-tester, e2e-tester, coverage-analyzer, boundary-tester, flaky-detector, property-tester.
Output: JSON com { "tests": [...], "coverage": "...", "gaps": [...] }
```

### Modo: backend
```
Eres backend-agent. Implementa a funcionalidade backend descrita.
Modos disponibles: api-developer, service-architect, db-migrator, cache-specialist, auth-engineer, event-developer, file-pipeline.
Output: JSON com { "files_created": [...], "endpoints": [...], "schema_changes": [...] }
```

### Modo: frontend
```
Eres frontend-agent. Implementa o componente UI descrito.
Modos disponibles: component-dev, responsive-dev, state-manager, animation-dev, a11y-auditor, perf-optimizer, design-system.
Output: JSON com { "components": [...], "styles": [...], "tests": [...] }
```

### Modo: review
```
Eres review-agent. Faz code review completo do código reportado.
Modos disponibles: correctness-reviewer, readability-reviewer, architecture-reviewer, security-reviewer, perf-reviewer, dependency-auditor, quality-scorer.
Output: JSON com { "findings": [...], "score": 0-100, "blocking_issues": [...] }
```

### Modo: docs
```
Eres docs-agent. Gera ou atualiza documentação.
Modos disponibles: api-doc-writer, readme-writer, changelog-writer, inline-doc-writer, diagram-generator, adr-writer, doc-coverage-auditor.
Output: JSON com { "documents": [...], "changes": [...], "coverage": "..." }
```

### Modo: deploy
```
Eres deploy-agent. Executa deployment ou operação de infraestrutura.
Modos disponibles: docker-builder, compose-orchestrator, coolify-deployer, secret-rotator, rollback-executor, zfs-snapshotter, health-checker.
Output: JSON com { "deployed": bool, "artifacts": [...], "health_check": "..." }
```

## Usage

```bash
# Inicializar Nexus (mostra tudo)
/flow-next

# Com SPEC específico
SPEC_PATH=docs/SPEC-205.md /flow-next

# Mostrar só agentes de um modo
/flow-next --mode backend

# Mostrar só quick reference
/flow-next --quick-ref
```

## Notes

- Este skill não executa o workflow — apenas inicializa e mostra info
- Para executar: usa `/spec` + `/execute` ou `nexus.sh --phase execute`
- O workflow PREVC completo requer human gates em P→R e V→C