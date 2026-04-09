#!/bin/bash
set -e

BASE_URL="https://chat.zappro.site"
EMAIL="admin@openwebui.local"
PASSWORD="AdminPass123!"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

FAILED=0

# Get JWT token
get_token() {
  docker exec open-webui-wbmqefxhd7vdn2dme3i6s9an python3 -c "
import urllib.request, json
data = json.dumps({'email': '$EMAIL', 'password': '$PASSWORD'}).encode()
req = urllib.request.Request('http://localhost:8080/api/v1/auths/signin', data=data, headers={'Content-Type': 'application/json'}, method='POST')
resp = urllib.request.urlopen(req, timeout=5)
print(json.loads(resp.read()).get('token'))
" 2>&1
}

# Test 1: Authentication (sign-in)
test_auth() {
  echo ""
  echo "=== Test 1: Authentication (sign-in) ==="
  JWT=$(get_token)

  if [ -z "$JWT" ] || [ "$JWT" == "None" ]; then
    echo -e "${RED}FAIL${NC}: No JWT token received"
    FAILED=$((FAILED + 1))
    return 1
  fi

  echo "JWT received: ${JWT:0:30}..."
  echo -e "${GREEN}PASS${NC}"
  echo "$JWT" > /tmp/openwebui_jwt.txt
}

# Test 2: List models
test_models() {
  echo ""
  echo "=== Test 2: List Models ==="
  JWT=$(cat /tmp/openwebui_jwt.txt 2>/dev/null || get_token)

  models=$(curl -s -H "Authorization: Bearer $JWT" "$BASE_URL/api/v1/models")
  count=$(echo "$models" | python3 -c "import sys,json; print(len(json.loads(sys.stdin.read()).get('data',[])))" 2>/dev/null || echo "0")

  echo "Models count: $count"

  if [ "$count" -gt 0 ]; then
    echo -e "${GREEN}PASS${NC}"
  else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
  fi
}

# Test 3: Chat completion
test_chat_completion() {
  echo ""
  echo "=== Test 3: Chat Completion ==="

  JWT=$(cat /tmp/openwebui_jwt.txt 2>/dev/null || get_token)

  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/chat/completions" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "llama3.2",
      "messages": [{"role": "user", "content": "Say hello in one word"}],
      "max_tokens": 20
    }')

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  echo "HTTP Status: $http_code"

  if [ "$http_code" == "200" ]; then
    content=$(echo "$body" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('choices',[{}])[0].get('message',{}).get('content','NOT_FOUND'))" 2>/dev/null || echo "ERROR")
    echo "Response: $content"
    if [ "$content" != "ERROR" ] && [ "$content" != "NOT_FOUND" ]; then
      echo -e "${GREEN}PASS${NC}"
    else
      echo -e "${RED}FAIL${NC}: No content in response"
      FAILED=$((FAILED + 1))
    fi
  else
    echo -e "${RED}FAIL${NC}: HTTP $http_code"
    echo "Body: $body"
    FAILED=$((FAILED + 1))
  fi
}

# Test 4: User list
test_users() {
  echo ""
  echo "=== Test 4: User List ==="

  JWT=$(cat /tmp/openwebui_jwt.txt 2>/dev/null || get_token)

  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/users" \
    -H "Authorization: Bearer $JWT")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  echo "HTTP Status: $http_code"

  if [ "$http_code" == "200" ]; then
    users=$(echo "$body" | python3 -c "import sys,json; print(len(json.loads(sys.stdin.read()).get('data',[])))" 2>/dev/null || echo "0")
    echo "Users count: $users"
    if [ "$users" -gt 0 ]; then
      echo -e "${GREEN}PASS${NC}"
    else
      echo -e "${RED}FAIL${NC}: No users found"
      FAILED=$((FAILED + 1))
    fi
  else
    echo -e "${RED}FAIL${NC}: HTTP $http_code"
    echo "Body: $body"
    FAILED=$((FAILED + 1))
  fi
}

# Cleanup
cleanup() {
  rm -f /tmp/openwebui_jwt.txt
}

# Run all tests
echo "OpenWebUI API Smoke Tests"
echo "========================="
echo "Base URL: $BASE_URL"

trap cleanup EXIT

test_auth
test_models
test_chat_completion
test_users

echo ""
echo "========================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}$FAILED test(s) failed${NC}"
  exit 1
fi
