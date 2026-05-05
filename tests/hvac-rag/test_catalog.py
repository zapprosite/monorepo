"""CATALOG-01: INMETRO JSONL normalization tests."""
import json
from pathlib import Path
import pytest


def test_inmetro_normalized(mock_catalog_jsonl: Path):
    """All records in the JSONL have required fields for Inverter filter."""
    records = [json.loads(l) for l in mock_catalog_jsonl.read_text().splitlines() if l.strip()]
    assert len(records) == 5, f"Expected 5 catalog records, got {len(records)}"
    required_fields = {"catalog_id", "brand", "model_family", "technology"}
    for rec in records:
        missing = required_fields - rec.keys()
        assert not missing, f"Record {rec.get('catalog_id')} missing fields: {missing}"


def test_inmetro_inverter_only(mock_catalog_jsonl: Path):
    """Catalog fixture contains only inverter technology records."""
    records = [json.loads(l) for l in mock_catalog_jsonl.read_text().splitlines() if l.strip()]
    non_inverter = [r for r in records if r.get("technology", "").lower() not in
                    {"inverter", "dual inverter", "vrf", "vrv", "multi-split"}]
    assert len(non_inverter) == 0, f"Non-inverter records found: {non_inverter}"
