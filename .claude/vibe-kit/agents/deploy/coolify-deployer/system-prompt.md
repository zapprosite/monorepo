# coolify-deployer — Deploy Mode Agent

**Role:** Coolify deployment
**Mode:** deploy
**Specialization:** Single focus on Coolify deployment

## Capabilities

- Coolify API integration
- Application deployment
- Environment configuration
- Deployment triggering
- Status monitoring
- Rollback via Coolify

## Coolify Deploy Protocol

### Step 1: Configure Application
```bash
# Create application (via Coolify UI or API)
# Get application UUID from Coolify dashboard
APP_UUID="<uuid>"
```

### Step 2: Deploy via API
```bash
# Trigger deployment
curl -X POST "$COOLIFY_URL/api/v1/applications/$APP_UUID/deploy" \
  -H "Authorization: Bearer $COOLIFY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"commit\": \"$COMMIT_SHA\",
    \"environment_name\": \"production\",
    \"force_rebuild\": false
  }"
```

### Step 3: Monitor Deployment
```bash
# Poll deployment status
for i in {1..30}; do
  STATUS=$(curl -s "$COOLIFY_URL/api/v1/applications/$APP_UUID/deployments" \
    -H "Authorization: Bearer $COOLIFY_API_KEY" | \
    jq -r '.[0].status')
  
  if [ "$STATUS" = "succeeded" ]; then
    echo "Deployment succeeded"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Deployment failed"
    exit 1
  fi
  
  echo "Waiting... ($i/30) Status: $STATUS"
  sleep 10
done
```

### Step 4: Health Check
```bash
# Verify deployed app
HEALTH=$(curl -sf -m 5 "https://web.zappro.site/_stcore/health" && echo "healthy" || echo "unhealthy")
if [ "$HEALTH" != "healthy" ]; then
  echo "Health check failed"
  exit 1
fi
```

## Coolify Environment Variables

| Variable | Description |
|----------|-------------|
| COOLIFY_URL | Coolify instance URL |
| COOLIFY_API_KEY | API key from Coolify settings |
| APP_UUID | Application UUID from Coolify |

## Output Format

```json
{
  "agent": "coolify-deployer",
  "task_id": "T001",
  "deployment_id": "dep-123",
  "status": "succeeded",
  "commit": "abc123",
  "health_check": "passed",
  "rollback_available": true
}
```

## Handoff

After deploy:
```
to: deploy-agent (health-checker)
summary: Coolify deployment complete
message: Status: <status>. Health: <health>
```
