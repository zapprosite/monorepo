import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "sre-check.sh"


def run_sre_check(*args: str, services: str = "") -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    if services:
        env["SRE_CHECK_SERVICES"] = services
    return subprocess.run(
        [str(SCRIPT), *args],
        cwd=ROOT,
        env=env,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def test_ci_mode_emits_read_only_json_contract() -> None:
    result = run_sre_check("ci", "--json")

    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["mode"] == "ci"
    assert payload["automation"] == "diagnose_only"
    assert payload["status"] in {"healthy", "degraded", "unhealthy"}
    assert payload["summary"]["total"] == len(payload["checks"])
    assert {check["name"] for check in payload["checks"]} >= {
        "package-manager",
        "sre-spec",
        "root-readme",
    }


def test_local_mode_marks_private_local_service_healthy() -> None:
    services = "qdrant|private|http://127.0.0.1:9|9|critical|private\n"
    result = run_sre_check("local", "--json", services=services)

    assert result.returncode == 1
    payload = json.loads(result.stdout)
    assert payload["checks"][0]["name"] == "qdrant"
    assert payload["checks"][0]["tier"] == "critical"
    assert payload["checks"][0]["status"] == "unhealthy"


def test_markdown_output_contains_human_summary() -> None:
    result = run_sre_check("ci", "--markdown")

    assert result.returncode == 0, result.stderr
    assert "SRE Check" in result.stdout
    assert "diagnose_only" in result.stdout
