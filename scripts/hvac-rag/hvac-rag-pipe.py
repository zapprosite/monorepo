#!/usr/bin/env python3
"""
HVAC RAG Pipe — OpenWebUI Pipeline Integration
Receives chat requests, queries Qdrant hvac_manuals_v1, and injects context.
Acts as a filter between OpenWebUI and LiteLLM.
"""

import asyncio
import os
import sys
import json
from typing import Optional
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# =============================================================================
# Configuration
# =============================================================================
QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
EMBEDDING_MODEL = os.environ.get("HVAC_EMBEDDING_MODEL", "nomic-embed-text:latest")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://127.0.0.1:4000/v1")
LITELLM_API_KEY = os.environ.get("LITELLM_API_KEY", "sk-dummy")
COLLECTION_NAME = "hvac_manuals_v1"
PIPELINE_ID = "hvac-rag"
PIPELINE_NAME = "HVAC RAG"
PIPELINE_VERSION = "1.0.0"
PIPELINE_TYPE = "filter"  # 'filter' or 'pipe'

# =============================================================================
# FastAPI App
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[{PIPELINE_NAME}] Started — Qdrant: {QDRANT_URL}, Ollama: {OLLAMA_URL}")
    yield
    print(f"[{PIPELINE_NAME}] Shutdown")

app = FastAPI(title=PIPELINE_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Helpers
# =============================================================================

def qdrant_headers():
    headers = {"Content-Type": "application/json"}
    if QDRANT_API_KEY:
        headers["api-key"] = QDRANT_API_KEY
    return headers

def ollama_headers():
    return {"Content-Type": "application/json"}

def litellm_headers():
    return {
        "Authorization": f"Bearer {LITELLM_API_KEY}",
        "Content-Type": "application/json",
    }

async def get_embedding(text: str) -> Optional[list]:
    """Get embedding via Ollama."""
    async with httpx.AsyncClient(timeout=120) as client:
        # Truncate long texts
        txt = text[:3000]
        for attempt in range(3):
            try:
                r = await client.post(
                    f"{OLLAMA_URL}/api/embeddings",
                    headers=ollama_headers(),
                    json={"model": EMBEDDING_MODEL, "prompt": txt},
                )
                if r.status_code == 200:
                    data = r.json()
                    emb = data.get("embedding") or data.get("embeddings", [[]])[0]
                    if emb and len(emb) > 0:
                        return emb
                elif r.status_code == 500:
                    err = r.json().get("error", "")
                    if "context length" in err.lower():
                        txt = txt[:1500]
                        continue
                return None
            except Exception:
                if attempt < 2:
                    await asyncio.sleep(1)
                    continue
                return None
    return None

async def search_qdrant(query: str, top_k: int = 5, doc_type: str = None, language: str = None) -> list:
    """Search Qdrant for relevant HVAC chunks."""
    emb = await get_embedding(query)
    if not emb:
        return []

    filter_body = None
    must = []
    if doc_type:
        must.append({"key": "doc_type", "match": {"value": doc_type}})
    if language:
        must.append({"key": "language", "match": {"value": language}})
    if must:
        filter_body = {"must": must}

    search_payload = {
        "vector": emb,
        "top": top_k,
        "with_payload": True,
    }
    if filter_body:
        search_payload["filter"] = filter_body

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            r = await client.post(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/search",
                headers=qdrant_headers(),
                json=search_payload,
            )
            if r.status_code == 200:
                hits = r.json().get("result", [])
                return hits
        except Exception:
            pass
    return []

def build_rag_context(hits: list) -> str:
    """Build context string from Qdrant hits."""
    if not hits:
        return ""

    chunks = []
    for i, hit in enumerate(hits):
        payload = hit.get("payload", {})
        doc_type = payload.get("doc_type", "unknown")
        heading = payload.get("heading", "")
        doc_id = payload.get("doc_id", "")
        model_candidates = payload.get("model_candidates", [])
        error_codes = payload.get("error_code_candidates", [])
        text = payload.get("text", "")[:1000]

        chunk_text = f"[Trecho {i+1}]"
        if doc_id:
            chunk_text += f" Manual: {doc_id}"
        if heading:
            chunk_text += f" | Seção: {heading}"
        if doc_type:
            chunk_text += f" | Tipo: {doc_type}"
        if model_candidates:
            chunk_text += f" | Modelos: {', '.join(model_candidates[:3])}"
        if error_codes:
            chunk_text += f" | Códigos de erro: {', '.join(error_codes[:5])}"
        chunk_text += f"\n{text}"

        chunks.append(chunk_text)

    return "\n\n".join(chunks)

# =============================================================================
# System Prompt
# =============================================================================

SYSTEM_PROMPT = """Você é um assistente técnico de manutenção de ar-condicionado inverter.

MODO ATUAL: manual_strict.

REGRAS:
1. Responda em português do Brasil.
2. Use SOMENTE os trechos recuperados da base HVAC abaixo como fonte.
3. Sempre cite o manual, seção, modelo ou chunk quando disponível no formato [Trecho N].
4. Se a base não tiver informação suficiente, diga: "não encontrei isso nos manuais indexados".
5. NUNCA invente valores de tensão, resistência, pressão, frequência, corrente ou carga de fluido refrigerante.
6. Se a pergunta envolver placa inverter, IPM, ponte de diodos, compressor, alta tensão, capacitor ou barramento/link DC:
   - AVISE que o procedimento envolve risco elétrico
   - RECOMENDE técnico qualificado
   - ORIENTE seguir o manual do modelo específico
   - NÃO detalhe medição energizada se o manual não trouxer procedimento explícito
7. Se faltar modelo completo da unidade interna/externa, PEÇA o modelo completo antes de concluir.
8. Separe a resposta em seções claras.

CONTEXTO DOS MANUAIS HVAC RECUPERADOS:
{context}

---

Responda com base apenas no contexto acima."""


def format_system_prompt(context: str) -> str:
    """Format system prompt with RAG context."""
    if context:
        return SYSTEM_PROMPT.format(context=context)
    else:
        return SYSTEM_PROMPT.format(context="[Nenhum trecho encontrado na base HVAC]")


# =============================================================================
# OpenWebUI Pipeline API Endpoints
# =============================================================================

class PipelineInfo(BaseModel):
    id: str
    name: str
    version: str
    type: str

@app.get("/pipelines")
async def list_pipelines():
    """List available pipelines."""
    return [
        {
            "id": PIPELINE_ID,
            "name": PIPELINE_NAME,
            "version": PIPELINE_VERSION,
            "type": PIPELINE_TYPE,
        }
    ]

@app.get(f"/{PIPELINE_ID}/valves")
async def get_valves():
    """Get pipeline configuration (valves)."""
    return {
        "top_k": 5,
        "doc_type_filter": "",
        "language_filter": "",
    }

@app.get(f"/{PIPELINE_ID}/valves/spec")
async def get_valves_spec():
    """Get pipeline valves specification."""
    return {
        "top_k": {
            "type": "int",
            "default": 5,
            "min": 1,
            "max": 20,
            "description": "Número de trechos a recuperar"
        },
        "doc_type_filter": {
            "type": "str",
            "default": "",
            "description": "Filtrar por tipo de documento (e.g., service_manual)"
        },
        "language_filter": {
            "type": "str",
            "default": "",
            "description": "Filtrar por idioma (e.g., pt-BR)"
        },
    }

@app.post(f"/{PIPELINE_ID}/filter/inlet")
async def filter_inlet(request: Request):
    """
    OpenWebUI pipeline inlet filter.
    Receives the chat request, queries Qdrant, and modifies the system prompt.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Extract user message
    messages = body.get("messages", [])
    user_query = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_query = msg.get("content", "")
            break

    if not user_query:
        # No user message, pass through
        return body

    # Query Qdrant
    hits = await search_qdrant(user_query, top_k=5)

    # Build context
    context = build_rag_context(hits)

    # Format system prompt with context
    enriched_system_prompt = format_system_prompt(context)

    # Update system message in the body
    # OpenWebUI typically uses a 'system' message at the beginning
    messages_updated = False
    for i, msg in enumerate(messages):
        if msg.get("role") == "system":
            messages[i]["content"] = enriched_system_prompt
            messages_updated = True
            break

    if not messages_updated:
        # Prepend system message
        messages.insert(0, {
            "role": "system",
            "content": enriched_system_prompt
        })

    # Update body with enriched messages
    body["messages"] = messages

    # Log the retrieval
    hit_count = len(hits)
    if hits:
        top_score = hits[0].get("score", 0)
    else:
        top_score = 0

    print(f"[{PIPELINE_NAME}] query='{user_query[:60]}...' hits={hit_count} top_score={top_score:.3f}")

    return body

@app.post(f"/{PIPELINE_ID}/filter/outlet")
async def filter_outlet(request: Request):
    """
    OpenWebUI pipeline outlet filter.
    Receives the model response and can modify it.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Pass through unchanged for now
    return body


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "pipeline": PIPELINE_NAME}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": PIPELINE_NAME,
        "version": PIPELINE_VERSION,
        "id": PIPELINE_ID,
        "type": PIPELINE_TYPE,
    }


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import asyncio

    port = int(os.environ.get("PIPELINE_PORT", "4017"))
    host = os.environ.get("PIPELINE_HOST", "0.0.0.0")

    print(f"[{PIPELINE_NAME}] Starting on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")
