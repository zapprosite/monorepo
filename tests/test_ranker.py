"""
test_ranker.py
Phase 2 — Tests for libs.context.ranker
"""
import math
from libs.context.ranker import pagerank, truncate_by_budget


def test_pagerank_convergence():
    """PageRank should converge and scores should sum to 1."""
    links = {
        "a": ["b", "c"],
        "b": ["c"],
        "c": ["a"],
    }
    scores = pagerank(links, iterations=100, tol=1e-9)
    assert math.isclose(sum(scores.values()), 1.0, rel_tol=1e-6)
    assert "a" in scores
    assert "b" in scores
    assert "c" in scores


def test_pagerank_empty_graph():
    """Empty graph should return empty dict without crashing."""
    assert pagerank({}) == {}


def test_pagerank_early_stop():
    """With tol high enough, should stop before max iterations."""
    links = {"x": ["y"], "y": ["x"]}
    # High tolerance means it stops very early
    scores = pagerank(links, iterations=100, tol=1.0)
    assert len(scores) == 2
    assert math.isclose(sum(scores.values()), 1.0, rel_tol=1e-6)


def test_truncate_by_budget_respects_limit():
    """truncate_by_budget must not exceed token budget."""
    chunks = [
        {"text": "a" * 100, "score": 1.0},   # ~25 tokens
        {"text": "b" * 200, "score": 0.8},   # ~50 tokens
        {"text": "c" * 400, "score": 0.5},   # ~100 tokens
    ]
    result = truncate_by_budget(chunks, max_tokens=80, tokens_per_char=0.25)
    # First two fit (25 + 50 = 75 <= 80), third exceeds
    assert len(result) == 2
    assert result[0]["text"] == "a" * 100
    assert result[1]["text"] == "b" * 200


def test_truncate_by_budget_sorts_by_score():
    """Chunks should be ordered by score descending regardless of input order."""
    chunks = [
        {"text": "low", "score": 0.1},
        {"text": "high", "score": 0.9},
        {"text": "mid", "score": 0.5},
    ]
    result = truncate_by_budget(chunks, max_tokens=1000)
    assert result[0]["text"] == "high"
    assert result[1]["text"] == "mid"
    assert result[2]["text"] == "low"


def test_truncate_by_budget_empty_list():
    """Empty list should return empty list."""
    assert truncate_by_budget([], max_tokens=100) == []
