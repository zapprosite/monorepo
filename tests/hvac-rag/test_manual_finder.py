"""MANUAL-FINDER-01: query builder and ranking tests."""

from pathlib import Path
import json


def test_build_search_query_uses_brand_model_and_catalog_family():
    import hvac_manual_finder

    query = hvac_manual_finder.build_search_query(
        "lg",
        "ARNU12GTMC2",
        {"model_family": "arnu12", "technology": "inverter"},
    )

    assert query == "LG ARNU12GTMC2 ARNU12 manual pdf ar condicionado"


def test_rank_search_results_prefers_official_pdf():
    import hvac_manual_finder

    query = hvac_manual_finder.build_search_query("lg", "ARNU12GTMC2")
    ranked = hvac_manual_finder.rank_search_results(
        "lg",
        "ARNU12GTMC2",
        query,
        [
            {
                "title": "LG support page ARNU12GTMC2",
                "url": "https://www.lg.com/br/suporte/product-help/ARNU12GTMC2",
                "snippet": "Manual e suporte para o modelo ARNU12GTMC2",
                "confidence": 0.70,
            },
            {
                "title": "LG service manual ARNU12GTMC2 PDF",
                "url": "https://www.lg.com/br/support/manuals/ARNU12GTMC2.pdf",
                "snippet": "Service manual pdf",
                "confidence": 0.65,
            },
            {
                "title": "Forum mirror",
                "url": "https://example.net/files/ARNU12GTMC2.pdf",
                "snippet": "manual pdf",
                "confidence": 0.80,
            },
        ],
    )

    assert ranked[0].source_domain == "lg.com"
    assert ranked[0].url.endswith(".pdf")
    assert "official_domain" in ranked[0].reason
    assert "pdf_url" in ranked[0].reason
    assert ranked[0].confidence > ranked[1].confidence > ranked[2].confidence


def test_parse_catalog_row_json_accepts_file_path(tmp_path: Path):
    import hvac_manual_finder

    payload = {"brand": "samsung", "indoor_model": "AR09BVHQBWKNAZ"}
    row_path = tmp_path / "row.json"
    row_path.write_text(json.dumps(payload), encoding="utf-8")

    assert hvac_manual_finder.parse_catalog_row_json(str(row_path)) == payload
