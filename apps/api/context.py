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
from apps.api.rate_limit import rate_limit_dependency
from fastapi import Depends

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="HCE Context API", version="2.0.0")


class ContextRequest(BaseModel):
    session_id: str
    query: str
    sources: list = []
    max_tokens: int = 2048


@app.post("/context", dependencies=[Depends(rate_limit_dependency)])
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


# ── Homelab Context Brain ──────────────────────────────────────────────
# Endpoints para agentes LLM obterem o mapa do homelab sem gastar tokens
# com ls -R, docker ps, ss -tlnp, etc.
# Basta: curl -s http://localhost:8642/context/homelab

_HOMELAB_CONTEXT_DIR = Path("/srv/homelab-context")


def _read_context_file(filename: str) -> str:
    p = _HOMELAB_CONTEXT_DIR / filename
    if p.exists():
        return p.read_text(encoding="utf-8")
    return ""


@app.get("/context/homelab")
def get_homelab_context():
    """Mapa completo do homelab — leia antes de qualquer ação."""
    return {
        "service": "homelab-context",
        "repo": "http://localhost:3300/will-zappro/homelab-context",
        "contract": _read_context_file("CONTRACT.md"),
        "tree": _read_context_file("TREE.md"),
        "ports": _read_context_file("PORTS.md"),
        "services": _read_context_file("SERVICES.md"),
        "gateways": _read_context_file("GATEWAYS.md"),
        "rules": _read_context_file(".rules"),
        "hint": "Leia 'contract' e 'tree' primeiro. Economize tokens: não faça ls -R nem docker ps.",
    }


@app.get("/context/homelab/tree")
def get_homelab_tree():
    return {"tree": _read_context_file("TREE.md")}


@app.get("/context/homelab/ports")
def get_homelab_ports():
    return {"ports": _read_context_file("PORTS.md")}


@app.get("/context/homelab/gateways")
def get_homelab_gateways():
    return {"gateways": _read_context_file("GATEWAYS.md")}


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
