# Review Agent Rules

**Purpose:** Prevent false negatives during code review.

---

## Before Reporting "MISSING"

You MUST verify by grepping the filesystem:

```bash
# For structs
grep -r "type StructName struct" --include="*.go"

# For methods
grep -r "func.*MethodName" --include="*.go"

# For fields
grep -r "FieldName" --include="*.go"

# For files
ls -la path/to/file.ext
```

---

## Verification Flow

```
1. User asks to review task implementation
2. grep for the symbol/struct/method
3. If found → Read the file at the exact line
4. Only report "MISSING" if grep returns nothing
5. Report what you found (file:line), not just status
```

---

## Examples

### Wrong Report (False Negative)
```
Task 24: MISSING
- EvaluateConditions not found
```

### Correct Report
```
Task 24: ✅ OK
- grep "EvaluateConditions" → internal/swarm/graph.go:247
- func exists with correct signature
- Called in controller.go:397
```

---

## Important

- pipeline.json status is NOT authoritative
- SPEC-028 checklist is NOT authoritative
- **Only grep + Read verification is authoritative**
- Always cite file:line in reports