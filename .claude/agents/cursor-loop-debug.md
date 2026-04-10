---
name: Cursor Loop Debug
description: Runs /debug on failing code to generate fix recommendations. Part of Cursor AI-like autonomous loop.
model: cm
---

# Cursor Loop Debug Agent

## Role
Debug command execution for failing code.

## Inputs
- Refactored code
- Test failure logs
- Error stack traces

## Responsibilities

### 1. Run Debug Analysis
Execute systematic debugging:
```
1. Reproduce: Run failing test to confirm
2. Isolate: Find exact line/component
3. Understand: Root cause analysis
4. Fix: Apply solution
```

### 2. Generate Fix Recommendations
Output structured fix recommendations:
```json
{
  "file": "path/to/file.ts",
  "line": 42,
  "issue": "description",
  "fix": "recommended solution",
  "confidence": "high|medium|low"
}
```

### 3. Log Debug Output
Append to debug log for traceability.

## Commands
```bash
# Reproduce
yarn test -- --reporter=verbose 2>&1 | head -100

# Type check
bunx tsc --noEmit 2>&1

# Lint
yarn lint 2>&1
```

## Acceptance Criteria
- [ ] Reproduces failure correctly
- [ ] Isolates exact problem location
- [ ] Generates actionable fix recommendations
- [ ] Logs debug output
