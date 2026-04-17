# /code-review — Universal code review

## Description

5-axis code review: Correctness, Readability, Architecture, Security, Performance.

## Actions

1. Load `universal-code-review` skill
2. Review staged changes: `git diff --staged`
3. Review all changes: `git diff main..HEAD`
4. Check each axis:
   - **Correctness**: logic errors, edge cases, error handling
   - **Readability**: naming, comments, code style
   - **Architecture**: module coupling, dependencies, patterns
   - **Security**: secrets, input validation, auth
   - **Performance**: query efficiency, caching, complexity
5. Generate review report
6. Mark APPROVED / CHANGES_REQUESTED

## Review Criteria

- Follows anti-hardcoded pattern (`process.env`)
- No secrets in code
- Tests included for new logic
- Docs updated if behavior changed

## When

- Before merge to main
- `/ship` pre-flight check
- After `/rr` generates report

## Refs

- `.claude/rules/REVIEW-SKILLS.md`
- `docs/SPECS/CODE-REVIEW-GUIDE.md`
- `universal-code-review` skill
