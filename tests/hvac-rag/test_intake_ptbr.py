"""INTAKE-01: PT-BR language gate in hvac_add_manual.py."""
import pytest


def test_detect_ptbr_returns_ptbr_for_portuguese(pt_text):
    """PT-heavy text must return language='pt-BR'."""
    hvac_add_manual = pytest.importorskip(
        "hvac_add_manual",
        reason="hvac_add_manual.py not yet modified (Wave 2, Plan 03)"
    )
    lang, conf = hvac_add_manual.detect_ptbr(pt_text)
    assert lang == "pt-BR", f"Expected 'pt-BR', got '{lang}'"
    assert conf > 0.5, f"Expected confidence > 0.5 for PT text, got {conf}"


def test_detect_ptbr_returns_en_for_english(en_text):
    """English-only text must return language='en'."""
    hvac_add_manual = pytest.importorskip("hvac_add_manual", reason="Wave 2 Plan 03")
    lang, conf = hvac_add_manual.detect_ptbr(en_text)
    assert lang == "en", f"Expected 'en', got '{lang}'"
    assert conf > 0.5, f"Expected confidence > 0.5 for EN text, got {conf}"


def test_check_ptbr_allows_ptbr_document(pt_text):
    """PT-BR document must be allowed by check_ptbr gate."""
    hvac_add_manual = pytest.importorskip("hvac_add_manual", reason="Wave 2 Plan 03")
    policy = {"require_ptbr": True}
    allowed, reason = hvac_add_manual.check_ptbr(pt_text, policy)
    assert allowed is True, f"PT-BR document must be allowed, got reason: {reason}"
    assert reason is None


def test_check_ptbr_rejects_confirmed_english(en_text):
    """Confirmed English document must be rejected when require_ptbr=True."""
    hvac_add_manual = pytest.importorskip("hvac_add_manual", reason="Wave 2 Plan 03")
    policy = {"require_ptbr": True}
    allowed, reason = hvac_add_manual.check_ptbr(en_text, policy)
    assert allowed is False, "Confirmed English document must be rejected"
    assert reason is not None and "language_not_ptbr" in reason


def test_check_ptbr_allows_bilingual_document(bilingual_pt_en):
    """Bilingual PT+EN document must not be rejected (ANTI-PATTERN: reject bilingual manuals)."""
    hvac_add_manual = pytest.importorskip("hvac_add_manual", reason="Wave 2 Plan 03")
    policy = {"require_ptbr": True}
    allowed, reason = hvac_add_manual.check_ptbr(bilingual_pt_en, policy)
    assert allowed is True, f"Bilingual PT+EN must be allowed, got: {reason}"


def test_check_ptbr_skips_when_policy_disabled(en_text):
    """When require_ptbr is False or absent, even English docs must be accepted."""
    hvac_add_manual = pytest.importorskip("hvac_add_manual", reason="Wave 2 Plan 03")
    policy = {}  # require_ptbr not set
    allowed, reason = hvac_add_manual.check_ptbr(en_text, policy)
    assert allowed is True
    assert reason is None


def test_check_ptbr_accepts_unknown_language():
    """Empty or diagram-only PDFs (no language signals) must not be rejected."""
    hvac_add_manual = pytest.importorskip("hvac_add_manual", reason="Wave 2 Plan 03")
    policy = {"require_ptbr": True}
    no_signals_text = "Fig. 1 — Schema A4 17.2kW ±0.3 R-410A"
    allowed, reason = hvac_add_manual.check_ptbr(no_signals_text, policy)
    assert allowed is True, f"Unknown-language doc must be accepted, got: {reason}"
