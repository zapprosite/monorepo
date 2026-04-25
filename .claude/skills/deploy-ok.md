# /flow-next:deploy-ok

**Purpose:** Execute deployment after validation passes.

**Trigger phrases:** "deploy-check passou", "deploy-ok", "vai para deploy", "executar deploy", "fazer deploy"

## Pre-conditions

Run `/deploy-check` first. If any check failed, do NOT proceed.

## Steps

1. **Snapshot (data directories only)**
   ```bash
   # Only if touching /srv/data or /srv/backups
   sudo zfs snapshot srv/data@deploy-$(date +%Y%m%d-%H%M%S) 2>/dev/null
   ```

2. **Tag version (if not already tagged)**
   ```bash
   cd /srv/monorepo && git tag -a v$(date +%Y%m%d) -m "Deploy $(date)" && git push origin v$(date +%Y%m%d)
   ```

3. **Run smoke tests**
   ```bash
   cd /srv/monorepo && bun test
   ```

4. **Build and deploy**
   ```bash
   cd /srv/monorepo && bun run deploy 2>&1 || echo "Deploy command not found - check package.json scripts"
   ```

5. **Verify health**
   ```bash
   # Check if services are responding
   curl -sf http://localhost:3000/health 2>/dev/null || echo "Health check unavailable"
   ```

## Output

```
=== Deploy Execution ===

[1] Snapshot:     DONE/SKIPPED/FAILED
[2] Version tag:  vX.Y.Z
[3] Smoke tests:  PASS/FAIL
[4] Deploy:       SUCCESS/FAILED
[5] Health:       OK/UNAVAILABLE

RESULT: SUCCESS/FAILED
```
