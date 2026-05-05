#!/srv/data/hvac-rag/.venv/bin/python3
"""
HVAC Manual Enrich — Convert PDF to Markdown and generate Top 50 Q&A.

Uses Docling for PDF→Markdown and local Ollama (qwen2.5-coder:14b-q6k) for Q&A generation.

Usage:
  python3 hvac_manual_enrich.py <pdf_or_md_path> [--out-dir PATH] [--index]
  python3 hvac_manual_enrich.py /srv/data/hvac-rag/incoming/pdf/lg/AR-09NS1.pdf
  python3 hvac_manual_enrich.py /srv/data/hvac-rag/processed/markdown/manual.md
"""
import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

DEFAULT_OUT_DIR = Path("/srv/data/hvac-rag/processed")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL_QA", "qwen2.5-coder:14b-q6k")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION_FAQ", "hvac_manuals_faq")
MAX_QA_PAIRS = 50
CHUNK_SIZE_CHARS = 12000  # ~3k tokens per chunk for LLM

# ── Blacklist / Whitelist for PDF classification ────────────────────────────

BLACKLIST_PATTERNS = [
    r"(?i)installation\s*manual",
    r"(?i)user\s*guide",
    r"(?i)catalog(?:ue)?",
    r"(?i)parts\s*(?:list|catalog)",
    r"(?i)warranty",
    r"(?i)garantia\s*estendida",
    r"(?i)manual\s*do\s*usu[aá]rio",
    r"(?i)guia\s*de\s*instala[cç][aã]o",
]

WHITELIST_PATTERNS = [
    r"(?i)service\s*manual",
    r"(?i)manual\s*de\s*servi[cç]o",
    r"(?i)troubleshoot",
    r"(?i)diagn[oó]stico",
    r"(?i)solu[cç][aã]o\s*de\s*problemas",
    r"(?i)error\s*code",
    r"(?i)c[oó]digo\s*de\s*erro",
    r"(?i)maintenance",
    r"(?i)manuten[cç][aã]o",
    r"(?i)repair",
    r"(?i)reparo",
    r"(?i)vrv",
    r"(?i) vrf ",
    r"(?i)inverter",
    r"(?i)split",
    r"(?i)ar\s*condicionado",
    r"(?i)condicionador",
]

# Brazilian market inverter models only (v1 scope)
BRAZILIAN_BRANDS = {"lg", "samsung", "daikin", "carrier", "springer", "midea", "gree", "fujitsu", "panasonic", "hitachi", "toshiba", "electrolux", "philco", "consul", "brastemp", "elgin", " agratto", "comfee"}

sys.path.insert(0, str(Path(__file__).parent))
from hvac_chunk import docling_convert
from hvac_fingerprint import normalize_text

# ── Helpers ──────────────────────────────────────────────────────────────────


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def classify_pdf(title: str, text_sample: str = "") -> dict:
    """
    Classify a PDF using blacklist/whitelist rules.
    Returns: {"action": "accept|reject", "reason": str, "brand": str|None}
    """
    combined = f"{title} {text_sample}".lower()

    # Blacklist check (title is enough for rejection)
    for pattern in BLACKLIST_PATTERNS:
        if re.search(pattern, title):
            return {"action": "reject", "reason": f"BLACKLIST: matches '{pattern}'", "brand": None}

    # Whitelist check (needs content confirmation)
    whitelist_match = any(re.search(p, combined) for p in WHITELIST_PATTERNS)
    if not whitelist_match:
        return {"action": "reject", "reason": "WHITELIST_FAIL: no service/troubleshooting keywords found", "brand": None}

    # Brand extraction from title/filename
    brand = None
    for b in BRAZILIAN_BRANDS:
        if b.lower() in combined:
            brand = b.lower()
            break

    return {"action": "accept", "reason": "PASS", "brand": brand}


def extract_metadata(text: str, brand_hint: str | None = None) -> dict:
    """
    Extract structured metadata from manual text using local LLM.
    Returns: {"brand", "model", "model_family", "error_codes", "doc_type", "language", "equipment_type"}
    """
    prompt = f"""Analise este trecho de manual técnico de ar condicionado e extraia metadados em JSON puro (sem markdown):

Campos obrigatórios:
- brand: marca (LG, Samsung, Daikin, Carrier, Springer, etc)
- model: modelo específico ou lista
- model_family: família de modelos
- error_codes: lista de códigos de erro mencionados (ex: ["CH05", "E101"])
- doc_type: tipo (service_manual, installation, troubleshooting, parts_catalog)
- language: idioma (pt-BR, en-US, es, etc)
- equipment_type: tipo (split, vrf, chiller, heat_pump, window)

Regras:
- Use apenas informações presentes no texto
- Se não souber, use null
- brand_hint: {brand_hint or 'null'}

Trecho (primeiros 3000 caracteres):
---
{text[:3000]}
---

Responda APENAS com JSON válido, sem explicações."""

    response = call_ollama(prompt, timeout=60)
    try:
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.warning(f"Metadata extraction failed: {e}")

    # Fallback
    return {
        "brand": brand_hint,
        "model": None,
        "model_family": None,
        "error_codes": [],
        "doc_type": "service_manual",
        "language": "pt-BR",
        "equipment_type": "split",
    }


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def call_ollama(prompt: str, model: str = OLLAMA_MODEL, timeout: int = 300) -> str:
    """Call local Ollama for text generation."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 4096},
    }
    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except Exception as e:
        logger.error(f"Ollama call failed: {e}")
        return ""


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE_CHARS) -> list[str]:
    """Split text into chunks at paragraph boundaries."""
    paragraphs = text.split("\n\n")
    chunks = []
    current = []
    current_len = 0
    for para in paragraphs:
        para_len = len(para)
        if current_len + para_len > chunk_size and current:
            chunks.append("\n\n".join(current))
            current = [para]
            current_len = para_len
        else:
            current.append(para)
            current_len += para_len
    if current:
        chunks.append("\n\n".join(current))
    return chunks


# ── Q&A Generation ───────────────────────────────────────────────────────────

QA_GENERATION_PROMPT = """Você é um técnico sênior de HVAC. Com base no trecho do manual técnico abaixo, gere Perguntas e Respostas em português que um técnico de campo faria ao consultar este manual.

Regras:
- Foque em códigos de erro, procedimentos de diagnóstico, configurações de campo, segurança e componentes.
- Cada pergunta deve ser específica e prática.
- Cada resposta deve ser técnica, precisa e baseada estritamente no texto fornecido.
- Formato: "P: <pergunta>\nR: <resposta>"
- Não invente informações que não estejam no texto.
- Gere até 10 pares de Q&A para este trecho.

Trecho do manual:
---
{text}
---
"""


def generate_qa_for_chunk(chunk: str, model: str = OLLAMA_MODEL) -> list[dict]:
    """Generate Q&A pairs for a text chunk using local LLM."""
    prompt = QA_GENERATION_PROMPT.format(text=chunk[:8000])
    response = call_ollama(prompt, model=model)
    qa_pairs = []
    # Parse "P: ...\nR: ..." format
    lines = response.split("\n")
    current_q = None
    current_a = None
    for line in lines:
        line = line.strip()
        if line.upper().startswith("P:") or line.startswith("Pergunta:"):
            if current_q and current_a:
                qa_pairs.append({"question": current_q, "answer": current_a, "source_chunk": chunk[:200]})
            current_q = re.sub(r"^[Pp](?:ergunta)?[:\-]?\s*", "", line).strip()
            current_a = None
        elif line.upper().startswith("R:") or line.startswith("Resposta:"):
            current_a = re.sub(r"^[Rr](?:esposta)?[:\-]?\s*", "", line).strip()
        elif current_a is not None and line:
            current_a += " " + line
    if current_q and current_a:
        qa_pairs.append({"question": current_q, "answer": current_a, "source_chunk": chunk[:200]})
    return qa_pairs


def generate_top50_qa(markdown_text: str, max_pairs: int = MAX_QA_PAIRS) -> list[dict]:
    """Generate up to max_pairs Q&A from the full markdown text."""
    chunks = chunk_text(markdown_text, CHUNK_SIZE_CHARS)
    all_qa = []
    logger.info(f"Processing {len(chunks)} chunks for Q&A generation")
    for i, chunk in enumerate(chunks):
        if len(all_qa) >= max_pairs:
            break
        logger.info(f"Chunk {i+1}/{len(chunks)} — generating Q&A")
        qa = generate_qa_for_chunk(chunk)
        all_qa.extend(qa)
        logger.info(f"  -> {len(qa)} pairs generated (total: {len(all_qa)})")
        time.sleep(1)  # rate limit local ollama
    return all_qa[:max_pairs]


# ── Output writers ───────────────────────────────────────────────────────────


def write_faq_md(qa_pairs: list[dict], dest: Path, title: str = "FAQ Técnico") -> None:
    """Write Q&A pairs as a Markdown FAQ document."""
    lines = [f"# {title}\n", f"> Gerado automaticamente via HVAC Manual Enrich | {len(qa_pairs)} perguntas\n"]
    for idx, qa in enumerate(qa_pairs, 1):
        lines.append(f"## {idx}. {qa['question']}\n")
        lines.append(f"{qa['answer']}\n")
        lines.append(f"<!-- source: {qa.get('source_chunk', '')[:120]}... -->\n")
    dest.write_text("\n".join(lines), encoding="utf-8")
    logger.info(f"FAQ written: {dest}")


def write_faq_json(qa_pairs: list[dict], dest: Path, metadata: dict) -> None:
    """Write Q&A pairs as structured JSON for downstream indexing."""
    payload = {
        "metadata": metadata,
        "qa_pairs": qa_pairs,
    }
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"JSON written: {dest}")


# ── Qdrant Indexing (optional) ───────────────────────────────────────────────


def get_qdrant_api_key() -> str:
    key = os.getenv("QDRANT_API_KEY", "")
    if not key:
        env_path = Path("/srv/monorepo/.env")
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("QDRANT_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"')
                    break
    return key


def embed_text(text: str) -> list[float]:
    """Embed text using local Ollama nomic-embed-text."""
    payload = {
        "model": "nomic-embed-text",
        "prompt": text,
        "stream": False,
    }
    try:
        resp = requests.post("http://localhost:11434/api/embeddings", json=payload, timeout=60)
        resp.raise_for_status()
        return resp.json().get("embedding", [])
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        return []


def index_qa_in_qdrant(qa_pairs: list[dict], metadata: dict) -> None:
    """Index Q&A pairs into Qdrant collection."""
    api_key = get_qdrant_api_key()
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["api-key"] = api_key

    # Ensure collection exists
    coll_url = f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}"
    try:
        resp = requests.get(coll_url, headers=headers, timeout=10)
        if resp.status_code == 404:
            create_payload = {
                "vectors": {"size": 768, "distance": "Cosine"},
            }
            resp = requests.put(coll_url, json=create_payload, headers=headers, timeout=10)
            logger.info(f"Created Qdrant collection {QDRANT_COLLECTION}: {resp.status_code}")
    except Exception as e:
        logger.warning(f"Qdrant collection check failed: {e}")

    points = []
    for idx, qa in enumerate(qa_pairs):
        vector = embed_text(qa["question"] + " " + qa["answer"])
        if not vector:
            continue
        points.append({
            "id": metadata.get("sha256", "") + f"_faq_{idx}",
            "vector": vector,
            "payload": {
                "question": qa["question"],
                "answer": qa["answer"],
                "source_pdf": metadata.get("source_pdf", ""),
                "source_md": metadata.get("source_md", ""),
                "type": "faq",
                "brand": metadata.get("brand", ""),
                "model": metadata.get("model", ""),
            },
        })

    if not points:
        logger.warning("No vectors generated, skipping Qdrant indexing")
        return

    batch_url = f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points?wait=true"
    try:
        resp = requests.put(batch_url, json={"points": points}, headers=headers, timeout=60)
        resp.raise_for_status()
        logger.info(f"Indexed {len(points)} FAQ points to {QDRANT_COLLECTION}")
    except Exception as e:
        logger.error(f"Qdrant indexing failed: {e}")


# ── Main pipeline ────────────────────────────────────────────────────────────


def enrich_manual(src_path: Path, out_dir: Path, index_qdrant: bool = False) -> dict:
    """
    Full enrichment pipeline with blacklist/whitelist and metadata extraction:
      1. Classify PDF (reject if blacklisted)
      2. PDF → Markdown (via Docling)
      3. Extract metadata (brand, model, error_codes via LLM)
      4. Generate Top 50 Q&A (via local LLM)
      5. Write .md FAQ + .json structured with enriched metadata
      6. Optional: index in Qdrant with metadata payload
    """
    ensure_dir(out_dir / "markdown")
    ensure_dir(out_dir / "faq")

    src_path = Path(src_path).resolve()
    if not src_path.exists():
        raise FileNotFoundError(f"Input not found: {src_path}")

    # ── Step 0: Classification ──────────────────────────────────────────────
    title = src_path.stem
    classification = classify_pdf(title)
    if classification["action"] == "reject":
        logger.warning(f"REJECTED: {src_path.name} — {classification['reason']}")
        return {
            "action": "rejected",
            "reason": classification["reason"],
            "path": str(src_path),
        }

    logger.info(f"ACCEPTED: {src_path.name} — {classification['reason']}")

    # ── Step 1: PDF → Markdown ──────────────────────────────────────────────
    if src_path.suffix.lower() == ".pdf":
        md_path = out_dir / "markdown" / f"{src_path.stem}.md"
        logger.info(f"Converting PDF -> Markdown: {src_path} -> {md_path}")
        docling_convert(str(src_path), str(md_path))
    elif src_path.suffix.lower() in (".md", ".markdown"):
        md_path = src_path
    else:
        raise ValueError(f"Unsupported input format: {src_path.suffix}")

    markdown_text = md_path.read_text(encoding="utf-8")
    logger.info(f"Markdown loaded: {len(markdown_text)} chars")

    # ── Step 2: Metadata Extraction (local LLM) ─────────────────────────────
    brand_hint = classification.get("brand")
    extracted_meta = extract_metadata(markdown_text, brand_hint=brand_hint)
    logger.info(f"Extracted metadata: brand={extracted_meta.get('brand')}, model={extracted_meta.get('model')}, error_codes={extracted_meta.get('error_codes', [])}")

    # ── Step 3: Content validation (reject if no technical keywords) ─────────
    tech_keywords = ["compressor", "termistor", "placa", "inversor", "refrigerante", "código", "erro", "sensor", "condensador", "evaporador"]
    tech_count = sum(1 for kw in tech_keywords if kw.lower() in markdown_text.lower())
    if tech_count < 3:
        logger.warning(f"REJECTED (content): {src_path.name} — only {tech_count}/10 technical keywords found")
        return {
            "action": "rejected",
            "reason": f"LOW_TECH_CONTENT: {tech_count}/10 keywords",
            "path": str(src_path),
        }

    metadata = {
        "source_pdf": str(src_path) if src_path.suffix.lower() == ".pdf" else "",
        "source_md": str(md_path),
        "sha256": file_sha256(src_path) if src_path.suffix.lower() == ".pdf" else "",
        "brand": extracted_meta.get("brand") or brand_hint or "unknown",
        "model": extracted_meta.get("model") or src_path.stem,
        "model_family": extracted_meta.get("model_family"),
        "error_codes": extracted_meta.get("error_codes", []),
        "doc_type": extracted_meta.get("doc_type", "service_manual"),
        "language": extracted_meta.get("language", "pt-BR"),
        "equipment_type": extracted_meta.get("equipment_type", "split"),
        "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    # ── Step 4: Generate Q&A ────────────────────────────────────────────────
    qa_pairs = generate_top50_qa(markdown_text, max_pairs=MAX_QA_PAIRS)
    metadata["qa_count"] = len(qa_pairs)

    # ── Step 5: Write outputs ───────────────────────────────────────────────
    faq_md = out_dir / "faq" / f"{src_path.stem}_faq.md"
    faq_json = out_dir / "faq" / f"{src_path.stem}_faq.json"

    write_faq_md(qa_pairs, faq_md, title=f"FAQ Técnico — {metadata['brand'].upper()} {metadata['model']}")
    write_faq_json(qa_pairs, faq_json, metadata)

    # ── Step 6: Optional Qdrant indexing ────────────────────────────────────
    if index_qdrant:
        index_qa_in_qdrant(qa_pairs, metadata)

    logger.info(f"Enrichment complete: {len(qa_pairs)} Q&A pairs for {metadata['brand']} {metadata['model']}")
    return {
        "action": "accepted",
        "markdown": str(md_path),
        "faq_md": str(faq_md),
        "faq_json": str(faq_json),
        "qa_count": len(qa_pairs),
        "metadata": metadata,
    }


# ── CLI ──────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="HVAC Manual Enrich — PDF→Markdown + Top 50 Q&A")
    parser.add_argument("input", type=Path, help="Path to PDF or Markdown file")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Output directory")
    parser.add_argument("--index", action="store_true", help="Index Q&A in Qdrant")
    args = parser.parse_args()

    result = enrich_manual(args.input, args.out_dir, index_qdrant=args.index)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
