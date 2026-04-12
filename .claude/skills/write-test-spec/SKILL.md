# Write Test Spec Skill

Generate a structured test specification document from a feature description.

## Usage

```
/write-test-spec <feature description>
```

## Output

Creates `docs/specflow/SPEC-XXX-test.md` with:
- Test scenarios (happy path + edge cases)
- Input/output examples
- Coverage thresholds
- Test categories

## Template

```markdown
# Test Specification: [Feature Name]

## Test Categories

### Unit Tests
Tests for core business logic in isolation.

### Integration Tests
Tests for handler → service → repository flow.

### Edge Cases
Boundary conditions and error scenarios.

## Test Scenarios

### Scenario 1: [Name]
- **Given:** [precondition]
- **When:** [action]
- **Then:** [expected result]

### Scenario 2: [Name]
- **Given:** [precondition]
- **When:** [action]
- **Then:** [expected result]

## Coverage Thresholds

| Layer | Threshold |
|-------|-----------|
| Domain | ≥ 80% |
| Service | ≥ 70% |
| Handler | ≥ 60% |

## Test Data

```go
// Valid input
validRequest := Request{
    Name:  "John Doe",
    Email: "john@example.com",
}

// Invalid input
invalidRequest := Request{
    Name:  "",
    Email: "not-an-email",
}
```

## Process

1. Parse feature requirements
2. Define test scenarios
3. Specify coverage thresholds
4. Provide test data examples
5. List edge cases
