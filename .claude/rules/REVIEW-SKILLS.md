# Code Review Skills Reference

> When to invoke each review skill for maximum effectiveness

---

## Available Skills

### Core Review Skills

| Skill | Invocation | Best For |
|-------|------------|----------|
| `universal-code-review` | `/review` or `/universal-code-review` | General code review, any stack |
| `code-review` | `/code-review` | Focused review, PRs, commits |
| `security-audit` | `/sec` or `/security-audit` | Security-sensitive changes |
| `pr-review` | `/pr-review` | Pull request reviews |

### Specialist Skills

| Skill | Invocation | Best For |
|-------|------------|----------|
| `bug-investigation` | `/bug` | Bug fix reviews |
| `refactoring` | `/refactor` | Refactor PR reviews |
| `test-generation` | `/test` | Verifying test coverage |
| `scalability` | N/A (load if needed) | Performance at scale |
| `security` | N/A (load if needed) | Deep security work |

---

## When to Use Each Skill

### Bug Fixes

**Skill:** `bug-investigation`

**When:**
- Reviewing a PR that fixes a bug
- The commit message mentions `fix:`, `bug:`, or `hotfix:`
- There's a linked issue describing incorrect behavior

**What it checks:**
- Root cause properly addressed
- Same bug can't recur from edge cases
- Tests prove the fix works
- No side effects introduced

**Invocation:**
```
/bug
```

### Refactoring

**Skill:** `refactoring`

**When:**
- PR is marked as `refactor:`
- No functional changes, only code restructuring
- Improving code maintainability

**What it checks:**
- Behavior preserved (before/after equivalent)
- No regression in edge cases
- Improved maintainability actually achieved
- Dependencies properly updated

**Invocation:**
```
/refactor
```

### Security-Sensitive Changes

**Skill:** `security-audit`

**When:**
- Changes to authentication/authorization
- New API endpoints added
- Database schema changes
- Third-party integrations
- Secrets, credentials, or tokens involved
- Input from external sources (webhooks, uploads)

**What it checks:**
- No hardcoded secrets
- Input validation and sanitization
- Authentication enforcement
- Authorization boundaries
- Injection vectors
- Secure defaults

**Invocation:**
```
/sec
```

### Test Coverage Review

**Skill:** `test-generation`

**When:**
- New functionality without tests
- Bug fix without regression tests
- Complex logic lacking coverage
- Before merging feature branches

**What it checks:**
- Core paths have tests
- Edge cases covered
- Error conditions tested
- Integration with existing tests

**Invocation:**
```
/test
```

### Performance Review

**Skill:** `scalability`

**When:**
- New database queries added
- Loops or recursive algorithms
- Large data processing
- Caching opportunities
- API endpoint performance

**What it checks:**
- Algorithmic complexity
- Database query efficiency
- Memory usage patterns
- Connection management
- Caching viability

**Invocation:**
Load skill explicitly if needed for complex performance analysis.

### General Code Review

**Skill:** `universal-code-review`

**When:**
- Any code change that doesn't fit the above categories
- General maintenance
- Dependency updates
- Configuration changes

**What it checks:**
- All 5 axes: Correctness, Readability, Architecture, Security, Performance
- Consistent with project standards
- Documentation updated if needed

**Invocation:**
```
/review
```
or
```
/universal-code-review
```

### Pull Request Review

**Skill:** `pr-review`

**When:**
- Formal PR review for merge to main
- Need to submit review via GitHub API
- Comprehensive PR description available

**What it checks:**
- PR description completeness
- Code quality across all axes
- Test coverage adequacy
- Security implications
- Performance considerations
- Documentation completeness

**Invocation:**
```
/pr-review
```

---

## Decision Tree

```
Is this a security change?
├── YES → Use /sec (security-audit)
└── NO
    ├── Is this fixing a bug?
    │   ├── YES → Use /bug (bug-investigation)
    │   └── NO
    │       ├── Is this a refactor (no behavior change)?
    │       │   ├── YES → Use /refactor
    │       │   └── NO
    │       │       ├── Is this a PR to main/production?
    │       │       │   ├── YES → Use /pr-review
    │       │       │   └── NO
    │       │       │       └── Use /review (universal-code-review)
```

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| Quick self-review | `git diff --staged` |
| Secrets scan | `/sec` |
| Full code review | `/review` |
| Bug fix review | `/bug` |
| Refactor review | `/refactor` |
| PR review | `/pr-review` |
| Test coverage | `/test` |

---

## Related Documents

- [CODE-REVIEW-GUIDE.md](../../docs/SPECS/CODE-REVIEW-GUIDE.md) - Full review standards
- [code-review-workflow.md](../../.agent/workflows/code-review-workflow.md) - How to run reviews
