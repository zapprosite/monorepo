# Write Design Doc Skill

Generate a structured design document from a feature description.

## Usage

```
/write-design-doc <feature description>
```

## Output

Creates `docs/specflow/SPEC-XXX-design.md` with:
- Context — why this feature is needed
- Decision — chosen approach and alternatives considered
- Consequences — what becomes easier/harder
- Package structure diagram
- Implementation notes

## Template

```markdown
# Design Document: [Feature Name]

## Context
[Why this feature is needed and the problem it solves]

## Decision
[The chosen approach and rationale]

### Alternatives Considered
- [Alternative 1]: [Why rejected]
- [Alternative 2]: [Why rejected]

## Consequences
### New affordances
-

### Trade-offs
-

## Go Package Structure
```
internal/domain/
  entity.go       # Domain entity
  errors.go       # Domain errors
  repository.go   # Repository interface (in using package)
internal/service/
  service.go      # Business logic
  service_test.go # Tests
internal/handler/
  handler.go      # HTTP handler
  handler_test.go # Tests
```

## Implementation Notes

### Error Handling
[How errors are created, wrapped, and returned]

### Concurrency
[If applicable — goroutines, channels, mutexes]

### Dependencies
[External services, databases, APIs]
```

## Process

1. Parse feature requirements
2. Explore existing codebase for patterns
3. Define package boundaries
4. Document key decisions
5. Write implementation notes
