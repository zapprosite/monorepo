"""
Shared pytest fixtures for HVAC RAG Phase 2 tests.
All fixtures use tmp_path for filesystem isolation.
"""
import json
import sys
from pathlib import Path
import pytest

# Inject scripts dir so test files can import pipeline functions
SCRIPTS_DIR = Path("/srv/monorepo/scripts/hvac-rag")
sys.path.insert(0, str(SCRIPTS_DIR))


# ── Catalog fixtures ───────────────────────────────────────────────────────────

SAMPLE_CATALOG = [
    {"catalog_id": "LG-001", "brand": "lg", "indoor_model": "ARNU12GTMC2",
     "model_family": "arnu12gtmc2", "technology": "inverter"},
    {"catalog_id": "LG-002", "brand": "lg", "indoor_model": "ARNU18GTMC2",
     "model_family": "arnu18gtmc2", "technology": "inverter"},
    {"catalog_id": "SAM-001", "brand": "samsung", "indoor_model": "AR09BVHQBWKNAZ",
     "model_family": "ar09bvhq", "technology": "inverter"},
    {"catalog_id": "DAI-001", "brand": "daikin", "indoor_model": "FTXS35LVMA",
     "model_family": "ftxs35", "technology": "inverter"},
    {"catalog_id": "MID-001", "brand": "midea", "indoor_model": "MAC12CS1",
     "model_family": "mac12cs1", "technology": "inverter"},
]


@pytest.fixture
def mock_catalog_jsonl(tmp_path: Path) -> Path:
    """Write SAMPLE_CATALOG to a temp JSONL file, return path."""
    catalog_path = tmp_path / "inmetro_ac_br_models.jsonl"
    with catalog_path.open("w", encoding="utf-8") as f:
        for rec in SAMPLE_CATALOG:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return catalog_path


@pytest.fixture
def sample_catalog() -> list[dict]:
    return list(SAMPLE_CATALOG)


# ── Checkpoint fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def checkpoint_path(tmp_path: Path) -> Path:
    return tmp_path / "pipeline_checkpoint.json"


@pytest.fixture
def empty_checkpoint() -> dict:
    return {"completed_steps": [], "pdf_status": {}, "started_at": None}


# ── PT-BR text fixtures ────────────────────────────────────────────────────────

PT_TEXT = (
    "Manual de serviço do ar condicionado. "
    "Instalação e especificação do equipamento. "
    "Segurança: advertência importante para refrigeração. "
    "Tabela de figuras e unidade de alimentação. "
    "Precauções de cuidado e aviso de serviço."
)

EN_TEXT = (
    "Service manual for air conditioning unit. "
    "Installation and specification of the equipment. "
    "Safety: warning for refrigerant handling. "
    "Table of figures and power supply unit. "
    "Caution: operation and usage instructions."
)

ES_TEXT = (
    "Manual de servicio del aire acondicionado. "
    "Instalación y especificación del equipo. "
    "Seguridad: advertencia importante para refrigeración. "
    "Tabla de figuras y unidad de alimentación. "
    "Precaución de cuidado y aviso de servicio."
)

BILINGUAL_PT_EN_TEXT = PT_TEXT + " " + EN_TEXT  # mixed — must not be rejected

@pytest.fixture
def pt_text() -> str:
    return PT_TEXT

@pytest.fixture
def en_text() -> str:
    return EN_TEXT

@pytest.fixture
def es_text() -> str:
    return ES_TEXT

@pytest.fixture
def bilingual_pt_en() -> str:
    return BILINGUAL_PT_EN_TEXT


# ── Qdrant mock fixtures ───────────────────────────────────────────────────────

@pytest.fixture
def indexed_models() -> set:
    """Set of already-indexed brand::model_family keys."""
    return {"lg::arnu12gtmc2"}


# ── pending_review fixtures ────────────────────────────────────────────────────

@pytest.fixture
def pending_review_path(tmp_path: Path) -> Path:
    return tmp_path / "reports" / "pending_review.jsonl"


# ── Document record fixture ────────────────────────────────────────────────────

@pytest.fixture
def sample_doc_record(tmp_path: Path) -> dict:
    """Minimal documents.jsonl record as written by hvac_add_manual.py."""
    md_path = tmp_path / "processed" / "markdown" / "doc_abc123.md"
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(PT_TEXT, encoding="utf-8")
    return {
        "doc_id": "doc_abc123",
        "source_pdf": str(tmp_path / "incoming" / "test.pdf"),
        "raw_sha256": "deadbeef" * 8,
        "normalized_text_sha256": "cafebabe" * 8,
        "domain_score": 0.85,
        "domain_status": "hvac",
        "doc_type": "service_manual",
        "duplicate_status": "unique",
        "duplicate_of": None,
        "possible_duplicate_score": 0.0,
        "catalog_match": None,
        "processing_status": "intake_done",
        "md_path": str(md_path),
        "timestamp": "2026-05-05T00:00:00Z",
    }
