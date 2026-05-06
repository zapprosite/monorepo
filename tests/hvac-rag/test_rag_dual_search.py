"""RAG-05: dual search orchestration."""

import pytest


@pytest.mark.asyncio
async def test_orchestrate_dual_search_scopes_raw_search_from_top_faq(monkeypatch):
    import hvac_rag_pipe

    calls = []

    async def fake_faq(query, top_k=3):
        return [{"payload": {"manual_id": "manual-lg-001"}}]

    async def fake_raw(query, top_k=6, extra_filter=None):
        calls.append(extra_filter)
        return [{"payload": {"doc_id": "manual-lg-001", "text": "prova real"}}]

    monkeypatch.setattr(hvac_rag_pipe, "search_qdrant_faq", fake_faq)
    monkeypatch.setattr(hvac_rag_pipe, "search_qdrant_raw", fake_raw)

    hits = await hvac_rag_pipe.orchestrate_dual_search("Como testar sensor LG?")

    assert hits[0]["payload"]["text"] == "prova real"
    assert calls[0]["should"][0]["key"] == "manual_id"


@pytest.mark.asyncio
async def test_orchestrate_dual_search_falls_back_to_raw(monkeypatch):
    import hvac_rag_pipe

    async def fake_faq(query, top_k=3):
        return []

    async def fake_raw(query, top_k=6, extra_filter=None):
        assert extra_filter is None
        return [{"payload": {"text": "fallback"}}]

    monkeypatch.setattr(hvac_rag_pipe, "search_qdrant_faq", fake_faq)
    monkeypatch.setattr(hvac_rag_pipe, "search_qdrant_raw", fake_raw)

    hits = await hvac_rag_pipe.orchestrate_dual_search("Pergunta sem FAQ")

    assert hits[0]["payload"]["text"] == "fallback"
