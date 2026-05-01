---
name: SPEC-027 Go CI Pipeline
description: Go CI/CD pipeline using Go native tooling (no bash scripts)
type: specification
---

# SPEC-027: Go CI Pipeline

**Status:** DRAFT
**Created:** 2026-04-11
**Updated:** 2026-04-11
**Author:** will
**Related:** SPEC-001, SPEC-026

---

## Objective

Criar um pipeline CI/CD em **Go puro** para build, teste e deploy do hvacr-swarm. Substituir scripts bash por binários Go compilados, permitindo execution cross-platform sem dependência de shell.

**Problema:** Scripts bash são difíceis de manter, não funcionam no Windows, e são hard de testar.

**Solução:** Tool CLI em Go com subcommands para cada ação do pipeline.

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Language | Go 1.22+ | Mínimo Go 1.22 |
| CLI | cobra + viper | Subcommands + config |
| Testing | testing + testify | Go native + assertions |
| HTTP Client | net/http | Sem dependências externas |
| Serialization | encoding/json | Go native |
| Config | viper | YAML/TOML/ENV support |

---

## Commands

```bash
# Build the pipeline tool
go build -o bin/goci ./cmd/goci

# Run all checks (lint + test + build)
./bin/goci all

# Run tests only
./bin/goci test

# Run linter
./bin/goci lint

# Run build
./bin/goci build

# Show version
./bin/goci version
```

---

## Project Structure

```
cmd/goci/
├── main.go           # Entry point
└── cmd/
    ├── root.go       # Root command
    ├── all.go        # all subcommand
    ├── test.go       # test subcommand
    ├── lint.go       # lint subcommand
    └── build.go      # build subcommand

internal/
├── ci/
│   ├── executor.go    # Command executor
│   ├── parser.go     # Output parser (JUnit XML, coverage)
│   └── reporter.go   # CI reporter
├── lint/
│   ├── checker.go    # go vet, staticcheck
│   └── config.go     # Linter config
└── coverage/
    ├── collector.go  # Coverage collector
    └── report.go     # Coverage report generator

pkg/
└── report/
    ├── junit.go      # JUnit XML output
    └── summary.go    # Human-readable summary
```

---

## Code Style

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | `kebab-case.go` | `executor.go`, `junit-report.go` |
| Functions | `camelCase` | `ExecuteCommand()`, `ParseJUnit()` |
| Types/Structs | `PascalCase` | `Executor`, `JUnitReport` |
| Constants | `SCREAMING_SNAKE_CASE` | `EXIT_CODE_ERROR` |
| Packages | `kebab-case` | `internal/ci`, `pkg/report` |

### Go Specific

- Error wrapping: `%w` with `fmt.Errorf`
- Context propagation: always pass `ctx context.Context`
- Graceful shutdown: use `signal.NotifyContext`
- Test naming: `TestFunctionName_Scenario_ExpectedResult`

---

## Testing Strategy

| Level | Scope | Framework |
|-------|-------|-----------|
| Unit | Logic isolada | `testing` + `testify/assert` |
| Integration | Build + exec | `testing` (temp dir) |
| E2E | Pipeline completo | Bash smoke test |

### Coverage Targets

- **Minimum:** 80% line coverage
- **Critical paths:** 100% (executor, reporter)
- **Report:** `go test -coverprofile=coverage.out && go tool cover`

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | Pipeline executa `go vet`, `staticcheck`, `go build` | `./goci lint && ./goci build` |
| SC-2 | Testes passam com coverage > 80% | `go test -coverprofile=c.out ./... && go tool cover` |
| SC-3 | JUnit XML output válido | Parse output with xmllint |
| SC-4 | Cross-compile para linux/amd64 | `GOOS=linux GOARCH=amd64 go build` |
| SC-5 | Pipeline detecta falhas e retorna exit code != 0 | `./goci all; echo $?` |

---

## Open Questions

| # | Question | Impact | Priority |
|---|----------|--------|----------|
| OQ-1 | Devo integrar com GitHub Actions ou manter standalone? | High | Med |
| OQ-2 | Como lidar com secrets (Infisical)? | High | Med |
| OQ-3 | Suporte Windows? | Low | Low |

---

## User Story

Como **devops**, quero um **pipeline CI em Go** para **build e test cross-platform sem bash scripts**.

---

## Goals

### Must Have (MVP)

- [ ] CLI com subcommands: `all`, `test`, `lint`, `build`
- [ ] `go vet` + `staticcheck` para lint
- [ ] `go test` com coverage report
- [ ] `go build` para compilar binário
- [ ] JUnit XML output para CI integration
- [ ] Exit codes corretos (0 = sucesso, != 0 = falha)
- [ ] 80%+ test coverage

### Should Have

- [ ] Config via YAML (goci.yaml)
- [ ] Verbose mode (`-v`)
- [ ] Dry-run mode (`--dry-run`)
- [ ] Parallel execution (`--parallel`)

### Could Have

- [ ] GitHub Actions integration
- [ ] Docker build support
- [ ] Kubernetes deployment

---

## Non-Goals

- Este SPEC **não cobre** deployment para Coolify/K8s (SPEC-007)
- **Não cobre** integração com GitHub Actions nativamente
- **Não cobre** Windows native builds (requer investigação adicional)

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | `./goci all` executa lint + test + build em sequência | Smoke test |
| AC-2 | Exit code 0 em sucesso, != 0 em falha | `bash -c './goci lint; echo $?'` |
| AC-3 | JUnit XML gerado em `./reports/junit.xml` | xmllint validation |
| AC-4 | Coverage report gerado em `./reports/coverage.out` | go tool cover |
| AC-5 | Mensagens de erro claras com sugestão de fix | Manual test |

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Go 1.22+ | REQUIRED | Mínimo no README |
| cobra | REQUIRED | CLI framework |
| viper | REQUIRED | Config management |
| testify | REQUIRED | Assertions |
| staticcheck | REQUIRED | Advanced lint |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-11 | Cobra + Viper | Padrão de fato para CLI Go, maduro e estável |
| 2026-04-11 | Go native net/http | Sem dependências externas para HTTP client |
| 2026-04-11 | JUnit XML output | Compatível com GitHub Actions, Jenkins, etc |

---

## Checklist

- [ ] SPEC written and reviewed
- [ ] Architecture decisions documented (ADR if needed)
- [ ] Acceptance criteria are testable
- [ ] Dependencies identified
- [ ] Tasks generated via `/pg`
- [ ] `go build` verified locally
- [ ] Tests pass with >80% coverage
- [ ] No hardcoded secrets in code
