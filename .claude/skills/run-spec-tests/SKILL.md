# Run Spec Tests Skill

Run tests specified in a test specification document.

## Usage

```
/run-spec-tests <spec-file.md>
```

## What It Does

1. Parse coverage thresholds from spec
2. Run unit tests with coverage
3. Run integration tests
4. Run race detector
5. Report results vs thresholds

## Commands

### Run All Tests
```bash
go test -v -race -cover ./...
```

### Run with Coverage Report
```bash
go test -cover -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

### Run Specific Package
```bash
go test -v -race -cover ./internal/service/...
```

### Run Tests by Pattern
```bash
go test -v -run "^TestCreate" ./...
```

## Coverage Thresholds

| Layer | Threshold |
|-------|-----------|
| Domain | ≥ 80% |
| Service | ≥ 70% |
| Handler | ≥ 60% |

## Output Format

```
=== Test Results ===

PASS: TestCreateUser
PASS: TestGetUser
FAIL: TestUpdateUser (missing coverage)

=== Coverage ===

internal/domain/user.go    : 85%  ✓
internal/service/user.go   : 72%  ✓
internal/handler/user.go   : 58%  ✗ (threshold: 60%)

=== Race Detector ===
PASS — no race conditions detected

=== Summary ===
✅ All tests pass
⚠️  Coverage below threshold in handler layer
```

## Process

1. Run `go test -v -race -cover ./...`
2. Parse coverage output
3. Compare against thresholds
4. Run `go test -race` for race detection
5. Report pass/fail with details
