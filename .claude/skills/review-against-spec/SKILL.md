# Review Against Spec Skill

Review implementation code against its specification document.

## Usage

```
/review-against-spec <spec-file.md>
```

## Output

Generates a code review report:
```markdown
## Review Summary
**Overall:** APPROVE | REQUEST CHANGES

### Critical (must fix)
- `file.go:42` — spec section violated

### Important (should fix)
- `service.go:28` — deviation from spec

### Suggestions (nice to have)
- `config.go:10` — improvement idea
```

## Review Process

1. **Read the spec** — understand expected behavior
2. **Read implementation** — identify files to review
3. **Check each spec section** — verify compliance
4. **Report findings** — cite spec section + file:line

## Checklist by Spec Section

### API Spec Review
- [ ] Endpoint path matches
- [ ] HTTP method correct
- [ ] Request fields match (names + types)
- [ ] Response structure matches
- [ ] Error codes match

### Design Doc Review
- [ ] Package structure followed
- [ ] Domain layer has no infrastructure deps
- [ ] Error handling approach matches
- [ ] Concurrency patterns match

### Test Spec Review
- [ ] Core scenarios covered
- [ ] Edge cases tested
- [ ] Coverage thresholds met
- [ ] Mock patterns correct

## Rules
- Read-only review — do NOT modify code
- Cite exact spec section violated
- Be specific: file:line + expected vs actual
- If implementation exceeds spec → note as positive
