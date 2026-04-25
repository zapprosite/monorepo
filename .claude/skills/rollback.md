# /flow-next:rollback

**Purpose:** Revert last deployment or configuration change.

**Trigger phrases:** "rollback", "reverter", "algo deu errado no deploy", "deploy falhou", "voltar versao anterior"

## Pre-conditions

Identify what needs to be reverted:
- ZFS dataset change
- Git tag revert
- Service config rollback

## Rollback Strategies

### Option A: Git rollback (config or code)

```bash
cd /srv/monorepo
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null)
echo "Reverting to: $PREV_TAG"
git checkout $PREV_TAG
```

### Option B: ZFS rollback (data/datasets)

```bash
# List snapshots
sudo zfs list -t snapshot | grep srv/data

# Rollback (destroys newer snapshots!)
sudo zfs rollback srv/data@<snapshot-name>
```

### Option C: Service restart with previous config

```bash
# Restart with previous version
cd /srv/monorepo
git checkout HEAD^
bun run deploy 2>&1
```

## Verification

After rollback, verify:

1. **Service health**
   ```bash
   curl -sf http://localhost:3000/health 2>/dev/null || echo "Service may be down"
   ```

2. **Tests pass**
   ```bash
   cd /srv/monorepo && bun test
   ```

## Output

```
=== Rollback Execution ===

[1] Strategy:     GIT/ZFS/SERVICE
[2] Target:       <previous state>
[3] Execution:    SUCCESS/FAILED
[4] Verification: PASS/FAIL

RESULT: SUCCESS/FAILED
```
