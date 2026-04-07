---
name: Smoke Test Gen
description: Gera smoke tests e curl scripts
trigger: /st
---

# Smoke Test Gen Skill

Gera smoke tests e curl scripts a partir de SPECs.

## Output

### Smoke Tests (`smoke-tests.sh`)
```bash
#!/bin/bash
# Auto-generated smoke tests

echo "=== Smoke Tests ==="

# Test 1: API health
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ "$response" -eq 200 ]; then
  echo "✅ API health: OK"
else
  echo "❌ API health: FAILED (HTTP $response)"
  exit 1
fi
```

### Curl Scripts (`curl-scripts.sh`)
```bash
#!/bin/bash
# API testing scripts

# POST /api/resource
curl -X POST http://localhost:3000/api/resource \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
```

## Como Usar

```bash
/st              # Gera para todas as APIs
/st --spec SPEC-001  # Só para uma SPEC
/st --output ./tests  # Output directory
```

## Regras

1. Um test por acceptance criterion
2. Exit 0 = pass, exit 1 = fail
3. Timeout 5s por request
