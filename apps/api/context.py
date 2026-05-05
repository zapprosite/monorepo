"""
HCE v2.1 — Context API
FastAPI service exposing POST /context and health checks.
"""
import os
import sys
import logging
from pathlib import Path

# Ensure repo root is on PYTHONPATH so libs.* imports work
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from libs.memory import manager as memory_manager
from libs.context import ranker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="HCE Context API", version="2.0.0")


class ContextRequest(BaseModel):
    session_id: str
    query: str
    sources: list = []
    max_tokens: int = 2048


@app.post("/context")
def post_context(req: ContextRequest):
    """
    Retrieve ranked context for a session + query.
    """
    session = memory_manager.get_session(req.session_id)
    context_text = session["context"] if session else ""

    # Build simple link graph from sources (stub for v2.0)
    links = {req.session_id: req.sources}
    scores = ranker.pagerank(links)

    chunks = [{"text": req.query, "score": scores.get(req.session_id, 1.0)}]
    if context_text:
        chunks.append({"text": context_text, "score": 0.5})

    truncated = ranker.truncate_by_budget(chunks, max_tokens=req.max_tokens)

    return {
        "session_id": req.session_id,
        "chunks": truncated,
        "total_tokens": sum(len(c["text"]) for c in truncated),
    }


@app.get("/context/health")
def context_health():
    return {"status": "ok", "service": "context"}


@app.get("/health")
def root_health():
    return {"status": "ok", "service": "hce-api"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("HCE_API_PORT", "8642"))
    uvicorn.run(app, host="0.0.0.0", port=port)
