"""
HCE v2.0 — Context Ranker
PageRank-style relevance scoring + token budget truncation.
"""
import math
from typing import List, Dict, Any


def _normalize(scores: Dict[str, float]) -> Dict[str, float]:
    total = sum(scores.values()) or 1.0
    return {k: v / total for k, v in scores.items()}


def pagerank(
    links: Dict[str, List[str]],
    damping: float = 0.85,
    iterations: int = 20,
    tol: float = 1e-6,
) -> Dict[str, float]:
    """
    Simple PageRank over a link graph.
    links: {node_id: [target_node_ids]}
    """
    nodes = list(links.keys())
    if not nodes:
        return {}

    scores = {n: 1.0 / len(nodes) for n in nodes}

    for _ in range(iterations):
        new_scores: Dict[str, float] = {}
        for node in nodes:
            rank = (1 - damping) / len(nodes)
            for src, targets in links.items():
                if node in targets:
                    out_degree = len(targets) or 1
                    rank += damping * scores[src] / out_degree
            new_scores[node] = rank

        # convergence check
        delta = sum(abs(new_scores[n] - scores[n]) for n in nodes)
        scores = new_scores
        if delta < tol:
            break

    return _normalize(scores)


def truncate_by_budget(
    chunks: List[Dict[str, Any]],
    max_tokens: int = 2048,
    tokens_per_char: float = 0.25,
) -> List[Dict[str, Any]]:
    """
    Truncate ranked chunks to fit within a token budget.
    Assumes each chunk has 'text' and 'score' keys.
    """
    sorted_chunks = sorted(chunks, key=lambda c: c.get("score", 0), reverse=True)
    budget = max_tokens
    result: List[Dict[str, Any]] = []

    for chunk in sorted_chunks:
        text = chunk.get("text", "")
        estimated = math.ceil(len(text) * tokens_per_char)
        if estimated <= budget:
            result.append(chunk)
            budget -= estimated
        else:
            break

    return result
