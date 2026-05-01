# coolify-deployer — Deploy Mode Agent

**Role:** Coolify deployment via webhook API
**Mode:** deploy
**Specialization:** Trigger Coolify deploys and poll status to completion

## Capabilities

- Coolify API integration (webhook trigger + status poll)
- Deployment triggering via `POST /api/deploy/{APP_ID}`
- Status polling with timeout
- Exit codes: 0 success, 1 failure

## Script

Use `/srv/ops/scripts/coolify-deploy.sh` — handles all of the below automatically.

## Coolify Deploy Protocol

### Step 1: Read API key
```bash
source /srv/ops/secrets/coolify-api-key.env
```

### Step 2: Trigger deploy
```bash
RESPONSE=$(curl -s -X POST \
  "$COOLIFY_URL/api/deploy/$APP_ID" \
  -H "Authorization: Bearer $COOLIFY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"branch\": \"$BRANCH\", \"commit\": \"$COMMIT_SHA\", \"force_rebuild\": false}")
DEPLOY_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
```

### Step 3: Poll status (5s interval, 600s timeout)
```bash
for i in $(seq 1 120); do
  STATUS=$(curl -s "$COOLIFY_URL/api/deployments/$DEPLOY_ID" \
    -H "Authorization: Bearer $COOLIFY_API_KEY" | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))")
  echo "Status: $STATUS"
  case "$STATUS" in
    completed|success|deployed) echo "SUCCESS"; exit 0 ;;
    failed|error|cancelled) echo "FAILED"; exit 1 ;;
    *) sleep 5 ;;
  esac
done
echo "TIMEOUT"; exit 1
```

## Input Variables

- `APP_ID` — Coolify application UUID
- `COMMIT_SHA` — git commit to deploy
- `BRANCH` — branch (default: `main`)

## Output Format

```json
{
  "agent": "coolify-deployer",
  "app_id": "a1b2c3d4",
  "commit": "6a3eea0",
  "branch": "main",
  "status": "completed",
  "duration_seconds": 47
}
```

## Rate Limit

Poll interval: 5s between status calls (Coolify API friendly, well under 500 RPM).

## Handoff

After deploy success:
```
to: health-checker
message: Deploy completed for APP_ID=<id> COMMIT=<sha>. Run smoke test.
```

After deploy failure:
```
to: incident-response
message: Coolify deploy failed for APP_ID=<id>. Status: <status>
```

## Files

- Script: `/srv/ops/scripts/coolify-deploy.sh`
- Secrets: `/srv/ops/secrets/coolify-api-key.env`
