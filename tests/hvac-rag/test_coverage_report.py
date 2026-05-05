"""COVERAGE-01: Enriched coverage table in hvac_missing_manuals.py."""
import pytest


def test_coverage_table_contains_tier1_brands(sample_catalog, indexed_models):
    """generate_coverage_table returns Markdown with LG, Samsung, Daikin rows."""
    hvac_missing = pytest.importorskip(
        "hvac_missing_manuals",
        reason="hvac_missing_manuals.py not yet modified (Wave 2, Plan 04)"
    )
    table = hvac_missing.generate_coverage_table(
        catalog=sample_catalog,
        indexed=indexed_models,
        scraper_brands={"lg", "samsung", "daikin", "carrier", "springer"},
    )
    assert "## Resumo por Marca" in table
    assert "| Marca |" in table
    assert "LG" in table.upper() or "lg" in table.lower()
    assert "SAMSUNG" in table.upper() or "samsung" in table.lower()
    assert "DAIKIN" in table.upper() or "daikin" in table.lower()


def test_coverage_table_shows_correct_counts(sample_catalog, indexed_models):
    """Coverage counts must match: LG has 2 INMETRO models, 1 indexed."""
    hvac_missing = pytest.importorskip("hvac_missing_manuals", reason="Wave 2 Plan 04")
    table = hvac_missing.generate_coverage_table(
        catalog=sample_catalog,
        indexed=indexed_models,
        scraper_brands={"lg", "samsung", "daikin", "carrier", "springer"},
    )
    for line in table.splitlines():
        if "lg" in line.lower() and "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            assert "2" in parts, f"LG row must show 2 INMETRO models: {line}"
            assert "1" in parts, f"LG row must show 1 indexed: {line}"
            break


def test_coverage_table_marks_scraper_support(sample_catalog, indexed_models):
    """Brands with scraper support must differ from brands without (midea)."""
    hvac_missing = pytest.importorskip("hvac_missing_manuals", reason="Wave 2 Plan 04")
    table = hvac_missing.generate_coverage_table(
        catalog=sample_catalog,
        indexed=indexed_models,
        scraper_brands={"lg", "samsung", "daikin", "carrier", "springer"},
    )
    for line in table.splitlines():
        if "midea" in line.lower() and "|" in line:
            assert "pendente" in line.lower() or "OK" not in line, \
                f"midea must not show scraper=OK: {line}"
            break
