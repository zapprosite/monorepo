#!/srv/data/hvac-rag/.venv/bin/python3
"""
HVAC RAG — PDF intake pipeline.

python3 hvac_add_manual.py [--dry-run] [--index] [--policy-yaml PATH] <pdf_path>

Steps:
  1. Validate input PDF exists
  2. Compute fingerprint (raw + norm SHA256)
  3. Score HVAC domain (classify)
  4. Apply document policy (YAML)
  5. Deduplicate against manifests/documents.jsonl
  6. Detect document type (hvac-normalize)
  7. Accept or reject
  8. Process (convert + write manifest) if ACCEPTED and --index
  9. Match against Inmetro catalog (informational)
"""
import sys
import json
import hashlib
import re
import yaml
from pathlib import Path
from datetime import datetime, date, timezone

# ── prepend scripts dir so we can import the modules ──────────────────────────
SCRIPTS_DIR = Path("/srv/monorepo/scripts/hvac-rag")
sys.path.insert(0, str(SCRIPTS_DIR))

from hvac_fingerprint import fingerprint as fp_fingerprint, normalize_text
from hvac_classify_domain import classify as domain_classify
from hvac_normalize import detect_doc_type, extract_model_candidates
from hvac_chunk import docling_convert


# ── helpers ───────────────────────────────────────────────────────────────────

def jaccard_shingles(text: str, k: int = 5) -> float:
    """Jaccard similarity of 5-word shingles against a normalised reference."""
    words = text.split()
    if len(words) < k:
        return 0.0
    shingles_a = set(' '.join(words[i:i + k]) for i in range(len(words) - k + 1))
    return shingles_a  # caller passes other set


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def compute_raw_sha256(pdf_path: Path) -> str:
    return hashlib.sha256(pdf_path.read_bytes()).hexdigest()


def compute_norm_sha256(markdown_text: str) -> str:
    norm = normalize_text(markdown_text)
    return hashlib.sha256(norm.encode()).hexdigest()


def load_manifest(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.open()]


def load_policy(policy_path: Path) -> dict:
    if not policy_path.exists():
        raise FileNotFoundError(f"Policy file not found: {policy_path}")
    return yaml.safe_load(policy_path.read_text())


def policy_signal_score(text_lower: str, policy: dict) -> float:
    """
    Compute a normalised HVAC signal score (0.0–1.0) from the policy YAML.
    New-format policy uses simple keyword lists (no regex weights).
    Each positive keyword hit = +1. Each negative hit = -1.
    Raw score is divided by total keyword count and clamped to [0, 1].
    """
    pos_kws = policy.get("hvac_signals", {}).get("positive", [])
    neg_kws = policy.get("hvac_signals", {}).get("negative", [])

    if isinstance(pos_kws, dict):
        # Legacy weighted format: list of [pattern, weight] pairs
        score = 0.0
        for item in pos_kws:
            pattern, weight = item[0], float(item[1])
            score += weight * len(re.findall(pattern, text_lower, re.IGNORECASE))
        for item in neg_kws:
            pattern, weight = item[0], float(item[1])
            score += weight * len(re.findall(pattern, text_lower, re.IGNORECASE))
        return round(max(score, 0.0), 4)

    # New-format: flat keyword lists
    pos_hits = sum(1 for kw in pos_kws if kw.lower() in text_lower)
    neg_hits = sum(1 for kw in neg_kws if kw.lower() in text_lower)
    total = len(pos_kws) + len(neg_kws)
    if total == 0:
        return 1.0
    raw = (pos_hits - neg_hits) / total
    return round(max(raw, 0.0), 4)


def filename_blacklisted(fname_lower: str, policy: dict) -> tuple[bool, str | None]:
    for kw in policy.get("blacklist_keywords", []):
        if kw.lower() in fname_lower:
            return True, f"blacklist_keyword:'{kw}'"
    return False, None


def doc_type_blacklisted(doc_type: str, policy: dict) -> bool:
    return doc_type in policy.get("blacklist_doc_types", [])


def check_inverter(text_lower: str, policy: dict) -> bool:
    if not policy.get("inverter_required", False):
        return True
    return "inverter" in text_lower


# ── catalog match ─────────────────────────────────────────────────────────────

def match_inmetro_catalog(text: str, catalog_path: Path) -> dict:
    """
    Attempt fuzzy case-insensitive match of indoor/outdoor model tokens
    from the Inmetro AC catalog against the document text.
    Returns dict with catalog_id and matched_model (both null if no match).
    """
    result = {"catalog_id": None, "matched_model": None}
    if not catalog_path.exists():
        return result

    text_lower = text.lower()
    seen: set[str] = set()

    for line in catalog_path.open():
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        catalog_id = entry.get("catalog_id", "")
        brands_models: list[str] = []

        for field in ("indoor_model", "outdoor_model", "model"):
            val = entry.get(field, "")
            if val:
                brands_models.append(str(val))

        for model in brands_models:
            m_lower = model.lower().strip()
            if not m_lower or m_lower in seen:
                continue
            seen.add(m_lower)
            # Fuzzy: model token appears as whole word in text
            if re.search(r'\b' + re.escape(m_lower) + r'\b', text_lower, re.IGNORECASE):
                result["catalog_id"] = catalog_id
                result["matched_model"] = model
                return result   # return on first hit

    return result


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    dry_run = "--dry-run" in sys.argv
    do_index = "--index" in sys.argv

    policy_arg_idx = None
    for i, arg in enumerate(sys.argv):
        if arg == "--policy-yaml" and i + 1 < len(sys.argv):
            policy_arg_idx = i + 1
    if policy_arg_idx is not None:
        policy_path = Path(sys.argv[policy_arg_idx])
    else:
        policy_path = Path("/srv/monorepo/config/hvac-rag/document-policy.yaml")

    # positional pdf_path
    positional = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(positional) != 1:
        print("Usage: hvac-add-manual.py [--dry-run] [--index] [--policy-yaml PATH] <pdf_path>",
              file=sys.stderr)
        sys.exit(1)
    pdf_path = Path(positional[0]).resolve()

    # ── Step 1: validate ─────────────────────────────────────────────────────
    if not pdf_path.exists():
        print(f"ERROR: PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    # ── Load shared resources ───────────────────────────────────────────────
    manifest_path = Path("/srv/data/hvac-rag/manifests/documents.jsonl")
    catalog_path  = Path("/srv/data/hvac-rag/catalog/inmetro_ac_br_models.jsonl")
    policy = load_policy(policy_path)

    print(f"[{pdf_path.name}]")
    print(f"  policy: {policy_path}")

    # ── Step 2: fingerprint ──────────────────────────────────────────────────
    # We need markdown text before calling fp_fingerprint(pdf, md).
    # Convert first so we have md_path; store intermediate sha256 values.
    if not dry_run:
        md_out = Path("/srv/data/hvac-rag/processed/markdown")
        md_out.mkdir(parents=True, exist_ok=True)
        md_path = md_out / f"{pdf_path.stem}.md"
        try:
            docling_convert(str(pdf_path), str(md_path))
        except Exception as exc:
            print(f"  ⚠️  Docling failed (continuing without md): {exc}")
            md_path = None
    else:
        # In dry-run we only need the markdown text to compute hashes;
        # try to read a pre-existing .md so fingerprint values are still shown.
        md_out = Path("/srv/data/hvac-rag/processed/markdown")
        candidates = [
            md_out / f"{pdf_path.stem}.md",
            md_out / f"{pdf_path.stem.replace(' ', '-')}.md",
        ]
        md_path = next((p for p in candidates if p.exists()), None)
        if md_path:
            print(f"  (found existing markdown: {md_path.name})")

    raw_sha256 = compute_raw_sha256(pdf_path)

    if md_path and md_path.exists():
        md_text = md_path.read_text(errors="ignore")
        norm_sha256 = compute_norm_sha256(md_text)
    else:
        md_text = ""
        norm_sha256 = "n/a_no_markdown"

    print(f"  raw_sha256:          {raw_sha256}")
    print(f"  normalized_md_sha256:{norm_sha256}")

    # ── Step 3: domain classification ───────────────────────────────────────
    domain_result: dict
    if md_path and md_path.exists():
        domain_result = domain_classify(str(md_path))
    else:
        # Fallback: empty text → worst-case score
        domain_result = {"domain_score": 0.0, "domain_status": "rejected_non_hvac",
                          "hit_count": 0, "top_hits": []}

    domain_score  = domain_result.get("domain_score", 0.0)
    domain_status = domain_result.get("domain_status", "rejected_non_hvac")

    print(f"  domain_score:  {domain_score}")
    print(f"  domain_status: {domain_status}")

    # ── Step 4: document policy ─────────────────────────────────────────────
    fname_lower = pdf_path.name.lower()
    reject_reason: str | None = None
    reject_source = ""

    # 4a: filename blacklist
    bl, reason = filename_blacklisted(fname_lower, policy)
    if bl:
        reject_reason = reason
        reject_source = "policy_filename"

    # 4b: inverter check
    if not reject_reason and md_text:
        if not check_inverter(md_text.lower(), policy):
            reject_reason = "inverter_required_not_found"
            reject_source = "policy_inverter"

    # 4c: policy signal score
    policy_score = 0.0
    if md_text and not reject_reason:
        policy_score = policy_signal_score(md_text.lower(), policy)
        min_q = policy.get("min_document_quality_score", 0.5)
        if policy_score < min_q:
            reject_reason = f"policy_score_too_low({policy_score}<{min_q})"
            reject_source = "policy_signal"

    print(f"  policy_score: {policy_score}")

    # ── Step 5: deduplication ────────────────────────────────────────────────
    existing = load_manifest(manifest_path)
    duplicate_status = "unique"
    duplicate_of: str | None = None
    possible_duplicate_score = 0.0

    # Build lookup maps
    raw_map: dict[str, dict]  = {}   # raw_sha256 → record
    norm_map: dict[str, list[dict]] = {}  # norm_sha256 → [records]

    for rec in existing:
        r_raw = rec.get("raw_sha256", "")
        r_norm = rec.get("normalized_text_sha256", rec.get("normalized_markdown_sha256", ""))
        if r_raw:
            raw_map[r_raw] = rec
        if r_norm and r_norm != "n/a":
            norm_map.setdefault(r_norm, []).append(rec)

    # Exact duplicate (same raw PDF bytes)
    if raw_sha256 in raw_map:
        duplicate_status = "duplicate_exact"
        duplicate_of = raw_map[raw_sha256].get("doc_id", raw_map[raw_sha256].get("pdf_path", ""))
        reject_reason = "duplicate_exact"
        reject_source = "dedupe"
        print(f"  dedupe: EXACT → doc_id={duplicate_of}")

    # Content duplicate (same normalised text, different PDF)
    elif norm_sha256 != "n/a_no_markdown" and norm_sha256 in norm_map:
        candidates = norm_map[norm_sha256]
        duplicate_status = "duplicate_content"
        duplicate_of = candidates[0].get("doc_id", candidates[0].get("pdf_path", ""))
        possible_duplicate_score = 1.0
        print(f"  dedupe: CONTENT (norm match) → doc_id={duplicate_of}")

    # Fuzzy: Jaccard shingles (only when no exact/content match found)
    else:
        shingles_ref: set = set()
        if md_text:
            norm_text = normalize_text(md_text)
            shingles_ref = jaccard_shingles(norm_text, k=5)

        best_score = 0.0
        best_doc_id: str | None = None

        for rec in existing:
            # skip already-matched exact/content duplicates
            if rec.get("raw_sha256") == raw_sha256:
                continue
            # load existing markdown for shingles
            rec_md_path_str = rec.get("md_path", "")
            if rec_md_path_str:
                rec_md = Path(rec_md_path_str)
                if rec_md.exists():
                    rec_text = rec_md.read_text(errors="ignore")
                    rec_norm = normalize_text(rec_text)
                    shingles_rec = jaccard_shingles(rec_norm, k=5)
                    sim = jaccard(shingles_ref, shingles_rec)
                    if sim > best_score:
                        best_score = sim
                        best_doc_id = rec.get("doc_id", rec.get("pdf_path", ""))

        if best_score >= 0.85:
            duplicate_status = "duplicate_content"
            duplicate_of = best_doc_id
            possible_duplicate_score = round(best_score, 4)
            print(f"  dedupe: FUZZY (Jaccard={best_score:.3f}) → doc_id={best_doc_id}")
        else:
            print(f"  dedupe: unique (best fuzzy={best_score:.3f})")

    # ── Step 6: document type detection ────────────────────────────────────
    doc_type = "unknown"
    if md_text:
        doc_type = detect_doc_type(md_text)

    doc_type_rejected = doc_type_blacklisted(doc_type, policy)
    whitelist_types = policy.get("whitelist_doc_types", [])

    print(f"  doc_type: {doc_type}")

    # ── Step 7: overall acceptance decision ─────────────────────────────────
    # Build up rejection chain
    if not reject_reason:
        if domain_status == "rejected_non_hvac":
            reject_reason = "domain_rejected_non_hvac"
            reject_source = "classify"
        elif domain_score < 0.45:
            reject_reason = f"domain_score_too_low({domain_score}<0.45)"
            reject_source = "classify"
        elif doc_type_rejected:
            reject_reason = f"blacklisted_doc_type:{doc_type}"
            reject_source = "policy_doc_type"
        elif doc_type not in whitelist_types and domain_status == "needs_review":
            # keep needs_review status — do not reject
            pass

    # Final verdict
    if reject_reason:
        overall_status = "REJECTED"
        verdict_label = f"❌ REJECTED: {reject_reason}"
        print(f"\n{verdict_label}")
    else:
        overall_status = "ACCEPTED"
        verdict_label = f"✅ ACCEPTED: {doc_type}"
        print(f"\n{verdict_label}")

    # ── Step 9: catalog match (informational) ───────────────────────────────
    catalog_match = {"catalog_id": None, "matched_model": None}
    if md_text:
        catalog_match = match_inmetro_catalog(md_text, catalog_path)
        if catalog_match["catalog_id"]:
            print(f"  📋 Catalog match: {catalog_match['catalog_id']} — {catalog_match['matched_model']}")

    # ── Build output record ──────────────────────────────────────────────────
    doc_id = raw_sha256[:16]
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    result = {
        "doc_id": doc_id,
        "pdf_path": str(pdf_path),
        "raw_pdf_sha256": raw_sha256,
        "normalized_markdown_sha256": norm_sha256,
        "domain_score": round(domain_score, 4),
        "domain_status": domain_status,
        "policy_score": policy_score,
        "doc_type": doc_type,
        "duplicate_status": duplicate_status,
        "duplicate_of": duplicate_of,
        "possible_duplicate_score": round(possible_duplicate_score, 4),
        "catalog_match": catalog_match,
        "overall_status": overall_status,
        "rejection_reason": reject_reason,
        "manifest_written": False,
        "indexed": False,
        "dry_run": dry_run,
        "timestamp": ts,
    }

    # ── Print JSON to stdout ─────────────────────────────────────────────────
    print("\n--- RESULT ---")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    if dry_run:
        print("\n[DRY RUN] No files were written.")
        return

    # ── Step 7 (write): reject or accept ────────────────────────────────────
    if overall_status == "REJECTED":
        rejected_dir = Path("/srv/data/hvac-rag/rejected")
        rejected_dir.mkdir(parents=True, exist_ok=True)
        date_str = date.today().isoformat()
        safe_name = re.sub(r'[^\w\-_.]', '_', pdf_path.stem)
        out_path = rejected_dir / f"{date_str}_{safe_name}.json"
        record = {
            "pdf_path": str(pdf_path),
            "raw_sha256": raw_sha256,
            "normalized_markdown_sha256": norm_sha256,
            "rejection_reason": reject_reason,
            "rejection_source": reject_source,
            "timestamp": ts,
            "domain_score": domain_score,
        }
        out_path.write_text(json.dumps(record, indent=2, ensure_ascii=False))
        print(f"  → {out_path}")
        return

    # ── Step 8: process (convert + manifest) ────────────────────────────────
    manifest_record = {
        "doc_id": doc_id,
        "source_pdf": str(pdf_path),
        "raw_sha256": raw_sha256,
        "normalized_text_sha256": norm_sha256,
        "domain_score": domain_score,
        "domain_status": domain_status,
        "doc_type": doc_type,
        "duplicate_status": duplicate_status,
        "duplicate_of": duplicate_of,
        "possible_duplicate_score": possible_duplicate_score,
        "catalog_match": catalog_match,
        "processing_status": "intake_done",
        "md_path": str(md_path) if md_path else None,
        "timestamp": ts,
    }

    with manifest_path.open("a") as fh:
        fh.write(json.dumps(manifest_record, ensure_ascii=False) + "\n")

    result["manifest_written"] = True
    print(f"  → manifest: {manifest_path}")

    if do_index and md_path and md_path.exists():
        # Write JSON sidecar
        json_out = Path("/srv/data/hvac-rag/processed/json")
        json_out.mkdir(parents=True, exist_ok=True)
        json_path = json_out / f"{doc_id}.json"

        import copy
        indexed_record = copy.deepcopy(manifest_record)
        indexed_record["md_path"] = str(md_path)
        indexed_record["approved_for_chunking"] = True
        json_path.write_text(json.dumps(indexed_record, indent=2, ensure_ascii=False))

        result["indexed"] = True
        print(f"  → json:     {json_path}")
        print(f"  → markdown: {md_path}")
    elif do_index:
        print("  ⚠️  --index set but no markdown available; skipping processed output.")


if __name__ == "__main__":
    main()
