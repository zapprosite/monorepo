# Blueprint — SwarmGo + OpenWebUI Integration

> **ID:** UHC-001  
> **Status:** EXECUTABLE  
> **Date:** 2026-05-05  

## 0. Goal

Replace OpenWebUI's native RAG with Swarm Go's enterprise RAG pipeline. Keep OpenWebUI as UI shell. Swarm Go becomes the brain.

## 1. Pre-Flight — Kill List (no mercy)

```bash
# Qdrant zombies
export QDRANT_API_KEY=$(grep '^QDRANT_API_KEY=' /srv/monorepo/.env | cut -d= -f2-)
curl -X DELETE -H "api-key: $QDRANT_API_KEY" http://localhost:6333/collections/will
curl -X DELETE -H "api-key: $QDRANT_API_KEY" http://localhost:6333/collections/mem0migrations

# Legacy scripts
rm -f /srv/monorepo/scripts/ai-context-sync.sh
rm -f /srv/hermes-second-brain/services/sync-engine.py
rm -f /srv/hermes-second-brain/libs/context/ranker.py
rm -rf /srv/hermes-second-brain/services/ /srv/hermes-second-brain/libs/context/

# Dead services
sudo systemctl stop hermes-second-brain 2>/dev/null
sudo systemctl disable hermes-second-brain 2>/dev/null
kill -9 $(lsof -t -i :8642 2>/dev/null) 2>/dev/null
```

## 2. Revive Swarm Go

```bash
# Fix Go (snap is broken)
sudo snap remove go 2>/dev/null || true
curl -sL https://go.dev/dl/go1.23.5.linux-amd64.tar.gz | sudo tar -C /usr/local -xzf -
export PATH=$PATH:/usr/local/go/bin

# Build
cd /srv/monorepo && go build ./...

# Systemd unit
sudo tee /etc/systemd/system/swarm-engine.service << 'EOF'
[Unit]
Description=Swarm Go Engine
After=network.target
[Service]
Type=simple
WorkingDirectory=/srv/monorepo
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/go/bin
EnvironmentFile=/srv/monorepo/.env
ExecStart=/usr/local/go/bin/go run cmd/swarm/main.go
Restart=always
User=will
[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload && sudo systemctl enable swarm-engine --now
sleep 5 && curl -sf http://localhost:8643/health || echo "FAIL"
```

## 3. Connect OpenWebUI

OpenWebUI Admin Panel → Functions → New Function:

```python
import requests

def pipe(user_message, model_id, messages):
    resp = requests.post(
        "http://host.containers.internal:8643/v1/rag",
        json={"query": user_message, "top_k": 5},
        timeout=30
    )
    data = resp.json()
    return {
        "content": data.get("answer", "No answer"),
        "sources": data.get("sources", [])
    }
```

Disable native RAG: Admin → Settings → Documents → RAG → OFF

## 4. Transform Hermes → Gateway

```python
# /srv/hermes-second-brain/apps/api/main.py
from fastapi import FastAPI
import urllib.request, json

app = FastAPI(title="Hermes Gateway", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok", "service": "hermes-gateway"}

@app.post("/context")
def context_proxy(query: str, budget_tokens: int = 1500):
    req = urllib.request.Request(
        "http://localhost:8643/v1/rag",
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())
```

```bash
cd /srv/hermes-second-brain && docker compose up -d --build api
```

## 5. Smoke Tests

```bash
# Swarm health
curl -sf http://localhost:8643/health | jq -e '.status == "ok"'

# Hermes gateway health  
curl -sf http://localhost:8642/health | jq -e '.status == "ok"'

# RAG query
curl -s -X POST http://localhost:8643/v1/rag \
  -H "Content-Type: application/json" \
  -d '{"query":"erro CH 05 LG","top_k":3}' | jq -e '.answer != null'

# OpenWebUI via public endpoint
curl -sf https://chat.zappro.site/health || echo "OpenWebUI check via browser"

# Qdrant no zombies
curl -s http://localhost:6333/collections | jq -e '[.result.collections[].name] | contains(["will"]) | not'
```

## 6. What Stays / What Dies

| Stays | Dies |
|-------|------|
| OpenWebUI (:3456) | sync-engine.py |
| Swarm Go (:8643) | ai-context-sync.sh |
| Hermes Gateway (:8642) | hermes-second-brain.service (:6337) |
| Qdrant (:6333) | Collection `will` |
| Redis (:6379) | Collection `mem0migrations` |
| Ollama (:11434) | libs/context/ranker.py |
| hvac_manuals_v1 | libs/memory/ (isolated Mem0) |

## 7. SRE Rules (enforced)

- R1: No Python does embeddings. Go swarm only.
- R2: No fake vectors. Ollama or nothing.
- R3: OpenWebUI never touches Qdrant direct. Always via swarm.
- R4: Tree-sitter only. Regex parsing prohibited.
- R5: One sync only. `cmd/sync/main.go` (future) or nothing.

## 8. Rollback

If swarm fails: `sudo systemctl stop swarm-engine`. Re-enable OpenWebUI native RAG.
If Hermes fails: `docker compose -f /srv/hermes-second-brain/docker-compose.yml down`
