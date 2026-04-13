---
name: Code Review Guide
description: Standards for conducting code reviews in this monorepo
type: guide
---

# Code Review Guide

**Status:** ACTIVE
**Created:** 2026-04-08
**Owner:** will

---

## Overview

This guide establishes the standards for conducting code reviews in the homelab-monorepo. Code reviews are mandatory for all non-documentation changes and follow a 5-axis evaluation framework.

---

## When to Do Code Review

### Required Review Triggers
- All pull requests to `main` or production branches
- Commits containing application code (`apps/`)
- Changes to shared packages (`packages/`)
- Infrastructure as Code changes (`terraform/`, `docker-compose*.yml`)
- Security-sensitive changes (auth, secrets, credentials)

### Optional / Self-Review
- Documentation-only changes (readmes, docs/)
- Configuration file updates (package.json, tsconfig, etc.)
- Chores and refactoring with no behavioral change
- Draft PRs marked as `WIP`

### Pre-Commit Review (Recommended)
Before every `git commit`, run:
```bash
# Quick self-review
git diff --staged

# Check for secrets
/sec
```

---

## The 5 Axes of Code Review

### 1. Correctness

Evaluates: Does the code do what it claims? Are there bugs, edge cases, or logic errors?

| Severity | Description |
|----------|-------------|
| Critical | Logic error, wrong behavior, data corruption risk |
| Important | Bug that causes incorrect output, exception not handled |
| Suggestion | Suboptimal logic, could be cleaner |

**What to check:**
- Function preconditions and postconditions
- Error handling completeness
- Edge case coverage (empty inputs, null values, race conditions)
- Boundary conditions in loops and comparisons

### 2. Readability

Evaluates: Can another developer understand this code without extensive explanation?

| Severity | Description |
|----------|-------------|
| Critical | Code is incomprehensible or intentionally obfuscated |
| Important | Requires significant effort to understand |
| Suggestion | Could be clearer with better naming or comments |

**What to check:**
- Function/variable naming clarity
- Comment quality (why, not what)
- Code structure and organization
- Cyclomatic complexity
- Consistency with project patterns

### 3. Architecture

Evaluates: Does the code fit well within the system design?

| Severity | Description |
|----------|-------------|
| Critical | Violates architectural boundaries, creates circular dependencies |
| Important | Suboptimal design choice, missing abstraction layer |
| Suggestion | Could benefit from better separation of concerns |

**What to check:**
- Separation of concerns (UI / business logic / data access)
- Dependency direction (high-level modules don't depend on low-level)
- Interface usage vs concrete implementations
- State management correctness
- API contract stability

### 4. Security

Evaluates: Are there vulnerabilities, exposed secrets, or compliance issues?

| Severity | Description |
|----------|-------------|
| Critical | Remote code execution, SQL injection, exposed credentials |
| Important | Information disclosure, missing auth, insecure defaults |
| Suggestion | Hardcoded values that should be env vars, weak crypto |

**What to check:**
- Input validation and sanitization
- Authentication and authorization correctness
- Secrets management (no hardcoded credentials)
- SQL injection vectors
- XSS/CSRF protections in web contexts
- Secure defaults

### 5. Performance

Evaluates: Will this code scale? Are there obvious inefficiencies?

| Severity | Description |
|----------|-------------|
| Critical | O(n^2+) algorithms, memory leaks, unbounded loops |
| Important | Inefficient queries, missing indexes, N+1 problems |
| Suggestion | Minor optimization opportunities, caching hints |

**What to check:**
- Algorithmic complexity
- Database query efficiency
- Memory allocation patterns
- Connection pool usage
- Caching opportunities
- Lazy loading vs eager loading

---

## Finding Severity Reference

### Critical
**Action:** Block merge immediately
- Security vulnerabilities
- Data corruption risks
- Complete functional breakage
- Hardcoded secrets

### Important
**Action:** Must fix before merge
- Bugs causing incorrect behavior
- Missing error handling
- Architectural violations
- Performance issues at scale

### Suggestion
**Action:** Consider fixing, not blocking
- Code clarity improvements
- Minor optimizations
- Best practice alignment
- Documentation gaps

---

## File:Line Reference Format

Use the format `path:line` for all file references:

```
# Correct
apps/api/src/routes/users.ts:42
packages/auth/src/token.ts:156

# In context
apps/api/src/routes/users.ts:42-45 (the validateUser function)
```

---

## Fix Recommendation Format

When suggesting fixes, use this structure:

```
**File:** `path/to/file.ext:line`

**Issue:** [Brief description of the problem]

**Current:**
```language
// problematic code
```

**Recommended:**
```language
// fixed code
```

**Rationale:** [Why this fix is better]
```

---

## Review Checklist

### Before Starting
- [ ] Read the PR description and linked issues
- [ ] Understand the scope of changes
- [ ] Identify which files are critical path

### During Review
- [ ] Run the code locally if possible
- [ ] Check tests pass
- [ ] Verify no secrets committed
- [ ] Check for backward compatibility

### After Review
- [ ] Summarize findings by severity
- [ ] Provide actionable fix suggestions
- [ ] Mark approved or request changes
- [ ] Document decisions in review file

---

## Review Output

Each formal review produces a file at:
```
docs/SPECS/reviews/REVIEW-NNN.md
```

Use the template:
```markdown
# REVIEW-NNN: [Title]

**Date:** YYYY-MM-DD
**Reviewer:** will
**Commits Reviewed:** [hash]..[hash]

## Summary

[Brief overview of changes and overall assessment]

## Findings by Axis

### Correctness
| Severity | Location | Issue |
|----------|----------|-------|
| ... | ... | ... |

### Security
...

## Action Items

- [ ] [Critical] Fix X at Y
- [ ] [Important] Consider Z

## Sign-off

[APPROVED / REQUEST_CHANGES]
```

---

## Related Documents

- [SPEC-TEMPLATE.md](../specflow/SPEC-TEMPLATE.md) - Spec format
- [SPEC-README.md](../specflow/SPEC-README.md) - Spec-driven development workflow
- [.agent/workflows/code-review-workflow.md](../../.agent/workflows/code-review-workflow.md) - How to run reviews
- [.claude/rules/REVIEW-SKILLS.md](../../.claude/rules/REVIEW-SKILLS.md) - Review skills reference
