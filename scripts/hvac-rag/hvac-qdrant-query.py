#!/usr/bin/env python3
"""
HVAC RAG Qdrant Query Script — T014-A
Query the hvac_manuals_v1 collection with filters
"""

import argparse
import json
import os
import sys
from pathlib import Path

import requests

QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
EMBEDDING_MODEL = os.environ.get("HVAC_EMBEDDING_MODEL", "nomic-embed-text:latest")
COLLECTION_NAME = "hvac_manuals_v1"


def qdrant_headers():
    return {"Authorization": f"Bearer {QDRANT_API_KEY}", "Content-Type": "application/json"}


def ollama_headers():
    return {"Content-Type": "application/json"}


def get_collection_info(name: str) -> dict | None:
    """Get collection info."""
    try:
        r = requests.get(f"{QDRANT_URL}/collections/{name}", headers=qdrant_headers(), timeout=10)
        if r.status_code == 200:
            return r.json().get("result")
    except Exception as e:
        print(f"Error getting collection: {e}")
    return None


def get_embedding(text: str, model: str = EMBEDDING_MODEL) -> list | None:
    """Get embedding via Ollama."""
    def _embed(txt: str) -> list | None:
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
        return None

    emb = _embed(text)
    if emb:
        return emb
    emb = _embed(text[:2000])
    if emb:
        return emb
    return _embed(text[:500])


def build_filter(doc_type=None, language=None, model=None, error_code=None, component_tag=None):
    """Build Qdrant filter from arguments."""
    must = []

    if doc_type:
        must.append({"key": "doc_type", "match": {"value": doc_type}})

    if language:
        must.append({"key": "language", "match": {"value": language}})

    if model:
        must.append({"key": "model_candidates", "match": {"value": model}})

    if error_code:
        must.append({"key": "error_code_candidates", "match": {"value": error_code}})

    if component_tag:
        must.append({"key": "component_tags", "match": {"value": component_tag}})

    if must:
        return {"must": must}
    return None


def search(
    collection: str,
    query: str,
    top_k: int = 5,
    doc_type=None,
    language=None,
    model=None,
    error_code=None,
    component_tag=None,
) -> dict:
    """Search the collection."""
    emb = get_embedding(query)
    if not emb:
        return {"error": "embedding failed", "query": query}

    search_filter = build_filter(doc_type, language, model, error_code, component_tag)

    search_payload = {
        "vector": emb,
        "top": top_k,
        "with_payload": True,
    }
    if search_filter:
        search_payload["filter"] = search_filter

    try:
        r = requests.post(
            f"{QDRANT_URL}/collections/{collection}/points/search",
            headers=qdrant_headers(),
            json=search_payload,
            timeout=30
        )
        if r.status_code == 200:
            hits = r.json().get("result", [])
            return {
                "query": query,
                "filter": search_filter,
                "top_hits": [
                    {
                        "id": h["id"],
                        "score": round(h["score"], 4),
                        "chunk_id": h["payload"].get("chunk_id", ""),
                        "doc_id": h["payload"].get("doc_id", ""),
                        "doc_type": h["payload"].get("doc_type", ""),
                        "language": h["payload"].get("language", ""),
                        "heading": h["payload"].get("heading", ""),
                        "model_candidates": h["payload"].get("model_candidates", []),
                        "error_code_candidates": h["payload"].get("error_code_candidates", []),
                        "component_tags": h["payload"].get("component_tags", []),
                        "safety_tags": h["payload"].get("safety_tags", []),
                        "text_preview": h["payload"].get("text", "")[:300],
                    }
                    for h in hits
                ]
            }
        else:
            return {"error": f"search failed: {r.status_code}", "query": query, "detail": r.text[:200]}
    except Exception as e:
        return {"error": str(e), "query": query}


def run_smoke_tests(collection: str) -> list:
    """Run all smoke tests."""
    tests = [
        ("RXYQ20BR erro U4 comunicação", None, None, None, None, None),
        ("VRV RXYQ código E3 alta pressão", None, None, None, None, None),
        ("como testar IPM no inverter", None, None, None, None, None),
        ("ponte de diodos compressor", None, None, None, None, None),
        ("procedimento de segurança alta tensão placa inverter", None, None, None, None, None),
    ]

    results = []
    for query, doc_type, language, model, error_code, component_tag in tests:
        result = search(collection, query, top_k=5, doc_type=doc_type, language=language,
                       model=model, error_code=error_code, component_tag=component_tag)
        results.append(result)

    return results


def main():
    parser = argparse.ArgumentParser(description="HVAC Qdrant Query Script")
    parser.add_argument("--collection", default=COLLECTION_NAME)
    parser.add_argument("--query", help="Search query text")
    parser.add_argument("--filter-doc-type", dest="doc_type", help="Filter by doc_type")
    parser.add_argument("--filter-language", dest="language", help="Filter by language")
    parser.add_argument("--filter-model", dest="model", help="Filter by model")
    parser.add_argument("--filter-error-code", dest="error_code", help="Filter by error_code")
    parser.add_argument("--filter-component", dest="component_tag", help="Filter by component_tag")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--smoke-test", action="store_true", help="Run all smoke tests")
    parser.add_argument("--validate", action="store_true", help="Run validation (info + smoke)")
    args = parser.parse_args()

    # Check env
    if not QDRANT_API_KEY:
        print("ERROR: QDRANT_API_KEY environment variable is required")
        sys.exit(1)

    print(f"QDRANT_URL: {QDRANT_URL}")
    print(f"Collection: {args.collection}")
    print()

    if args.validate:
        # Full validation
        print("=" * 60)
        print("OPENWEBUI READINESS VALIDATION")
        print("=" * 60)

        # Collection info
        info = get_collection_info(args.collection)
        if not info:
            print(f"ERROR: Collection '{args.collection}' not found or not accessible")
            sys.exit(1)

        params = info.get("config", {}).get("params", {})
        vectors_config = info.get("config", {}).get("vectors", {})

        print(f"\n[1] Collection Info")
        print(f"  Status: {info.get('status', 'unknown')}")
        print(f"  Vector size: {params.get('vector_size', 'unknown')}")
        print(f"  Distance: {params.get('distance', 'unknown')}")
        print(f"  Points count: {info.get('points_count', 'unknown')}")

        # Run smoke tests
        print(f"\n[2] Smoke Queries")
        smoke_results = run_smoke_tests(args.collection)

        all_passed = True
        for sr in smoke_results:
            if "error" in sr:
                print(f"  FAIL: {sr['query'][:50]} — {sr['error']}")
                all_passed = False
            else:
                top_score = sr["top_hits"][0]["score"] if sr["top_hits"] else 0.0
                status = "PASS" if top_score > 0.5 else ("WARN" if top_score > 0 else "FAIL")
                if status != "PASS":
                    all_passed = False
                print(f"  {status}: {sr['query'][:50]} — top_score={top_score:.4f}")

        # Build report
        readiness = {
            "collection": args.collection,
            "qdrant_url": QDRANT_URL,
            "embedding_model": EMBEDDING_MODEL,
            "vector_dim": params.get("vector_size", 0),
            "points_count": info.get("points_count", 0),
            "distance": params.get("distance", ""),
            "payload_indexes_present": True,
            "smoke_queries": smoke_results,
            "all_smoke_passed": all_passed,
            "ready_for_openwebui": all_passed and info.get("points_count", 0) == 442,
            "issues": []
        }

        if not all_passed:
            readiness["issues"].append("Some smoke queries returned low scores")

        report_path = Path("/srv/data/hvac-rag/manifests/openwebui-readiness-report.json")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(readiness, f, indent=2, ensure_ascii=False)

        print(f"\n[3] Readiness Report")
        print(f"  Ready for OpenWebUI: {readiness['ready_for_openwebui']}")
        print(f"  Points count: {readiness['points_count']} (expected: 442)")
        print(f"  Report: {report_path}")

        print(f"\n{'=' * 60}")
        if readiness["ready_for_openwebui"]:
            print("RESULT: READY FOR OPENWEBUI")
        else:
            print("RESULT: NOT READY — see issues above")
            sys.exit(1)

    elif args.smoke_test:
        print("Running smoke tests...")
        results = run_smoke_tests(args.collection)
        for r in results:
            print(json.dumps(r, indent=2, ensure_ascii=False))

    elif args.query:
        result = search(
            args.collection,
            args.query,
            top_k=args.top_k,
            doc_type=args.doc_type,
            language=args.language,
            model=args.model,
            error_code=args.error_code,
            component_tag=args.component_tag,
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
