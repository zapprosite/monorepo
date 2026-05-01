#!/bin/bash
# OpenWebUI Health Check

CONTAINER="open-webui-wbmqefxhd7vdn2dme3i6s9an"
BASE_URL="https://chat.zappro.site"

echo "=== OpenWebUI Health Check ==="

# 1. Container running?
status=$(docker inspect $CONTAINER --format '{{.State.Status}}' 2>/dev/null || echo "missing")
echo "Container: $status"
[ "$status" != "running" ] && exit 1

# 2. Container healthy?
health=$(docker inspect $CONTAINER --format '{{.State.Health.Status}}' 2>/dev/null || echo "none")
echo "Health: $health"

# 3. API responding?
http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 $BASE_URL/ 2>/dev/null || echo "000")
echo "HTTP root: $http_code"

# 4. Get JWT and test API
JWT=$(docker exec $CONTAINER python3 -c "
import urllib.request, json
data = json.dumps({'email': 'admin@openwebui.local', 'password': 'AdminPass123!'}).encode()
req = urllib.request.Request('http://localhost:8080/api/v1/auths/signin', data=data, headers={'Content-Type': 'application/json'}, method='POST')
resp = urllib.request.urlopen(req, timeout=5)
print(json.loads(resp.read()).get('token'))
" 2>&1)

if [ -n "$JWT" ] && [ "$JWT" != "FAIL" ]; then
    echo "Auth: OK"
    models_code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $JWT" $BASE_URL/api/v1/models)
    echo "Models API: $models_code"
else
    echo "Auth: FAIL"
fi

echo "=== Done ==="