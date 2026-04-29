#!/usr/bin/env python3
"""
HVAC RAG — Unified Status Dashboard

Single source of truth for the HVAC RAG pipeline health.
Replaces ad-hoc checks with a consistent JSON report.

Usage:
    python3 scripts/hvac-rag/hvac-status.py
    python3 scripts/hvac-rag/hvac-status.py --json
    python3 scripts/hvac-rag/hvac-status.py --compact
"""

import asyncio
import json
import os
import sys
import importlib.util
from datetime import datetime, timezone
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────

_env_path = os.environ.get("HVAC_DOTENV", "/srv/monorepo/.env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line or _line.startswith("#"):
                continue
            if "=" in _line:
                _k, _v = _line.split("=", 1)
                _k = _k.strip()
                if _k not in os.environ:
                    os.environ[_k] = _v

PIPELINE_URL = os.environ.get("HVAC_PIPELINE_URL", "http://127.0.0.1:4017")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
COLLECTION_NAME = "hvac_manuals_v1"
DEFAULT_REPORT = "/tmp/hvac-status.json"

# ── Module import helper ────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent


def import_local(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(
        name, SCRIPT_DIR / filename
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


_juez_mod = import_local("hvac_juiz", "hvac_juiz.py")
judge = _juez_mod.judge

import httpx

# ── Checks ──────────────────────────────────────────────────────────────────


async def check_pipe() -> dict:
    """Check if HVAC RAG pipe is responding."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{PIPELINE_URL}/health")
            if r.status_code == 200:
                data = r.json()
                return {
                    "ok": True,
                    "version": data.get("version", "unknown"),
                    "public_model": data.get("public_model", "unknown"),
                    "internal_models": data.get("internal_models", []),
                }
            return {"ok": False, "error": f"HTTP {r.status_code}"}
    except httpx.ConnectError:
        return {"ok": False, "error": "connection refused"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def check_public_models() -> dict:
    """Check what models /v1/models exposes."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{PIPELINE_URL}/v1/models")
            if r.status_code == 200:
                data = r.json()
                model_ids = [m["id"] for m in data.get("data", [])]
                return {
                    "ok": True,
                    "models": model_ids,
                    "public_only_zappro": model_ids == ["zappro-clima-tutor"],
                    "exposes_internal_aliases": any(
                        m in model_ids
                        for m in ["hvac-manual-strict", "hvac-field-tutor", "hvac-printable"]
                    ),
                }
            return {"ok": False, "error": f"HTTP {r.status_code}"}
    except httpx.ConnectError:
        return {"ok": False, "error": "connection refused"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def check_qdrant() -> dict:
    """Check Qdrant collection health."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}",
                headers={"Authorization": f"Bearer {QDRANT_API_KEY}"}
                if QDRANT_API_KEY else {},
            )
            if r.status_code == 200:
                data = r.json()
                info = data.get("result", {})
                vectors = info.get("vectors_count", 0)
                points = info.get("points_count", 0)
                return {
                    "ok": True,
                    "vectors_count": vectors,
                    "points_count": points,
                    "indexed": vectors > 0,
                }
            return {"ok": False, "error": f"HTTP {r.status_code}"}
    except httpx.ConnectError:
        return {"ok": False, "error": "connection refused"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def check_litellm() -> dict:
    """Check if LiteLLM is reachable."""
    try:
        LITELLM_URL = os.environ.get("LITELLM_URL", "http://127.0.0.1:4000")
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{LITELLM_URL}/health")
            if r.status_code == 200:
                return {"ok": True}
            return {"ok": False, "error": f"HTTP {r.status_code}"}
    except httpx.ConnectError:
        return {"ok": False, "error": "connection refused"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def check_latest_smoke() -> dict:
    """Check latest daily smoke report."""
    import glob
    smoke_files = sorted(glob.glob("/tmp/hvac-daily-smoke-*.json"), reverse=True)
    if smoke_files:
        try:
            with open(smoke_files[0]) as f:
                data = json.load(f)
            summary = data.get("summary", {})
            return {
                "ok": summary.get("overall_status") == "pass",
                "file": smoke_files[0],
                "timestamp": summary.get("timestamp", ""),
                "total": summary.get("total_queries", 0),
                "blocked": summary.get("blocked_count", 0),
                "approved": summary.get("approved_count", 0),
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": None, "file": None, "error": "no smoke report found"}


def check_latest_health() -> dict:
    """Check latest healthcheck report."""
    health_file = Path("/tmp/hvac-healthcheck.json")
    if health_file.exists():
        try:
            with health_file.open() as f:
                data = json.load(f)
            return {
                "ok": data.get("overall_status") == "pass",
                "timestamp": data.get("timestamp", ""),
                "checks": data.get("checks", {}),
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": None, "file": None, "error": "no healthcheck report found"}


def check_coverage() -> dict:
    """Check manual coverage if available."""
    coverage_path = Path("/srv/monorepo/data/hvac-rag/catalog/manual-coverage.json")
    if not coverage_path.exists():
        return {"ok": None, "indexed": 0, "missing": 0, "total": 0}
    try:
        with coverage_path.open() as f:
            data = json.load(f)
        rows = data.get("rows", [])
        indexed = sum(1 for r in rows if r.get("manual_status") == "indexed")
        missing = sum(1 for r in rows if r.get("manual_status") == "missing")
        return {
            "ok": True,
            "indexed": indexed,
            "missing": missing,
            "total": len(rows),
            "coverage_pct": round(indexed / len(rows) * 100, 1) if rows else 0,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Juiz validation ──────────────────────────────────────────────────────────

def check_juiz_validation() -> dict:
    """Run Juiz validation."""
    test_queries = [
        ("RXYQ20BRA erro U4", "APPROVED"),
        ("geladeira quebrou", "BLOCKED"),
        ("RXYQ erro E3", "ASK_CLARIFICATION"),
        ("erro U4-01 como resolver", "ASK_CLARIFICATION"),
    ]
    results = []
    JuizResult = _juez_mod.JuizResult
    for query, expected in test_queries:
        result, _ = judge(query)
        ok = result.value == expected
        results.append({"query": query, "expected": expected, "got": result.value, "ok": ok})

    all_ok = all(r["ok"] for r in results)
    return {"ok": all_ok, "tests": results}


# ── Main ─────────────────────────────────────────────────────────────────────

async def run_all_checks() -> dict:
    pipe, models, qdrant, litellm = await asyncio.gather(
        check_pipe(),
        check_public_models(),
        check_qdrant(),
        check_litellm(),
    )
    smoke = check_latest_smoke()
    health = check_latest_health()
    coverage = check_coverage()
    juiz = check_juiz_validation()

    overall_ok = (
        pipe.get("ok") and
        models.get("public_only_zappro") and
        qdrant.get("ok") and
        models.get("ok") and
        juiz.get("ok")
    )

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": "pass" if overall_ok else "fail",
        "pipe": pipe,
        "public_models": models,
        "qdrant": qdrant,
        "litellm": litellm,
        "latest_smoke": smoke,
        "latest_health": health,
        "manual_coverage": coverage,
        "juiz_validation": juiz,
        "customer_automation": False,
    }


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="HVAC RAG unified status")
    parser.add_argument("--json", action="store_true", help="JSON output")
    parser.add_argument("--compact", action="store_true", help="One-line summary")
    parser.add_argument("--report", default=DEFAULT_REPORT, help="Write JSON report to path")
    args = parser.parse_args()

    status = await run_all_checks()

    if args.json:
        print(json.dumps(status, indent=2, ensure_ascii=False))
    elif args.compact:
        m = status["public_models"]
        models_ok = m.get("public_only_zappro", False)
        pipe_ok = status["pipe"].get("ok", False)
        qdrant_ok = status["qdrant"].get("ok", False)
        overall = status["overall_status"]
        print(
            f"[{overall.upper()}] "
            f"pipe={'✓' if pipe_ok else '✗'} "
            f"qdrant={'✓' if qdrant_ok else '✗'} "
            f"models={'✓ only zappro' if models_ok else '✗ WRONG'} "
            f"coverage={status['manual_coverage'].get('coverage_pct', '?')}% "
            f"smoke={status['latest_smoke'].get('overall_status', '?')}"
        )
    else:
        print("=== HVAC RAG Status ===")
        print(f"  Overall:        {status['overall_status'].upper()}")
        print(f"  Pipe:          {'✓' if status['pipe'].get('ok') else '✗'} v{status['pipe'].get('version','?')}")
        m = status["public_models"]
        print(f"  /v1/models:    {'✓' if m.get('public_only_zappro') else '✗'} {m.get('models', [])}")
        print(f"  Qdrant:        {'✓' if status['qdrant'].get('ok') else '✗'} vectors={status['qdrant'].get('vectors_count','?')}")
        print(f"  LiteLLM:       {'✓' if status['litellm'].get('ok') else '✗'}")
        cov = status["manual_coverage"]
        print(f"  Coverage:      {cov.get('indexed','?')}/{cov.get('total','?')} ({cov.get('coverage_pct','?')}%)")
        smoke = status["latest_smoke"]
        print(f"  Last smoke:    {smoke.get('overall_status', 'no report')} ({smoke.get('file', '').split('/')[-1]})")
        health = status["latest_health"]
        print(f"  Last health:  {health.get('overall_status', 'no report')}")
        juiz = status["juiz_validation"]
        print(f"  Juiz valid.:  {'✓' if juiz.get('ok') else '✗'} {juiz.get('tests', [])[0]['ok'] if juiz.get('tests') else '?'} validações")
        print(f"  Customer auto: {status['customer_automation']}")

    # Write report
    try:
        with open(args.report, "w") as f:
            json.dump(status, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Warning: could not write report: {e}", file=sys.stderr)

    return status


if __name__ == "__main__":
    status = asyncio.run(main())
    sys.exit(0 if status["overall_status"] == "pass" else 1)
