#!/usr/bin/env python3
"""HVAC manual finder core and canonical CLI."""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

OFFICIAL_BRAND_DOMAINS: dict[str, tuple[str, ...]] = {
    "lg": ("lg.com",),
    "samsung": ("samsung.com",),
    "daikin": ("daikin.com", "daikin.com.br"),
    "springer": ("springer.com.br", "springercarrier.com.br"),
    "carrier": ("carrier.com", "carrier.com.br", "springercarrier.com.br"),
    "midea": ("midea.com", "midea.com.br"),
}

MANUAL_KEYWORDS = ("manual", "service", "instalacao", "instalação", "suporte", "support")


@dataclass(frozen=True)
class ManualCandidate:
    brand: str
    model: str
    query: str
    title: str
    url: str
    source_domain: str
    confidence: float
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def normalize_brand(value: str | None) -> str:
    return (value or "").strip().lower()


def normalize_model(value: str | None) -> str:
    return (value or "").strip().upper()


def parse_catalog_row_json(raw_value: str | None) -> dict[str, Any]:
    if not raw_value:
        return {}
    raw_value = raw_value.strip()
    if not raw_value:
        return {}

    candidate_path = Path(raw_value)
    if candidate_path.exists():
        return json.loads(candidate_path.read_text(encoding="utf-8"))
    return json.loads(raw_value)


def build_search_query(brand: str, model: str, catalog_row: dict[str, Any] | None = None) -> str:
    catalog_row = catalog_row or {}
    query_parts: list[str] = []

    normalized_brand = normalize_brand(brand or catalog_row.get("brand"))
    normalized_model = normalize_model(
        model
        or catalog_row.get("indoor_model")
        or catalog_row.get("model")
        or catalog_row.get("model_family")
    )

    if normalized_brand:
        query_parts.append(normalized_brand.upper())
    if normalized_model:
        query_parts.append(normalized_model)

    family = normalize_model(catalog_row.get("model_family"))
    if family and family != normalized_model:
        query_parts.append(family)

    query_parts.extend(("manual", "pdf", "ar condicionado"))
    return " ".join(dict.fromkeys(part for part in query_parts if part))


def extract_source_domain(url: str) -> str:
    host = urlparse(url).netloc.lower().strip()
    if host.startswith("www."):
        host = host[4:]
    return host


def _is_official_domain(brand: str, source_domain: str) -> bool:
    for official_domain in OFFICIAL_BRAND_DOMAINS.get(normalize_brand(brand), ()):
        if source_domain == official_domain or source_domain.endswith(f".{official_domain}"):
            return True
    return False


def _score_result(
    brand: str,
    model: str,
    query: str,
    title: str,
    url: str,
    snippet: str,
    provider_confidence: float,
) -> tuple[float, str, str]:
    normalized_model = normalize_model(model)
    haystack = " ".join((title, snippet, url)).lower()
    source_domain = extract_source_domain(url)
    score = max(0.0, min(float(provider_confidence or 0.5), 1.0)) * 0.5
    reasons: list[str] = []

    is_official = _is_official_domain(brand, source_domain)
    if is_official:
        score += 0.30
        reasons.append("official_domain")
    else:
        score -= 0.10
        reasons.append("non_official_domain")
    if url.lower().endswith(".pdf") or ".pdf?" in url.lower():
        score += 0.20
        reasons.append("pdf_url")
    if normalized_model and normalized_model.lower() in haystack:
        score += 0.15
        reasons.append("model_match")
    if any(keyword in haystack for keyword in MANUAL_KEYWORDS):
        score += 0.10
        reasons.append("manual_keyword")
    if "br" in source_domain.split("."):
        score += 0.03
        reasons.append("br_domain")
    if query and query.lower() in haystack:
        score += 0.05
        reasons.append("query_match")

    return min(score, 0.99), ",".join(reasons) or "provider_confidence", source_domain


def rank_search_results(
    brand: str,
    model: str,
    query: str,
    results: list[dict[str, Any]],
) -> list[ManualCandidate]:
    candidates: list[ManualCandidate] = []

    for result in results:
        title = (result.get("title") or "").strip()
        url = (result.get("url") or "").strip()
        if not title or not url:
            continue

        confidence, reason, source_domain = _score_result(
            brand=brand,
            model=model,
            query=query,
            title=title,
            url=url,
            snippet=(result.get("snippet") or "").strip(),
            provider_confidence=float(result.get("confidence", 0.5) or 0.5),
        )
        candidates.append(
            ManualCandidate(
                brand=normalize_brand(brand),
                model=normalize_model(model),
                query=query,
                title=title,
                url=url,
                source_domain=source_domain,
                confidence=round(confidence, 4),
                reason=reason,
            )
        )

    return sorted(candidates, key=lambda item: (-item.confidence, item.source_domain, item.url))


def _infer_brand_model_from_query(query: str) -> tuple[str, str]:
    normalized = query.strip()
    brand = ""
    for known_brand in OFFICIAL_BRAND_DOMAINS:
        if re.search(rf"\b{re.escape(known_brand)}\b", normalized, re.IGNORECASE):
            brand = known_brand
            break

    tokens = re.findall(r"\b[A-Z0-9][A-Z0-9/-]{4,}\b", normalized.upper())
    model = next((token for token in tokens if token.lower() != brand), "")
    return brand, model


def _normalize_provider_result(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": result.get("title") or result.get("name") or result.get("url") or "",
        "url": result.get("url") or result.get("link") or "",
        "snippet": result.get("snippet") or result.get("content") or result.get("body") or "",
        "confidence": float(result.get("score", result.get("confidence", 0.5)) or 0.5),
    }


def search_tavily(query: str, limit: int = 8) -> list[dict[str, Any]]:
    """Search Tavily when TAVILY_API_KEY is available; never hardcode secrets."""
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return []

    payload = json.dumps(
        {
            "query": query,
            "max_results": limit,
            "search_depth": "basic",
            "include_answer": False,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.tavily.com/search",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception:
        return []
    return [_normalize_provider_result(item) for item in data.get("results", [])[:limit]]


def search_duckduckgo(query: str, limit: int = 8) -> list[dict[str, Any]]:
    """Best-effort DuckDuckGo HTML search without adding runtime dependencies."""
    url = "https://duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query})
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return []

    results: list[dict[str, Any]] = []
    pattern = re.compile(r'class="result__a" href="(?P<href>[^"]+)".*?>(?P<title>.*?)</a>', re.DOTALL)
    for match in pattern.finditer(html):
        href = match.group("href")
        title = re.sub(r"<.*?>", "", match.group("title"))
        parsed = urllib.parse.urlparse(href)
        if parsed.path == "/l/":
            qs = urllib.parse.parse_qs(parsed.query)
            href = qs.get("uddg", [href])[0]
        results.append({"title": title, "url": urllib.parse.unquote(href), "snippet": "", "confidence": 0.5})
        if len(results) >= limit:
            break
    return results


def official_seed_results(brand: str, model: str) -> list[dict[str, Any]]:
    """Seed official manufacturer domains so ranking stays official-first when search is unavailable."""
    seeds: list[dict[str, Any]] = []
    for domain in OFFICIAL_BRAND_DOMAINS.get(normalize_brand(brand), ()):
        seeds.append(
            {
                "title": f"{brand.upper()} {model} manual suporte oficial",
                "url": f"https://www.{domain}/search?q={urllib.parse.quote_plus(model + ' manual')}",
                "snippet": f"Busca oficial do fabricante para manual técnico {model}.",
                "confidence": 0.45,
            }
        )
    return seeds


def search_manual_candidates(query: str, brand: str = "", model: str = "", limit: int = 8) -> list[ManualCandidate]:
    if not brand or not model:
        inferred_brand, inferred_model = _infer_brand_model_from_query(query)
        brand = brand or inferred_brand
        model = model or inferred_model

    raw_results = search_tavily(query, limit=limit)
    if not raw_results:
        raw_results = search_duckduckgo(query, limit=limit)
    if brand and model:
        raw_results.extend(official_seed_results(brand, model))

    return rank_search_results(brand, model, query, raw_results)[:limit]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="HVAC Manual Finder")
    parser.add_argument("--brand", help="Brand name, e.g. lg")
    parser.add_argument("--model", help="Model number, e.g. ARNU12GTMC2")
    parser.add_argument("--catalog-row-json", help="JSON string or path to JSON file")
    parser.add_argument("--search", help="Search web for a manual query and rank official manufacturer results")
    parser.add_argument("--dry-run", action="store_true", help="Print derived query without web calls")
    parser.add_argument("--output-jsonl", help="Write ranked candidates as JSONL")
    return parser


def _resolve_brand_model(args: argparse.Namespace, catalog_row: dict[str, Any]) -> tuple[str, str]:
    brand = normalize_brand(args.brand or catalog_row.get("brand"))
    model = normalize_model(
        args.model
        or catalog_row.get("indoor_model")
        or catalog_row.get("model")
        or catalog_row.get("model_family")
    )
    if not brand or not model:
        raise SystemExit("--brand and --model are required unless provided by --catalog-row-json")
    return brand, model


def _write_jsonl(path: Path, candidates: list[ManualCandidate]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for candidate in candidates:
            handle.write(json.dumps(candidate.to_dict(), ensure_ascii=False) + "\n")


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    catalog_row = parse_catalog_row_json(args.catalog_row_json)
    if args.search:
        inferred_brand, inferred_model = _infer_brand_model_from_query(args.search)
        brand = normalize_brand(args.brand or catalog_row.get("brand") or inferred_brand)
        model = normalize_model(args.model or catalog_row.get("indoor_model") or inferred_model)
        query = args.search
    else:
        brand, model = _resolve_brand_model(args, catalog_row)
        query = build_search_query(brand, model, catalog_row)
    candidates: list[ManualCandidate] = []

    if args.search and not args.dry_run:
        candidates = search_manual_candidates(query, brand=brand, model=model)

    if args.output_jsonl:
        _write_jsonl(Path(args.output_jsonl), candidates)

    output = {
        "brand": brand,
        "model": model,
        "query": query,
        "candidate_count": len(candidates),
        "candidates": [candidate.to_dict() for candidate in candidates],
        "dry_run": bool(args.dry_run),
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
