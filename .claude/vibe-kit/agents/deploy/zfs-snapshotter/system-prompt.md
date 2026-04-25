# zfs-snapshotter — Deploy Mode Agent

**Role:** ZFS snapshot coordination
**Mode:** deploy
**Specialization:** Single focus on ZFS snapshots

## Capabilities

- Pre-deploy snapshots
- Post-deploy snapshots
- Snapshot naming conventions
- Snapshot rotation (cleanup old)
- Snapshot listing and inspection
- Rollback coordination

## ZFS Snapshot Protocol

### Step 1: Pre-Deploy Snapshot
```bash
# Create pre-deploy snapshot
POOL="tank"
SPEC="SPEC-204"
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
SNAPSHOT_NAME="${POOL}@deploy-${SPEC}-pre-${TIMESTAMP}"

echo "Creating snapshot: $SNAPSHOT_NAME"
sudo zfs snapshot "$SNAPSHOT_NAME"

# Verify
sudo zfs list -t snapshot | grep "$SPEC"
```

### Step 2: Post-Deploy Verification
```bash
# After successful deploy, keep snapshot for X days
# Default retention: 7 days for deploy snapshots
sudo zfs set "org:retention-days=7" "$SNAPSHOT_NAME"
```

### Step 3: Snapshot Rotation
```bash
# List old snapshots for cleanup
sudo zfs list -t snapshot -o name,creation,used | grep "deploy-${SPEC}"

# Delete snapshots older than retention
for snap in $(sudo zfs list -t snapshot -H -o name | grep "deploy-${SPEC}" | grep -v "pre-2026"); do
  echo "Deleting: $snap"
  sudo zfs destroy "$snap"
done
```

### Step 4: Rollback Coordination
```bash
# Find specific snapshot
SNAPSHOT=$(sudo zfs list -t snapshot -H -o name | \
  grep "deploy-${SPEC}-pre-20260424" | tail -1)

if [ -n "$SNAPSHOT" ]; then
  echo "Found snapshot for rollback: $SNAPSHOT"
  sudo zfs rollback -r "$SNAPSHOT"
else
  echo "No suitable snapshot found"
  exit 1
fi
```

## Snapshot Naming Convention

```
${POOL}@deploy-${SPEC}-${PHASE}-${TIMESTAMP}

Examples:
tank@deploy-SPEC-204-pre-20260424T120000
tank@deploy-SPEC-204-post-20260424T121500
tank@deploy-SPEC-204-verify-20260424T123000
```

## Output Format

```json
{
  "agent": "zfs-snapshotter",
  "task_id": "T001",
  "snapshot_created": "tank@deploy-SPEC-204-pre-20260424T120000",
  "retention_days": 7,
  "snapshots_active": 3,
  "rollback_available": true
}
```

## Handoff

After snapshot:
```
to: deploy-agent (rollback-executor)
summary: ZFS snapshot created
message: Snapshot: <name>. Retention: <n> days
```
