# orchestrator/main.py — JSON-RPC orchestrator tools server
import os, json, sys
sys.path.insert(0, '/app/services/orchestrator')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from tools import HANDLERS

app = FastAPI(title="Hermes Orchestrator")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "orchestrator"}

@app.get("/tools")
def list_tools():
    from tools import TOOLS
    return {"tools": TOOLS}

def json_dumps(obj):
    """JSON serializer that handles datetime objects."""
    from datetime import datetime
    def default(o):
        if isinstance(o, datetime):
            return o.isoformat()
        raise TypeError(f"Object of type {type(o)} is not JSON serializable")
    return json.dumps(obj, default=default)

@app.post("/rpc")
def rpc(body: dict):
    method = body.get("method")
    params = body.get("params", {})
    if method not in HANDLERS:
        return {"error": f"unknown method: {method}"}
    try:
        result = HANDLERS[method](params)
        return {"result": json.loads(result)}
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ORCHESTRATOR_PORT", 8095))
    uvicorn.run(app, host="0.0.0.0", port=port)
