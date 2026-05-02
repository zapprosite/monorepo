#!/usr/bin/env bash
set -euo pipefail

python3 - "$@" <<'PY'
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path.cwd()
VALID_MODES = {"ci", "local", "prod-readonly"}
VALID_FORMATS = {"--json", "--markdown"}
TIMEOUT_SECONDS = float(os.environ.get("SRE_CHECK_TIMEOUT", "5"))

DEFAULT_SERVICES = """
api|https://api.zappro.site|http://127.0.0.1:4000/health|4000|critical|public
hermes|https://hermes.zappro.site/health|http://127.0.0.1:8642/health|8642|critical|public
chat|https://chat.zappro.site|http://127.0.0.1:3456/health|3456|critical|public
llm|https://llm.zappro.site/health|http://127.0.0.1:4018/health|4018|critical|auth_ok
qdrant|private|http://127.0.0.1:6333|6333|critical|private
git|https://git.zappro.site|http://127.0.0.1:3300|3300|important|public
coolify|https://coolify.zappro.site/api/status|http://127.0.0.1:8000/api/status|8000|important|public
pgadmin|https://pgadmin.zappro.site|http://127.0.0.1:4050|4050|important|public
gym|https://gym.zappro.site|http://127.0.0.1:4010|4010|best_effort|public
""".strip()


def usage() -> None:
    print(
        "usage: scripts/sre-check.sh {ci|local|prod-readonly} [--json|--markdown]",
        file=sys.stderr,
    )


def parse_args() -> tuple[str, str]:
    mode = sys.argv[1] if len(sys.argv) > 1 else "ci"
    output_format = sys.argv[2] if len(sys.argv) > 2 else "--json"
    if mode not in VALID_MODES or output_format not in VALID_FORMATS or len(sys.argv) > 3:
        usage()
        sys.exit(2)
    return mode, output_format


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def status_from_counts(counts: dict[str, int]) -> str:
    if counts["unhealthy"] > 0 or counts["degraded"] > 0 or counts["unknown"] > 0:
        return "degraded"
    return "healthy"


def http_probe(url: str) -> tuple[str, str, int | None]:
    if not url or url == "private":
        return "skipped", "private_endpoint", None
    started = time.monotonic()
    request = urllib.request.Request(url, headers={"User-Agent": "zappro-sre-check/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            latency_ms = int((time.monotonic() - started) * 1000)
            code = response.getcode()
            if 200 <= code < 400:
                return "healthy", f"http={code}", latency_ms
            if code in {401, 403}:
                return "degraded", f"http={code}:auth_gate", latency_ms
            return "unhealthy", f"http={code}", latency_ms
    except urllib.error.HTTPError as exc:
        latency_ms = int((time.monotonic() - started) * 1000)
        if exc.code in {401, 403}:
            return "degraded", f"http={exc.code}:auth_gate", latency_ms
        return "unhealthy", f"http={exc.code}", latency_ms
    except Exception as exc:  # noqa: BLE001 - diagnostic tool must report evidence.
        latency_ms = int((time.monotonic() - started) * 1000)
        return "unhealthy", f"{type(exc).__name__}:{exc}", latency_ms


def port_probe(port: str) -> tuple[str, str]:
    if not port:
        return "unknown", "port=missing"
    try:
        with socket.create_connection(("127.0.0.1", int(port)), timeout=TIMEOUT_SECONDS):
            return "healthy", f"port={port}:open"
    except Exception as exc:  # noqa: BLE001 - diagnostic tool must report evidence.
        return "unhealthy", f"port={port}:{type(exc).__name__}"


def parse_services() -> list[dict[str, str]]:
    raw_services = os.environ.get("SRE_CHECK_SERVICES", DEFAULT_SERVICES)
    services: list[dict[str, str]] = []
    for line in raw_services.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) != 6:
            raise SystemExit(f"invalid SRE_CHECK_SERVICES line: {line}")
        name, public_url, local_url, port, tier, exposure = parts
        services.append(
            {
                "name": name,
                "public_url": public_url,
                "local_url": local_url,
                "port": port,
                "tier": tier,
                "exposure": exposure,
            }
        )
    return services


def check_file(name: str, path: str, tier: str = "critical") -> dict[str, object]:
    target = ROOT / path
    status = "healthy" if target.exists() else "unhealthy"
    return {
        "name": name,
        "tier": tier,
        "status": status,
        "layer": "repo_contract",
        "latency_ms": None,
        "evidence": f"{path}:{'exists' if target.exists() else 'missing'}",
        "next_action": "none" if status == "healthy" else f"create_or_restore:{path}",
    }


def check_command(name: str, command: str, tier: str = "critical") -> dict[str, object]:
    binary = command.split()[0]
    if shutil.which(binary) is None:
        return {
            "name": name,
            "tier": tier,
            "status": "unhealthy",
            "layer": "repo_contract",
            "latency_ms": None,
            "evidence": f"{binary}:missing",
            "next_action": f"install:{binary}",
        }
    started = time.monotonic()
    result = subprocess.run(
        command.split(),
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=TIMEOUT_SECONDS,
    )
    latency_ms = int((time.monotonic() - started) * 1000)
    status = "healthy" if result.returncode == 0 else "unhealthy"
    return {
        "name": name,
        "tier": tier,
        "status": status,
        "layer": "repo_contract",
        "latency_ms": latency_ms,
        "evidence": f"{command}:exit={result.returncode}",
        "next_action": "none" if status == "healthy" else f"fix_command:{command}",
    }


def ci_checks() -> list[dict[str, object]]:
    return [
        check_command("package-manager", "pnpm --version"),
        check_command("node-runtime", "node --version"),
        check_file("root-readme", "README.md"),
        check_file("docs-readme", "docs/README.md"),
        check_file("start-here", "docs/START-HERE.md"),
        check_file("sre-spec", "docs/SPECS/SPEC-SRE-001-estado-da-arte-7d.md"),
        check_file("sre-quick-runbook", "docs/OPERATIONS/SRE-QUICK-RUNBOOK.md"),
        check_file("monorepo-navigator-skill", ".claude/skills/monorepo-navigator/SKILL.md"),
        check_file("sre-operator-skill", ".claude/skills/sre-operator/SKILL.md"),
        check_file("github-ci", ".github/workflows/ci.yml"),
        check_file("github-deploy-main", ".github/workflows/deploy-main.yml"),
    ]


def service_check(service: dict[str, str], mode: str) -> dict[str, object]:
    if mode == "local" or service["exposure"] == "private":
        url = service["local_url"]
        layer = "local_http"
    else:
        url = service["public_url"]
        layer = "public_http"

    status, evidence, latency_ms = http_probe(url)
    if service["exposure"] in {"private", "auth_ok"} and "auth_gate" in evidence:
        status = "healthy"
        evidence = f"{evidence};expected_auth_gate=true"

    port_status = "skipped"
    port_evidence = "port_check=skipped"
    if mode == "local" or service["exposure"] == "private":
        port_status, port_evidence = port_probe(service["port"])
        if status == "healthy" and port_status != "healthy":
            status = "unhealthy"

    return {
        "name": service["name"],
        "tier": service["tier"],
        "status": status,
        "layer": layer,
        "latency_ms": latency_ms,
        "evidence": f"{evidence};{port_evidence}",
        "next_action": "none"
        if status == "healthy"
        else "diagnose_only:open_runbook_and_collect_logs",
    }


def summarize(checks: list[dict[str, object]]) -> dict[str, int]:
    summary = {"healthy": 0, "degraded": 0, "unhealthy": 0, "unknown": 0, "total": len(checks)}
    for check in checks:
        status = str(check["status"])
        summary[status if status in summary else "unknown"] += 1
    return summary


def render_markdown(payload: dict[str, object]) -> str:
    lines = [
        f"# SRE Check: {payload['status']}",
        "",
        f"- modo: `{payload['mode']}`",
        f"- automacao: `{payload['automation']}`",
        f"- gerado_em: `{payload['checked_at']}`",
        f"- resumo: `{payload['summary']}`",
        "",
        "| Check | Tier | Status | Evidencia | Proxima acao |",
        "|---|---:|---:|---|---|",
    ]
    for check in payload["checks"]:
        lines.append(
            "| {name} | {tier} | {status} | {evidence} | {next_action} |".format(
                **check
            )
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    mode, output_format = parse_args()
    checks = ci_checks() if mode == "ci" else [service_check(s, mode) for s in parse_services()]
    summary = summarize(checks)
    critical_failed = any(
        check["tier"] == "critical" and check["status"] in {"unhealthy", "unknown"}
        for check in checks
    )
    payload = {
        "mode": mode,
        "automation": "diagnose_only",
        "mutation_policy": "read_only_no_prod_mutation",
        "checked_at": now_iso(),
        "status": "unhealthy" if critical_failed else status_from_counts(summary),
        "summary": summary,
        "checks": checks,
    }
    if output_format == "--markdown":
        print(render_markdown(payload), end="")
    else:
        print(json.dumps(payload, indent=2, sort_keys=True))
    return 1 if critical_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
PY
