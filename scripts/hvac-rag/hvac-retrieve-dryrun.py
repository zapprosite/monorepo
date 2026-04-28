#!/usr/bin/env python3
"""
HVAC RAG Retrieval Dry-Run
T012 - Local retrieval simulation before Qdrant indexing

This script validates that chunked data is recoverable via keyword/metadata search
before any vector indexing investment.
"""

import argparse
import json
import math
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ScoredChunk:
    chunk_id: str
    doc_id: str
    doc_type: str
    language: str
    section_path: list
    model_candidates: list
    error_code_candidates: list
    component_tags: list
    safety_tags: list
    equipment_type_candidates: list
    text: str
    scores: dict = field(default_factory=dict)
    total_score: float = 0.0


class RetrievalEngine:
    """Local retrieval engine without embeddings."""

    def __init__(self, chunks: list):
        self.chunks = chunks
        self._build_indices()

    def _build_indices(self):
        """Build inverted indices for fast filtering."""
        self.model_index = Counter()
        self.error_index = Counter()
        self.component_index = Counter()
        self.safety_index = Counter()
        self.doc_type_index = Counter()
        self.language_index = Counter()

        for chunk in self.chunks:
            self.doc_type_index[chunk['doc_type']] += 1
            self.language_index[chunk['language']] += 1

            for m in chunk.get('model_candidates', []):
                self.model_index[m['model'].lower()] += 1
            for e in chunk.get('error_code_candidates', []):
                self.error_index[e.upper()] += 1
            for t in chunk.get('component_tags', []):
                self.component_index[t.lower().strip()] += 1
            for t in chunk.get('safety_tags', []):
                self.safety_index[t.lower().strip()] += 1

    def score_keyword(self, chunk: dict, query_terms: list) -> float:
        """Score based on keyword matching in text."""
        if not query_terms:
            return 0.0
        text_lower = chunk.get('text', '').lower()
        matches = sum(1 for term in query_terms if term.lower() in text_lower)
        return matches / len(query_terms)

    def score_model(self, chunk: dict, query_terms: list) -> float:
        """Score based on model candidates match."""
        if not query_terms:
            return 0.0
        models = [m['model'].lower() for m in chunk.get('model_candidates', [])]
        query_lower = [t.lower() for t in query_terms]
        matches = sum(1 for term in query_lower for m in models if term in m or m in term)
        return min(matches / len(query_terms), 1.0)

    def score_error_code(self, chunk: dict, query_terms: list) -> float:
        """Score based on error code candidates match."""
        if not query_terms:
            return 0.0
        errors = [e.upper() for e in chunk.get('error_code_candidates', [])]
        query_upper = [t.upper() for t in query_terms]
        matches = sum(1 for term in query_upper for e in errors if term == e or e in term)
        return min(matches / len(query_terms), 1.0)

    def score_component_tag(self, chunk: dict, query_terms: list) -> float:
        """Score based on component tag match (case-insensitive, bidirectional)."""
        if not query_terms:
            return 0.0
        components = [t.lower().strip() for t in chunk.get('component_tags', [])]
        query_lower = [t.lower() for t in query_terms]
        matches = 0
        matched_components = set()
        for term in query_lower:
            for c in components:
                if term in c or c in term:
                    if c not in matched_components:
                        matches += 1
                        matched_components.add(c)
                    break
        return min(matches / len(query_terms), 1.0)

    def score_safety_tag(self, chunk: dict, query_terms: list) -> float:
        """Score based on safety tag match (case-insensitive)."""
        if not query_terms:
            return 0.0
        safety = [t.lower().strip() for t in chunk.get('safety_tags', [])]
        query_lower = [t.lower() for t in query_terms]
        matches = 0
        for term in query_lower:
            for s in safety:
                if term in s or s in term:
                    matches += 1
                    break
        return min(matches / len(query_terms), 1.0)

    def score_metadata_filter(self, chunk: dict, filters: dict) -> float:
        """Score 1.0 if all filters match, 0.0 otherwise.
        When filters are specified, non-matching chunks get 0.
        """
        if not filters:
            return 0.5  # Neutral score when no filters

        filter_score = 1.0
        filter_fail = False

        if 'doc_type' in filters:
            if chunk.get('doc_type') != filters['doc_type']:
                return 0.0
            filter_score *= 1.2

        if 'language' in filters:
            if chunk.get('language') != filters['language']:
                return 0.0
            filter_score *= 1.1

        if 'model' in filters:
            models = [m['model'].lower() for m in chunk.get('model_candidates', [])]
            if not any(filters['model'].lower() in m for m in models):
                return 0.0
            filter_score *= 1.2

        if 'equipment_type' in filters:
            types = [t['type'].lower() for t in chunk.get('equipment_type_candidates', [])]
            if not any(filters['equipment_type'].lower() in t for t in types):
                return 0.0
            filter_score *= 1.1

        if 'error_code' in filters:
            errors = [e.upper() for e in chunk.get('error_code_candidates', [])]
            if filters['error_code'].upper() not in errors:
                return 0.0
            filter_score *= 1.3

        if 'component_tag' in filters:
            components = [t.lower().strip() for t in chunk.get('component_tags', [])]
            if not any(filters['component_tag'].lower() in c for c in components):
                return 0.0
            filter_score *= 1.2

        if 'safety_tag' in filters:
            safety = [t.lower().strip() for t in chunk.get('safety_tags', [])]
            if not any(filters['safety_tag'].lower() in s for s in safety):
                return 0.0
            filter_score *= 1.2

        return min(filter_score, 2.0) if not filter_fail else 0.0

    def search(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[dict] = None,
        weights: Optional[dict] = None
    ) -> list:
        """Search chunks and return top-k scored results."""
        if weights is None:
            weights = {
                'keyword': 0.20,
                'model': 0.25,
                'error_code': 0.20,
                'component': 0.10,
                'safety': 0.10,
                'metadata_filter': 0.15
            }

        # Extract search terms intelligently
        # For error codes: match specific patterns like "U4", "E3", "A106"
        error_pattern = re.findall(r'[A-Z]\d{1,4}', query.upper())
        # Extract individual words for general matching
        words = query.lower().split()
        # Combine error codes with single terms
        query_terms = error_pattern + words

        results = []

        for chunk in self.chunks:
            scores = {
                'keyword': self.score_keyword(chunk, query_terms),
                'model': self.score_model(chunk, query_terms),
                'error_code': self.score_error_code(chunk, query_terms),
                'component': self.score_component_tag(chunk, query_terms),
                'safety': self.score_safety_tag(chunk, query_terms),
                'metadata_filter': self.score_metadata_filter(chunk, filters or {})
            }

            total = sum(scores[k] * weights[k] for k in weights)

            scored = ScoredChunk(
                chunk_id=chunk['chunk_id'],
                doc_id=chunk['doc_id'],
                doc_type=chunk['doc_type'],
                language=chunk['language'],
                section_path=chunk.get('section_path', []),
                model_candidates=[m['model'] for m in chunk.get('model_candidates', [])],
                error_code_candidates=chunk.get('error_code_candidates', []),
                component_tags=chunk.get('component_tags', []),
                safety_tags=chunk.get('safety_tags', []),
                equipment_type_candidates=[t['type'] for t in chunk.get('equipment_type_candidates', [])],
                text=chunk.get('text', ''),
                scores=scores,
                total_score=total
            )
            results.append(scored)

        results.sort(key=lambda x: x.total_score, reverse=True)
        return results[:top_k]


def load_chunks(path: str) -> list:
    """Load chunks from JSONL file."""
    chunks = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            chunks.append(json.loads(line))
    return chunks


def run_evaluation(engine: RetrievalEngine, write_results: bool = False) -> dict:
    """Run evaluation queries and compute metrics."""

    positive_queries = [
        ("RXYQ20BR erro U4 comunicação", {"model": "RXYQ20BR"}, "model+error"),
        ("VRV RXYQ código E3 alta pressão", {"model": "RXYQ"}, "model+error"),
        ("como testar IPM no inverter", {"component_tag": "IPM"}, "component"),
        ("ponte retificadora barramento DC compressor", {"component_tag": "DC"}, "component"),
        ("installation manual RXYQ8 outdoor unit", {"doc_type": "installation_manual", "model": "RXYQ8"}, "doc_type+model"),
        ("procedimento de segurança alta tensão placa inverter", {"safety_tag": "alta tensão"}, "safety"),
        ("modelo RYYQ8 instalação unidade externa", {"model": "RYYQ8"}, "model"),
    ]

    negative_queries = [
        ("geladeira frost free", {}, "negative"),
        ("manual de TV", {}, "negative"),
        ("controle remoto universal", {}, "negative"),
    ]

    all_queries = []
    for query, filters, qtype in positive_queries + negative_queries:
        all_queries.append({"query": query, "filters": filters, "type": qtype})

    results = []
    for q in all_queries:
        hits = engine.search(q["query"], top_k=5, filters=q["filters"])
        results.append({
            "query": q["query"],
            "type": q["type"],
            "filters": q["filters"],
            "hits": [
                {
                    "chunk_id": h.chunk_id,
                    "doc_id": h.doc_id,
                    "doc_type": h.doc_type,
                    "language": h.language,
                    "section_path": h.section_path,
                    "model_candidates": h.model_candidates[:5],
                    "error_code_candidates": h.error_code_candidates[:5],
                    "component_tags": h.component_tags,
                    "safety_tags": h.safety_tags,
                    "total_score": round(h.total_score, 4),
                    "score_breakdown": {k: round(v, 4) for k, v in h.scores.items()},
                    "text_preview": h.text[:500] if h.text else "",
                }
                for h in hits
            ]
        })

    metrics = compute_metrics(results)

    output = {
        "metrics": metrics,
        "query_results": results,
    }

    if write_results:
        results_path = Path("/srv/data/hvac-rag/manifests/retrieval-dryrun-results.jsonl")
        with open(results_path, 'w', encoding='utf-8') as f:
            for r in results:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
        print(f"Results written to {results_path}")

    return output


def compute_metrics(results: list) -> dict:
    """Compute retrieval metrics from query results."""
    positive_queries = [r for r in results if r["type"] != "negative"]
    negative_queries = [r for r in results if r["type"] == "negative"]

    retrieval_hits = 0
    error_code_recall = 0
    safety_recall = 0
    false_positives = 0
    filter_accuracy = 0

    for r in positive_queries:
        hits = r["hits"]
        qtype = r["type"]

        if hits and hits[0]["total_score"] > 0.3:
            retrieval_hits += 1

        if "error" in qtype:
            has_error = any(h.get("error_code_candidates") for h in hits[:3])
            if has_error:
                error_code_recall += 1

        if "safety" in qtype:
            has_safety = any(h.get("safety_tags") for h in hits[:3])
            if has_safety:
                safety_recall += 1

    for r in negative_queries:
        hits = r["hits"]
        if hits and hits[0]["total_score"] > 0.5:
            false_positives += 1

    n_pos = len(positive_queries) if positive_queries else 1
    n_neg = len(negative_queries) if negative_queries else 1

    issues = []
    ready = True

    retrieval_hit_rate = retrieval_hits / n_pos
    if retrieval_hit_rate < 0.7:
        issues.append(f"Low retrieval hit rate: {retrieval_hit_rate:.2%}")
        ready = False

    error_recall_rate = error_code_recall / max(1, sum(1 for r in positive_queries if "error" in r["type"]))
    safety_recall_rate = safety_recall / max(1, sum(1 for r in positive_queries if "safety" in r["type"]))

    false_positive_rate = false_positives / n_neg
    if false_positive_rate > 0.3:
        issues.append(f"High false positive rate: {false_positive_rate:.2%}")

    if not positive_queries:
        issues.append("No positive queries evaluated")
        ready = False

    return {
        "total_queries": len(results),
        "positive_queries": len(positive_queries),
        "negative_queries": len(negative_queries),
        "retrieval_hit_rate": round(retrieval_hit_rate, 4),
        "error_code_recall": round(error_recall_rate, 4),
        "safety_recall": round(safety_recall_rate, 4),
        "false_positive_rate": round(false_positive_rate, 4),
        "ready_for_qdrant_indexing": ready,
        "issues": issues,
    }


def print_report(output: dict):
    """Print human-readable report."""
    metrics = output["metrics"]
    results = output["query_results"]

    print("\n" + "=" * 80)
    print("HVAC RAG RETRIEVAL DRY-RUN REPORT")
    print("=" * 80)

    print("\n## METRICS")
    print(f"  Total queries:        {metrics['total_queries']}")
    print(f"  Positive queries:     {metrics['positive_queries']}")
    print(f"  Negative queries:     {metrics['negative_queries']}")
    print(f"  Retrieval hit rate:   {metrics['retrieval_hit_rate']:.2%}")
    print(f"  Error code recall:    {metrics['error_code_recall']:.2%}")
    print(f"  Safety recall:        {metrics['safety_recall']:.2%}")
    print(f"  False positive rate:  {metrics['false_positive_rate']:.2%}")
    print(f"  Ready for Qdrant:     {metrics['ready_for_qdrant_indexing']}")

    if metrics['issues']:
        print("\n## ISSUES")
        for issue in metrics['issues']:
            print(f"  - {issue}")

    print("\n## QUERY RESULTS")
    for r in results:
        qtype_marker = "✓" if r["type"] != "negative" else "✗"
        top = r["hits"][0] if r["hits"] else None
        top_score = top["total_score"] if top else 0.0
        print(f"\n  [{qtype_marker}] {r['query']}")
        print(f"      Type: {r['type']} | Top score: {top_score:.4f}")
        if top:
            print(f"      Top chunk: {top['chunk_id']} | {top['doc_type']} | {top['language']}")
            print(f"      Models: {top['model_candidates'][:3]}")
            if top['error_code_candidates']:
                print(f"      Errors: {top['error_code_candidates'][:5]}")
            if top['component_tags']:
                print(f"      Components: {top['component_tags'][:3]}")
        print()

    print("=" * 80)
    print(f"READY FOR QDRANT INDEXING: {metrics['ready_for_qdrant_indexing']}")
    print("=" * 80 + "\n")


def main():
    parser = argparse.ArgumentParser(description="HVAC RAG Retrieval Dry-Run")
    parser.add_argument("--chunks", default="/srv/data/hvac-rag/chunks/jsonl/chunks.jsonl",
                        help="Path to chunks.jsonl")
    parser.add_argument("--write-report", action="store_true",
                        help="Write report to manifests directory")
    args = parser.parse_args()

    print(f"Loading chunks from {args.chunks}...")
    chunks = load_chunks(args.chunks)
    print(f"Loaded {len(chunks)} chunks")

    print("Building retrieval engine...")
    engine = RetrievalEngine(chunks)

    print("Running evaluation...")
    output = run_evaluation(engine, write_results=args.write_report)

    print_report(output)

    if args.write_report:
        report_path = Path("/srv/data/hvac-rag/manifests/retrieval-dryrun-report.json")
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({"metrics": output["metrics"]}, f, indent=2, ensure_ascii=False)
        print(f"Report written to {report_path}")

    if not output["metrics"]["ready_for_qdrant_indexing"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
