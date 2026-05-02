#!/usr/bin/env python3
"""
Haystack RAG Pipeline — SPEC-094
Indexacao de documentos + query retrieval + LLM generation via LiteLLM

Uso:
  python3 haystack-rag-pipeline.py --index ~/Desktop/hermes-second-brain/docs/
  python3 haystack-rag-pipeline.py --query "o que e o Hermes Agent?"
  python3 haystack-rag-pipeline.py --test
  python3 haystack-rag-pipeline.py --health

Stack:
  - LiteLLM :4018 (minimax-m2.7) — chat LLM
  - Ollama :11434 (nomic-embed-text 768D) — embeddings (direto, nao via LiteLLM)
  - Qdrant :6333 — vector store (collection: hermes-knowledge)
"""

import json
import os
import sys
import argparse
import uuid
import httpx
from pathlib import Path

# ─── Anti-hardcoded secrets ───────────────────────────────────────────────────
_hermes_home = Path.home() / ".hermes"
_secrets_path = _hermes_home / "secrets.env"
if _secrets_path.exists():
    with open(_secrets_path) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, _, value = line.partition('=')
                os.environ[key.strip()] = value.strip()

# ─── Config ───────────────────────────────────────────────────────────────────
QDRANT_URL      = "http://127.0.0.1"
QDRANT_PORT     = 6333
QDRANT_INDEX    = os.environ.get("QDRANT_INDEX", "hermes-knowledge")
OLLAMA_URL      = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = "nomic-embed-text"
EMBEDDING_DIM   = 768
LITELLM_URL     = "http://localhost:4018"
LITELLM_MODEL   = "minimax-m2.7"
QDRANT_API_KEY  = os.environ.get("QDRANT_API_KEY", "")
LITELLM_KEY     = os.environ.get("LITELLM_MASTER_KEY", "")

# ─── Qdrant client ─────────────────────────────────────────────────────────────
def _qc():
    from qdrant_client import QdrantClient
    return QdrantClient(url=QDRANT_URL, port=QDRANT_PORT,
                        api_key=QDRANT_API_KEY if QDRANT_API_KEY else None)

# ─── Indexing ─────────────────────────────────────────────────────────────────
def index_documents(sources: list[str], recreate: bool = False) -> dict:
    """Index markdown/txt files into Qdrant with chunking for Ollama context limit."""
    from haystack.dataclasses.document import Document
    from haystack_integrations.document_stores.qdrant import QdrantDocumentStore
    from haystack_integrations.components.embedders.ollama import OllamaDocumentEmbedder
    from qdrant_client.models import Distance, VectorParams, PointStruct

    qc_client = _qc()

    if recreate or not qc_client.collection_exists(QDRANT_INDEX):
        if recreate:
            try:
                qc_client.delete_collection(QDRANT_INDEX)
            except Exception:
                pass
        qc_client.create_collection(
            QDRANT_INDEX,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )
        print(f"Created collection '{QDRANT_INDEX}' (recreate={recreate})")

    docs = []
    for src in sources:
        p = Path(src).expanduser()
        if not p.exists():
            print(f"Source not found: {src}")
            continue
        for fp in p.rglob("*.md"):
            rel = fp.relative_to(p.parent)
            try:
                content = fp.read_text(encoding="utf-8")
                docs.append(Document(
                    content=content,
                    meta={"source": str(rel), "type": _classify_doc(fp)},
                ))
            except Exception as e:
                print(f"Skipping {fp}: {e}")
        for fp in p.rglob("*.txt"):
            rel = fp.relative_to(p.parent)
            try:
                docs.append(Document(
                    content=fp.read_text(encoding="utf-8"),
                    meta={"source": str(rel), "type": "txt"},
                ))
            except Exception:
                pass

    if not docs:
        print("No documents found")
        return {"indexed": 0}

    # Chunk documents to stay within Ollama context limit (~8k tokens)
    CHUNK_SIZE = 3000
    CHUNK_OVERLAP = 200
    all_chunks = []
    for doc in docs:
        content = doc.content
        if len(content) <= CHUNK_SIZE:
            all_chunks.append(doc)
        else:
            for i in range(0, len(content), CHUNK_SIZE - CHUNK_OVERLAP):
                chunk_text = content[i:i + CHUNK_SIZE]
                if len(chunk_text) < 100:
                    break
                chunk_meta = dict(doc.meta)
                chunk_meta["chunk_of"] = str(len(content))
                all_chunks.append(Document(content=chunk_text, meta=chunk_meta))
                if i + CHUNK_SIZE >= len(content):
                    break

    print(f"Indexing {len(all_chunks)} chunks from {len(docs)} docs via Ollama...")
    embedder = OllamaDocumentEmbedder(model=EMBEDDING_MODEL, url=OLLAMA_URL, batch_size=8)
    docs_with_emb = embedder.run(documents=all_chunks)["documents"]

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=d.embedding,
            payload={"content": d.content, "meta": d.meta},
        )
        for d in docs_with_emb
    ]

    qc_client.upsert(QDRANT_INDEX, points=points)
    count = qc_client.count(QDRANT_INDEX).count
    print(f"Indexed {len(points)} chunks -> Qdrant '{QDRANT_INDEX}' ({count} total)")
    return {"indexed": len(points), "total": count}

# ─── Query ───────────────────────────────────────────────────────────────────
def query(question: str, top_k: int = 5) -> dict:
    """RAG query: embed question + retrieve docs + generate answer via LiteLLM."""
    from haystack_integrations.components.embedders.ollama import OllamaTextEmbedder
    from qdrant_client.models import Filter

    qc_client = _qc()

    if not qc_client.collection_exists(QDRANT_INDEX):
        return {"error": f"Collection '{QDRANT_INDEX}' not found. Run --index first."}

    print(f"Searching for: {question}")
    embedder = OllamaTextEmbedder(model=EMBEDDING_MODEL, url=OLLAMA_URL)
    query_vec = embedder.run(text=question)["embedding"]

    results = qc_client.query_points(
        collection_name=QDRANT_INDEX,
        query=query_vec,
        limit=top_k,
        with_payload=True,
    ).points

    if not results:
        return {"answer": "No documents found for this query.", "sources": [], "question": question}

    context_parts = []
    for r in results:
        payload = r.payload or {}
        source = payload.get("meta", {}).get("source", "unknown")
        content = payload.get("content", "")
        context_parts.append(f"## {source}\n{content[:500]}")

    context = "\n\n".join(context_parts)

    prompt = f"""Voce e o Hermes, assistente de IA do William Rodrigues.
Com base nos documentos retrieved, responda a pergunta.
Se a informacao nao estiver nos documentos, diga que nao sabe.

---
Documentos:
{context}

---
Pergunta: {question}
"""

    answer = _llm_generate(prompt)

    return {
        "answer": answer,
        "sources": [
            {"source": (r.payload or {}).get("meta", {}).get("source", "?"), "score": r.score}
            for r in results
        ],
        "question": question,
    }

# ─── LLM ─────────────────────────────────────────────────────────────────────
def _llm_generate(prompt: str) -> str:
    """Call LiteLLM (MiniMax-M2.7) for text generation."""
    if not LITELLM_KEY:
        return "[LLM unavailable: LITELLM_MASTER_KEY not set]"

    try:
        resp = httpx.post(
            f"{LITELLM_URL}/v1/chat/completions",
            json={
                "model": LITELLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
            },
            headers={
                "Authorization": f"Bearer {LITELLM_KEY}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "No response")
        else:
            return f"[LiteLLM error {resp.status_code}: {resp.text[:200]}]"
    except Exception as e:
        return f"[LiteLLM call failed: {e}]"

# ─── Helpers ──────────────────────────────────────────────────────────────────
def _classify_doc(fp: Path) -> str:
    name = fp.stem.lower()
    if "spec" in name or fp.parent.name in ("SPECS", "SPECs"):
        return "spec"
    if "skill" in name or "/skills/" in str(fp):
        return "skill"
    if "guide" in name or "/guides/" in str(fp):
        return "guide"
    if "tree" in name:
        return "tree"
    return "doc"

# ─── Health ───────────────────────────────────────────────────────────────────
def health_check() -> dict:
    """Full stack health check."""
    results = []

    # LiteLLM
    try:
        resp = httpx.get(
            f"{LITELLM_URL}/v1/models",
            headers={"Authorization": f"Bearer {LITELLM_KEY}"},
            timeout=10,
        )
        if resp.status_code == 200:
            models = [m["id"] for m in resp.json().get("data", [])]
            results.append(f"LiteLLM :4018: OK — {models}")
        else:
            results.append(f"LiteLLM :4018: HTTP {resp.status_code}")
    except Exception as e:
        results.append(f"LiteLLM :4018: FAIL — {e}")

    # Ollama
    try:
        import urllib.request
        r = urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=5)
        models = [m["name"] for m in json.loads(r.read()).get("models", [])]
        results.append(f"Ollama :11434: OK — {[m for m in models if 'embed' in m or 'qwen' in m]}")
    except Exception as e:
        results.append(f"Ollama :11434: FAIL — {e}")

    # Qdrant
    try:
        from qdrant_client import QdrantClient
        qc = QdrantClient(url=QDRANT_URL, port=QDRANT_PORT,
                          api_key=QDRANT_API_KEY if QDRANT_API_KEY else None)
        collections = qc.get_collections().collections
        coll_info = []
        for c in collections:
            info = qc.get_collection(c.name)
            coll_info.append(f"{c.name}({info.points_count})")
        results.append(f"Qdrant :6333: OK — {coll_info}")
    except Exception as e:
        results.append(f"Qdrant :6333: FAIL — {e}")

    # Mem0
    try:
        from mem0 import Memory
        from mem0.configs.base import MemoryConfig, LlmConfig, EmbedderConfig, VectorStoreConfig
        os.environ["LITELLM_BASE_URL"] = LITELLM_URL
        os.environ["LITELLM_API_KEY"] = LITELLM_KEY
        config = MemoryConfig(
            llm=LlmConfig(provider="litellm", config={"model": LITELLM_MODEL}),
            embedder=EmbedderConfig(provider="ollama", config={
                "model": EMBEDDING_MODEL,
                "embedding_dims": EMBEDDING_DIM,
                "ollama_base_url": OLLAMA_URL,
            }),
            vector_store=VectorStoreConfig(
                provider="qdrant",
                config={
                    "collection_name": "mem0",
                    "url": QDRANT_URL,
                    "port": QDRANT_PORT,
                    "api_key": QDRANT_API_KEY,
                    "embedding_model_dims": EMBEDDING_DIM,
                }
            ),
            history_db_path=str(Path.home() / ".mem0" / "history.db"),
        )
        m = Memory(config=config)
        r = m.search("test", filters={"user_id": "will"})
        results.append(f"Mem0: OK — {len(r.get('results', []))} facts found")
    except Exception as e:
        results.append(f"Mem0: FAIL — {e}")

    return {"checks": results}

# ─── CLI ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Haystack RAG Pipeline")
    parser.add_argument("--index", nargs="+", help="Directories to index")
    parser.add_argument("--query", type=str, help="Ask a question")
    parser.add_argument("--recreate", action="store_true", help="Recreate Qdrant index before indexing")
    parser.add_argument("--test", action="store_true", help="Run integration tests")
    parser.add_argument("--health", action="store_true", help="Full stack health check")
    parser.add_argument("--top-k", type=int, default=5, help="Number of docs to retrieve")
    args = parser.parse_args()

    if args.health:
        print("Full Stack Health Check")
        print("=" * 50)
        result = health_check()
        for line in result["checks"]:
            print(f"  {line}")
        return

    if args.test:
        print("Integration Tests")
        print("=" * 50)
        result = health_check()
        all_ok = all("OK" in c or "ok" in c.lower() for c in result["checks"])
        for line in result["checks"]:
            prefix = "  OK" if "OK" in line else "  FAIL"
            print(f"{prefix}: {line}")
        print(f"\nOverall: {'ALL PASSING' if all_ok else 'ISSUES FOUND'}")
        return

    if args.index:
        result = index_documents(args.index, recreate=args.recreate)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if args.query:
        result = query(args.query, top_k=args.top_k)
        if "error" in result:
            print(result["error"])
            return
        print(f"\nQ: {result['question']}\n")
        print(f"A: {result['answer']}")
        print(f"\nSources ({len(result['sources'])}):")
        for s in result["sources"]:
            print(f"  - {s['source']} (score: {s['score']:.3f})")
        return

    parser.print_help()

if __name__ == "__main__":
    main()
