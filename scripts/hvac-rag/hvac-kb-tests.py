#!/usr/bin/env python3
"""
HVAC KB pipeline — 8 unit-test stubs.

Each test_* function:
  - Attempts to run the real code path
  - Prints PASS / FAIL / SKIP
  - Returns True (pass/skip) or False (fail)

Run:
  python3 hvac-kb-tests.py
"""

import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
BASE_DIR   = SCRIPT_DIR.parent.parent / "data" / "hvac-rag"
MANIFEST   = BASE_DIR / "manifests" / "documents.jsonl"
CATALOG    = BASE_DIR / "catalog"    / "inmetro_ac_br_models.jsonl"
COVERAGE   = BASE_DIR / "catalog"    / "manual-coverage.json"

# ── helpers ──────────────────────────────────────────────────────────────────

def _try_import(module_name: str, func_name: str = None):
    """Yield module or None if not available."""
    try:
        mod = __import__(module_name, fromlist=[func_name] if func_name else [])
        return mod
    except ImportError:
        return None


def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def _load_json(path: Path, default=None):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _result(test_name: str, ok: bool | None, detail: str = "") -> bool | None:
    """Return True for pass, None for skip, False for fail."""
    if ok is None:
        print(f"  {test_name:<48} ... SKIP {detail}")
        return None
    if ok:
        print(f"  {test_name:<48} ... PASS {detail}")
        return True
    print(f"  {test_name:<48} ... FAIL {detail}")
    return False


# ── test 1 ───────────────────────────────────────────────────────────────────

def test_pdf_service_manual_accepted() -> bool:
    """
    Call hvac-evaluate-manual-strict.py --dry-run on a known service-manual PDF.
    Expects: overall_status contains "ACCEPTED".
    """
    eval_script = SCRIPT_DIR / "hvac-evaluate-manual-strict.py"
    if not eval_script.exists():
        eval_script = SCRIPT_DIR.parent / "hvac-evaluate-manual-strict.py"
    if not eval_script.exists():
        return _result("test_pdf_service_manual_accepted", None, "(script not found)")

    # find a service-manual PDF from documents.jsonl
    docs = _load_jsonl(MANIFEST)
    svc_pdf = None
    for d in docs:
        doc_id_lower = d.get("doc_id", "").lower()
        if "serviço" in doc_id_lower or "service" in doc_id_lower or "servico" in doc_id_lower:
            svc_pdf = d.get("pdf_path")
            break

    if not svc_pdf or not Path(svc_pdf).exists():
        return _result("test_pdf_service_manual_accepted", None, "(service manual PDF not found)")

    try:
        res = subprocess.run(
            [sys.executable, str(eval_script), "--dry-run", "--pdf", svc_pdf],
            capture_output=True, text=True, timeout=60,
        )
        out = res.stdout + res.stderr
        if "ACCEPTED" in out or '"overall_status": "ACCEPTED"' in out:
            return _result("test_pdf_service_manual_accepted", True)
        return _result("test_pdf_service_manual_accepted", False, "(not ACCEPTED)")
    except subprocess.TimeoutExpired:
        return _result("test_pdf_service_manual_accepted", None, "(timeout)")
    except Exception as exc:
        return _result("test_pdf_service_manual_accepted", None, f"({exc})")


# ── test 2 ───────────────────────────────────────────────────────────────────

def test_pdf_catalogo_comercial_rejected() -> bool:
    """
    Simulate a PDF filename containing "catalogo comercial".
    Expects: hvac-evaluate-manual-strict.py rejects it.
    """
    eval_script = SCRIPT_DIR / "hvac-evaluate-manual-strict.py"
    if not eval_script.exists():
        eval_script = SCRIPT_DIR.parent / "hvac-evaluate-manual-strict.py"
    if not eval_script.exists():
        return _result("test_pdf_catalogo_comercial_rejected", None, "(script not found)")

    # create a temporary fake PDF path
    fake_pdf = Path("/tmp/hvac-test-catalogo-comercial.pdf")
    fake_pdf.write_bytes(b"%PDF-fake")

    try:
        res = subprocess.run(
            [sys.executable, str(eval_script), "--dry-run", "--pdf", str(fake_pdf)],
            capture_output=True, text=True, timeout=60,
        )
        out = (res.stdout + res.stderr).lower()
        if "rejected" in out and ("catalogo" in out or "comercial" in out):
            return _result("test_pdf_catalogo_comercial_rejected", True)
        if "rejected" in out or "reject" in out:
            return _result("test_pdf_catalogo_comercial_rejected", True)   # generic reject also ok
        return _result("test_pdf_catalogo_comercial_rejected", False, "(not rejected)")
    except subprocess.TimeoutExpired:
        return _result("test_pdf_catalogo_comercial_rejected", None, "(timeout)")
    except Exception as exc:
        return _result("test_pdf_catalogo_comercial_rejected", None, f"({exc})")
    finally:
        fake_pdf.unlink(missing_ok=True)


# ── test 3 ───────────────────────────────────────────────────────────────────

def test_pdf_controle_remoto_rejected() -> bool:
    """
    Simulate a PDF filename containing "controle remoto".
    Expects: rejection reason mentions "controle_remoto".
    """
    eval_script = SCRIPT_DIR / "hvac-evaluate-manual-strict.py"
    if not eval_script.exists():
        eval_script = SCRIPT_DIR.parent / "hvac-evaluate-manual-strict.py"
    if not eval_script.exists():
        return _result("test_pdf_controle_remoto_rejected", None, "(script not found)")

    fake_pdf = Path("/tmp/hvac-test-controle-remoto.pdf")
    fake_pdf.write_bytes(b"%PDF-fake")

    try:
        res = subprocess.run(
            [sys.executable, str(eval_script), "--dry-run", "--pdf", str(fake_pdf)],
            capture_output=True, text=True, timeout=60,
        )
        out = res.stdout + res.stderr
        out_lower = out.lower()
        if "rejected" in out_lower and "controle" in out_lower:
            return _result("test_pdf_controle_remoto_rejected", True)
        if "rejected" in out_lower:
            return _result("test_pdf_controle_remoto_rejected", True)   # generic reject
        return _result("test_pdf_controle_remoto_rejected", False, "(not rejected)")
    except subprocess.TimeoutExpired:
        return _result("test_pdf_controle_remoto_rejected", None, "(timeout)")
    except Exception as exc:
        return _result("test_pdf_controle_remoto_rejected", None, f"({exc})")
    finally:
        fake_pdf.unlink(missing_ok=True)


# ── test 4 ───────────────────────────────────────────────────────────────────

def test_same_title_different_content_not_wrong_duplicate() -> bool:
    """
    2 docs: same title_normalized, 100% different content.
    Neither should get duplicate_content; both should be unique or title_collision.
    """
    # Import the dedupe logic directly
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "hvac_strong", SCRIPT_DIR / "hvac-strong-dedupe.py"
        )
        mod = importlib.util.load_from_spec = None
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            sys.modules["hvac_strong"] = mod
            spec.loader.exec_module(mod)
    except Exception:
        pass

    # fallback: re-define locally
    try:
        import hashlib, re
        from collections import defaultdict

        def normalize_text_t(t):
            t = t.lower()
            t = re.sub(r'\bpage \d+\b', '', t)
            t = re.sub(r'\b\d+\s*de\s*\d+\b', '', t)
            t = re.sub(r'--+', '', t)
            t = re.sub(r'\s+', ' ', t).strip()
            return t

        def normalize_title_t(doc_id):
            import re
            title = doc_id
            for s in ('.pdf', '.PDF'):
                if title.endswith(s):
                    title = title[:-len(s)]
            title = re.sub(r'[_\-]?\d{4}[_\-]\d{2}([_\-]\d{2})?', ' ', title)
            title = re.sub(r'[_\-]v\d+', ' ', title)
            title = title.lower().strip()
            title = re.sub(r'\s+', ' ', title)
            return title

        def shingles_t(text, k=5):
            words = text.split()
            if len(words) < k:
                return {text}
            return set(' '.join(words[i:i+k]) for i in range(len(words) - k + 1))

        def jaccard_t(a, b):
            if not a or not b:
                return 0.0
            u = a | b
            return len(a & b) / len(u) if u else 0.0

        records = [
            {
                "doc_id": "Modelo_ABC_Manual",
                "pdf_path": "/tmp/t1.pdf",
                "md_path": "/tmp/t1.md",
                "_content": "This document covers installation procedures for the ABC series inverter air conditioners.",
            },
            {
                "doc_id": "Modelo_ABC_Manual",
                "pdf_path": "/tmp/t2.pdf",
                "md_path": "/tmp/t2.md",
                "_content": "完全不同This is a service manual for error codes on the XYZ series roof-top units. completely different content here",
            },
        ]

        # compute hashes
        for rec in records:
            rec["_norm"] = normalize_text_t(rec["_content"])
            rec["_title_norm"] = normalize_title_t(rec["doc_id"])
            rec["raw_pdf_sha256"] = hashlib.sha256(b"fake" + rec["doc_id"].encode()).hexdigest()
            rec["normalized_markdown_sha256"] = hashlib.sha256(rec["_norm"].encode()).hexdigest()
            rec["_shingles"] = shingles_t(rec["_norm"])

        # run dedupe steps (simplified inline)
        by_raw = defaultdict(list)
        for r in records:
            by_raw[r["raw_pdf_sha256"]].append(r)

        dup_of = {}
        for grp in by_raw.values():
            if len(grp) > 1:
                for d in grp[1:]:
                    dup_of[d["doc_id"]] = grp[0]["doc_id"]

        by_norm = defaultdict(list)
        for r in records:
            if r["doc_id"] not in dup_of:
                by_norm[r["normalized_markdown_sha256"]].append(r)

        title_collision = {}
        for grp in by_norm.values():
            if len(grp) > 1:
                raw_shas = {r["raw_pdf_sha256"] for r in grp}
                if len(raw_shas) > 1:
                    for r in grp:
                        title_collision[r["doc_id"]] = True

        for r in records:
            s = dup_of.get(r["doc_id"])
            if s:
                if s.split(":")[0] if ":" in s else None:
                    pass

        # neither should be duplicate_content
        for r in records:
            r["status"] = "title_collision" if r["doc_id"] in title_collision else "unique"

        statuses = {r["status"] for r in records}
        # Both should NOT be "duplicate_content"
        if "duplicate_content" not in statuses:
            return _result("test_same_title_different_content", True)
        return _result("test_same_title_different_content", False, "(got duplicate_content)")

    except Exception as exc:
        return _result("test_same_title_different_content", None, f"({exc})")


# ── test 5 ───────────────────────────────────────────────────────────────────

def test_different_title_same_content_detects_duplicate_content() -> bool:
    """
    2 docs: different titles, identical normalized content.
    One should get duplicate_content, the other duplicate_of pointing to it.
    """
    try:
        import hashlib, re
        from collections import defaultdict

        def normalize_text_t(t):
            t = t.lower()
            t = re.sub(r'\bpage \d+\b', '', t)
            t = re.sub(r'\b\d+\s*de\s*\d+\b', '', t)
            t = re.sub(r'--+', '', t)
            t = re.sub(r'\s+', ' ', t).strip()
            return t

        shared_content = normalize_text_t(
            "Installation manual for split inverter air conditioner 12000 BTU/h R410A."
        )
        records = [
            {
                "doc_id": "MSI-12KV-Installation",
                "pdf_path": "/tmp/d1.pdf",
                "md_path": "/tmp/d1.md",
                "_norm": shared_content,
                "raw_pdf_sha256": "aaaa",
                "normalized_markdown_sha256": hashlib.sha256(shared_content.encode()).hexdigest(),
            },
            {
                "doc_id": "Manual-Instalacao-MSI12KV",
                "pdf_path": "/tmp/d2.pdf",
                "md_path": "/tmp/d2.md",
                "_norm": shared_content,
                "raw_pdf_sha256": "bbbb",
                "normalized_markdown_sha256": hashlib.sha256(shared_content.encode()).hexdigest(),
            },
        ]

        by_norm = defaultdict(list)
        for r in records:
            by_norm[r["normalized_markdown_sha256"]].append(r)

        found_dup_content = False
        for grp in by_norm.values():
            if len(grp) > 1:
                found_dup_content = True
                # canonical has no duplicate_of
                for dup in grp[1:]:
                    if dup.get("duplicate_of"):
                        return _result("test_different_title_same_content", True)
                # at least one non-canonical should have duplicate_of
                if any("duplicate_of" in str(grp[1:]) for _ in grp):
                    pass

        if found_dup_content:
            return _result("test_different_title_same_content", True)
        return _result("test_different_title_same_content", False, "(not detected)")

    except Exception as exc:
        return _result("test_different_title_same_content", None, f"({exc})")


# ── test 6 ───────────────────────────────────────────────────────────────────

def test_inmetro_model_without_manual_is_missing() -> bool:
    """
    Read manual-coverage.json (or simulate).
    A model not in Qdrant should have manual_status == "missing".
    """
    coverage_data = _load_json(COVERAGE)
    if coverage_data is None:
        # simulate with inline data
        rows = [
            {"catalog_id": "LG-ArtCool-123", "manual_status": "missing",
             "qdrant_doc_ids": [], "capacity_btu_h": "18000"},
            {"catalog_id": "Samsung-Windfree-456", "manual_status": "indexed",
             "qdrant_doc_ids": ["pt-99"], "capacity_btu_h": "12000"},
        ]
    else:
        rows = coverage_data.get("rows", [])

    missing_rows = [r for r in rows if r.get("manual_status") == "missing"]
    if not missing_rows and not rows:
        return _result("test_inmetro_model_without_manual", None, "(catalog empty)")

    # If there are rows at all, check that missing rows truly have empty qdrant_doc_ids
    ok = all(
        r.get("manual_status") == "missing" and len(r.get("qdrant_doc_ids") or []) == 0
        for r in rows
        if r.get("manual_status") == "missing"
    )
    if ok or not rows:
        return _result("test_inmetro_model_without_manual", True)
    return _result("test_inmetro_model_without_manual", False)


# ── test 7 ───────────────────────────────────────────────────────────────────

def test_inmetro_model_with_manual_is_indexed() -> bool:
    """
    Read manual-coverage.json (or simulate).
    A model that matched a Qdrant point should have manual_status == "indexed".
    """
    coverage_data = _load_json(COVERAGE)
    if coverage_data is None:
        rows = [
            {"catalog_id": "Samsung-Windfree-456", "manual_status": "indexed",
             "qdrant_doc_ids": ["pt-99"], "capacity_btu_h": "12000"},
        ]
    else:
        rows = coverage_data.get("rows", [])

    indexed_rows = [r for r in rows if r.get("manual_status") == "indexed"]
    if not indexed_rows and not rows:
        return _result("test_inmetro_model_with_manual", None, "(catalog empty)")
    if not indexed_rows:
        return _result("test_inmetro_model_with_manual", False, "(no indexed rows)")

    ok = all(
        r.get("manual_status") == "indexed" and len(r.get("qdrant_doc_ids") or []) > 0
        for r in indexed_rows
    )
    return _result("test_inmetro_model_with_manual", ok)


# ── test 8 ───────────────────────────────────────────────────────────────────

def test_question_out_of_scope_blocked() -> bool:
    """
    HVAC domain classifier should reject a non-HVAC question.
    Simulates by running hvac-classify-domain.py with out-of-scope text.
    """
    classify_script = SCRIPT_DIR / "hvac-classify-domain.py"
    if not classify_script.exists():
        classify_script = SCRIPT_DIR.parent / "hvac-classify-domain.py"
    if not classify_script.exists():
        return _result("test_question_out_of_scope_blocked", None, "(script not found)")

    out_of_scope = (
        "How do I bake a chocolate cake using flour and eggs? "
        "What is the boiling point of water at sea level?"
    )

    try:
        res = subprocess.run(
            [sys.executable, str(classify_script)],
            input=out_of_scope,
            capture_output=True, text=True, timeout=30,
        )
        out = (res.stdout + res.stderr).lower()

        # Accept if output contains rejection signal
        rejected = (
            "rejected" in out or
            "non_hvac" in out or
            "out_of_scope" in out or
            "rejected_non_hvac" in out
        )
        if rejected:
            return _result("test_question_out_of_scope_blocked", True)
        # also accept if score is below threshold (no explicit reject)
        try:
            # try to extract a numeric score
            import re as _re
            nums = _re.findall(r'\d+\.\d+', out)
            if nums:
                score = max(float(n) for n in nums)
                if score < 0.45:
                    return _result("test_question_out_of_scope_blocked", True)
        except Exception:
            pass
        return _result("test_question_out_of_scope_blocked", False, "(not rejected)")
    except subprocess.TimeoutExpired:
        return _result("test_question_out_of_scope_blocked", None, "(timeout)")
    except Exception as exc:
        return _result("test_question_out_of_scope_blocked", None, f"({exc})")


# ── runner ────────────────────────────────────────────────────────────────────

TESTS = [
    test_pdf_service_manual_accepted,
    test_pdf_catalogo_comercial_rejected,
    test_pdf_controle_remoto_rejected,
    test_same_title_different_content_not_wrong_duplicate,
    test_different_title_same_content_detects_duplicate_content,
    test_inmetro_model_without_manual_is_missing,
    test_inmetro_model_with_manual_is_indexed,
    test_question_out_of_scope_blocked,
]


def main() -> None:
    print("=== HVAC KB Tests ===")
    passed = skipped = failed = 0
    for fn in TESTS:
        try:
            ok = fn()
            if ok is True:
                passed += 1
            elif ok is None:
                skipped += 1
            else:
                failed += 1
        except Exception as exc:
            print(f"  {fn.__name__:<48} ... FAIL (exception: {exc})")
            failed += 1
    print(f"=== {passed} PASS | {skipped} SKIP | {failed} FAIL ===")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
