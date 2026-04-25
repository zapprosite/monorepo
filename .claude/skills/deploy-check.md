# /flow-next:deploy-check

**Purpose:** Validate deployment readiness before shipping.

**Trigger phrases:** "Vou fazer deploy", "e seguro fazer deploy", "deploy-check", "posso fazer deploy"

## Checks

1. **Smoke tests pass**
   ```bash
   cd /srv/monorepo && bun test
   ```

2. **No uncommitted changes (or documented)**
   ```bash
   cd /srv/monorepo && git status --porcelain
   ```

3. **Nexus status clean**
   ```bash
   cd /srv/monorepo && .claude/vibe-kit/nexus.sh status 2>/dev/null || echo "Nexus not available"
   ```

4. **SPEC has acceptance criteria**
   ```bash
   cd /srv/monorepo && grep -q "acceptance" SPEC.md 2>/dev/null && echo "OK" || echo "MISSING: acceptance criteria"
   ```

5. **Docs updated**
   ```bash
   cd /srv/monorepo && grep -q "last updated\|changelog" README.md 2>/dev/null || echo "WARN: docs may be stale"
   ```

6. **Version bumped**
   ```bash
   cd /srv/monorepo && git describe --tags 2>/dev/null || echo "No tags found"
   ```

## Output

```
=== Deploy Readiness Check ===

[1] Smoke tests:    PASS/FAIL
[2] Uncommitted:    CLEAN/DIRTY
[3] Nexus status:   CLEAN/ISSUES/N/A
[4] SPEC criteria:  PRESENT/MISSING
[5] Docs:           OK/STALE/N/A
[6] Version:        vX.Y.Z / NONE

RESULT: PASS/FAIL
Issues: (list each failure)
```
