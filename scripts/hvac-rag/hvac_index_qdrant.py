#!/usr/bin/env python3
"""
HVAC RAG Qdrant Indexing — T013
Index validated HVAC chunks into Qdrant collection hvac_manuals_v1
"""

import argparse
import hashlib
import json
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Optional

import requests

QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")  # Must be set via environment
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
EMBEDDING_MODEL = os.environ.get("HVAC_EMBEDDING_MODEL", "nomic-embed-text:latest")
COLLECTION_NAME = "hvac_manuals_v1"
VECTOR_DIM = 768
BATCH_SIZE = 64


def qdrant_headers():
    return {"Authorization": f"Bearer {QDRANT_API_KEY}", "Content-Type": "application/json"}


def ollama_headers():
    return {"Content-Type": "application/json"}


def get_collection_info(name: str) -> Optional[dict]:
    """Get collection info if exists."""
    try:
        r = requests.get(f"{QDRANT_URL}/collections/{name}", headers=qdrant_headers(), timeout=10)
        if r.status_code == 200:
            return r.json()["result"]
    except Exception:
        pass
    return None


def create_collection(name: str, vector_dim: int) -> bool:
    """Create collection with cosine distance."""
    payload = {
        "vectors": {
            "size": vector_dim,
            "distance": "Cosine"
        }
    }
    r = requests.put(f"{QDRANT_URL}/collections/{name}", headers=qdrant_headers(), json=payload, timeout=30)
    if r.status_code in (200, 201):
        return True
    print(f"  Create collection failed: {r.status_code} {r.text}")
    return False


def delete_collection(name: str) -> bool:
    """Delete collection."""
    r = requests.delete(f"{QDRANT_URL}/collections/{name}", headers=qdrant_headers(), timeout=30)
    return r.status_code in (200, 404)


def create_payload_index(name: str, field_name: str, field_schema: str = "keyword") -> bool:
    """Create payload index on a field."""
    payload = {
        "field_name": field_name,
        "field_schema": {"type": field_schema}
    }
    r = requests.put(
        f"{QDRANT_URL}/collections/{name}/index",
        headers=qdrant_headers(),
        json=payload,
        timeout=30
    )
    if r.status_code not in (200, 201):
        print(f"    Index error for {field_name}: {r.status_code} {r.text[:100]}")
    return r.status_code in (200, 201)


def get_embedding(text: str, model: str = EMBEDDING_MODEL) -> Optional[list]:
    """Get embedding for text via Ollama with context length safety."""
    def _embed(txt: str) -> Optional[list]:
        r = requests.post(
            f"{OLLAMA_URL}/api/embeddings",
            headers=ollama_headers(),
            json={"model": model, "prompt": txt},
            timeout=120
        )
        if r.status_code == 200:
            data = r.json()
            emb = data.get("embedding") or data.get("embeddings", [[]])[0]
            if emb and len(emb) > 0:
                return emb
        elif r.status_code == 500:
            err = r.json().get("error", "")
            if "context length" in err.lower():
                return None  # Signal to retry with shorter text
        return None

    # Try full text first
    emb = _embed(text)
    if emb:
        return emb

    # Fallback: try first 2000 chars
    emb = _embed(text[:2000])
    if emb:
        return emb

    # Final fallback: try first 500 chars
    emb = _embed(text[:500])
    return emb


def detect_vector_dim() -> int:
    """Detect vector dimension from Ollama embedding."""
    emb = get_embedding("dimension test")
    if emb:
        dim = len(emb)
        print(f"  Detected vector_dim: {dim}")
        return dim
    print("  Warning: could not detect vector_dim, using default 768")
    return VECTOR_DIM


def chunk_id_to_uuid(chunk_id: str) -> str:
    """Generate deterministic UUID from chunk_id."""
    h = hashlib.sha256(chunk_id.encode()).digest()
    return str(uuid.UUID(bytes=h[:16]))


def load_chunks(path: str) -> list:
    """Load chunks from JSONL."""
    chunks = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            chunks.append(json.loads(line))
    return chunks


def build_payload(chunk: dict, chunk_index: int) -> dict:
    """Build Qdrant payload from chunk."""
    return {
        "chunk_id": chunk["chunk_id"],
        "doc_id": chunk["doc_id"],
        "source_pdf": chunk.get("source_pdf", ""),
        "source_md": chunk.get("source_md", ""),
        "source_json": chunk.get("source_json", ""),
        "doc_type": chunk.get("doc_type", ""),
        "language": chunk.get("language", ""),
        "language_confidence": chunk.get("language_confidence", 0.0),
        "brand_candidates": [b["brand"] for b in chunk.get("brand_candidates", [])],
        "model_candidates": [m["model"] for m in chunk.get("model_candidates", [])],
        "equipment_type_candidates": [e["type"] for e in chunk.get("equipment_type_candidates", [])],
        "section_path": chunk.get("section_path", []),
        "heading": chunk.get("heading", ""),
        "page_start": chunk.get("page_start"),
        "page_end": chunk.get("page_end"),
        "error_code_candidates": chunk.get("error_code_candidates", []),
        "component_tags": chunk.get("component_tags", []),
        "safety_tags": chunk.get("safety_tags", []),
        "chunk_index": chunk_index,
        "token_estimate": chunk.get("token_estimate", 0),
        "text": chunk.get("text", "")[:8000],  # Truncate long text
    }


def upsert_batch(collection: str, points: list) -> bool:
    """Upsert a batch of points."""
    payload = {
        "points": points
    }
    r = requests.put(
        f"{QDRANT_URL}/collections/{collection}/points",
        headers=qdrant_headers(),
        json=payload,
        timeout=120
    )
    if r.status_code not in (200, 201):
        print(f"  Upsert failed: {r.status_code} {r.text[:200]}")
        return False
    return True


def run_smoke_queries(collection: str, vector_dim: int) -> list:
    """Run smoke test queries."""
    queries = [
        "RXYQ20BR erro U4 comunicação",
        "VRV RXYQ código E3 alta pressão",
        "como testar IPM no inverter",
        "ponte de diodos compressor",
        "procedimento de segurança alta tensão placa inverter",
    ]

    results = []
    for q in queries:
        emb = get_embedding(q)
        if not emb:
            results.append({"query": q, "error": "embedding failed"})
            continue

        search_payload = {
            "vector": emb,
            "top": 5,
            "with_payload": True,
        }
        try:
            r = requests.post(
                f"{QDRANT_URL}/collections/{collection}/points/search",
                headers=qdrant_headers(),
                json=search_payload,
                timeout=30
            )
            if r.status_code == 200:
                hits = r.json().get("result", [])
                results.append({
                    "query": q,
                    "top_hits": [
                        {
                            "id": h["id"],
                            "score": round(h["score"], 4),
                            "chunk_id": h["payload"].get("chunk_id", ""),
                            "doc_id": h["payload"].get("doc_id", ""),
                            "doc_type": h["payload"].get("doc_type", ""),
                            "heading": h["payload"].get("heading", ""),
                            "error_code_candidates": h["payload"].get("error_code_candidates", [])[:5],
                            "component_tags": h["payload"].get("component_tags", []),
                            "safety_tags": h["payload"].get("safety_tags", []),
                        }
                        for h in hits[:3]
                    ]
                })
            else:
                results.append({"query": q, "error": f"search failed: {r.status_code}"})
        except Exception as e:
            results.append({"query": q, "error": str(e)})

    return results


def main():
    parser = argparse.ArgumentParser(description="HVAC Qdrant Indexer T013")
    parser.add_argument("--chunks", default="/srv/data/hvac-rag/chunks/jsonl/chunks.jsonl")
    parser.add_argument("--dry-run", action="store_true", help="Dry run only")
    parser.add_argument("--write", action="store_true", help="Actually index")
    parser.add_argument("--recreate", action="store_true", help="Recreate collection if exists")
    args = parser.parse_args()

    # Validate required env vars
    print(f"QDRANT_URL: {QDRANT_URL}")
    print(f"OLLAMA_URL: {OLLAMA_URL}")
    print(f"EMBEDDING_MODEL: {EMBEDDING_MODEL}")
    if not QDRANT_API_KEY:
        print("ERROR: QDRANT_API_KEY environment variable is required")
        sys.exit(1)

    vector_dim = detect_vector_dim()

    # Load chunks
    print(f"\nLoading chunks from {args.chunks}...")
    chunks = load_chunks(args.chunks)
    print(f"Loaded {len(chunks)} chunks")

    if args.dry_run:
        print("\n[Dry run] Would index:")
        print(f"  Collection: {COLLECTION_NAME}")
        print(f"  Vector dim: {vector_dim}")
        print(f"  Chunks: {len(chunks)}")
        return

    # Check collection
    print(f"\nChecking collection {COLLECTION_NAME}...")
    existing = get_collection_info(COLLECTION_NAME)

    if existing:
        existing_dim = existing.get("config", {}).get("params", {}).get("vector_size", 0)
        if existing_dim and existing_dim != vector_dim:
            print(f"  Collection exists with vector_dim={existing_dim}, need {vector_dim}")
            if not args.recreate:
                print("  Use --recreate to delete and recreate")
                sys.exit(1)
            print("  Recreating...")
            delete_collection(COLLECTION_NAME)
            existing = None

    if not existing:
        print(f"  Creating collection {COLLECTION_NAME}...")
        if not create_collection(COLLECTION_NAME, vector_dim):
            print("Failed to create collection")
            sys.exit(1)
        print("  Collection created")

        # Create payload indexes
        print("  Creating payload indexes...")
        index_fields = [
            ("doc_id", "keyword"),
            ("doc_type", "keyword"),
            ("language", "keyword"),
            ("model_candidates", "keyword"),
            ("equipment_type_candidates", "keyword"),
            ("error_code_candidates", "keyword"),
            ("component_tags", "keyword"),
            ("safety_tags", "keyword"),
        ]
        indexes_created = []
        for field, schema in index_fields:
            if create_payload_index(COLLECTION_NAME, field, schema):
                indexes_created.append(field)
                print(f"    ✓ {field}")
            else:
                print(f"    ✗ {field} failed")
    else:
        print(f"  Collection exists (reusing)")

    if not args.write:
        print("\n[No --write] Skipping indexing. Use --write to index.")
        return

    # Index chunks
    print(f"\nIndexing {len(chunks)} chunks in batches of {BATCH_SIZE}...")
    points_upserted = 0
    failed_batches = []
    failed_count = 0

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE

        print(f"\n  Batch {batch_num}/{total_batches} ({len(batch)} chunks)...")

        points = []
        batch_failed = []
        for j, chunk in enumerate(batch):
            text = chunk.get("text", "")
            if not text.strip():
                continue

            emb = get_embedding(text)
            if not emb:
                print(f"    Warning: embedding failed for chunk {chunk['chunk_id']}")
                batch_failed.append(chunk["chunk_id"])
                continue

            chunk_idx = i + j
            point_id = chunk_id_to_uuid(chunk["chunk_id"])
            payload = build_payload(chunk, chunk_idx)

            points.append({
                "id": point_id,
                "vector": emb,
                "payload": payload
            })

        if points:
            if upsert_batch(COLLECTION_NAME, points):
                points_upserted += len(points)
                print(f"    ✓ {len(points)} points upserted")
            else:
                failed_batches.append({"batch": batch_num, "count": len(points)})
                failed_count += len(points)

        if batch_failed:
            print(f"    ⚠ {len(batch_failed)} chunks failed embedding")

        time.sleep(0.1)  # Small delay to avoid overwhelming Ollama

    # Run smoke queries
    print("\nRunning smoke queries...")
    smoke_results = run_smoke_queries(COLLECTION_NAME, vector_dim)
    for sr in smoke_results:
        top_score = 0.0
        if "top_hits" in sr and sr["top_hits"]:
            top_score = sr["top_hits"][0].get("score", 0)
        status = "✓" if top_score > 0.5 else ("⚠" if top_score > 0 else "✗")
        print(f"  {status} {sr['query'][:50]}: top_score={top_score:.4f}")

    # Generate report
    ready = points_upserted == len(chunks) and not failed_batches
    issues = []
    if failed_batches:
        issues.append(f"{len(failed_batches)} batches failed upsert")
    if failed_count > 0:
        issues.append(f"{failed_count} chunks failed embedding")

    report = {
        "collection": COLLECTION_NAME,
        "qdrant_url": "http://127.0.0.1:6333",
        "embedding_provider": "ollama",
        "embedding_model": EMBEDDING_MODEL,
        "vector_dim": vector_dim,
        "chunks_input": len(chunks),
        "points_upserted": points_upserted,
        "payload_indexes_created": ["doc_id", "doc_type", "language", "model_candidates",
                                     "equipment_type_candidates", "error_code_candidates",
                                     "component_tags", "safety_tags"],
        "smoke_queries": smoke_results,
        "failed_batches": failed_batches,
        "ready_for_openwebui": ready,
        "issues": issues,
    }

    report_path = Path("/srv/data/hvac-rag/manifests/qdrant-index-report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"HVAC QDRANT INDEXING REPORT — T013")
    print(f"{'=' * 60}")
    print(f"  Collection:       {COLLECTION_NAME}")
    print(f"  Embedding:        {EMBEDDING_MODEL}")
    print(f"  Vector dim:       {vector_dim}")
    print(f"  Chunks input:     {len(chunks)}")
    print(f"  Points upserted:  {points_upserted}")
    print(f"  Ready for OpenWebUI: {ready}")
    if issues:
        print(f"  Issues: {issues}")
    print(f"{'=' * 60}")
    print(f"Report: {report_path}")

    if not ready:
        sys.exit(1)


if __name__ == "__main__":
    main()
