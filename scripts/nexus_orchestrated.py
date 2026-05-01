#!/usr/bin/env python3
# nexus_orchestrated.py — nexus-deploy.sh rewritten as orchestrator session
"""
Migrate nexus-deploy.sh to enterprise orchestrator pattern.
Steps: generate_subdomain → check_exists → create_cf_record → deploy_docker → validate → done
"""
import sys, os, json, uuid, subprocess
sys.path.insert(0, '/srv/monorepo/services/orchestrator')

from state import Session
from graph import get_graph

# ── Config ──────────────────────────────────────────────────────
MONOREPO = "/srv/monorepo"
LOG_DIR = f"{MONOREPO}/logs"
CF_CREDS_FILE = f"{MONOREPO}/.env"

def log(msg: str):
    ts = subprocess.run(
        ["date", "+%Y-%m-%d %H:%M:%S"],
        capture_output=True, text=True
    ).stdout.strip()
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(f"{LOG_DIR}/nexus-orchestrated.log", "a") as f:
        f.write(f"[{ts}] {msg}\n")
    print(f"[{ts}] {msg}")

# ── Steps ──────────────────────────────────────────────────────
def generate_subdomain(prefix: str = "saas") -> str:
    """Step 1: Generate random subdomain."""
    result = subprocess.run(
        ["openssl", "rand", "-hex", "3"],
        capture_output=True, text=True, check=True
    )
    rand = result.stdout.strip()[:6]
    return f"{prefix}-{rand}"

def check_subdomain(subdomain: str) -> bool:
    """Step 2: Check if subdomain exists on Cloudflare."""
    result = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
         f"https://{subdomain}.zappro.site"],
        capture_output=True, text=True
    )
    return result.stdout.strip() in ("200", "301", "302")

def get_cf_credentials() -> tuple:
    """Read Cloudflare token and zone from .env."""
    token, zone = None, None
    with open(CF_CREDS_FILE) as f:
        for line in f:
            if "CLOUDFLARE_API_TOKEN" in line and "=" in line:
                token = line.split("=", 1)[1].strip()
            elif "CF_ZONE_ID" in line and "=" in line:
                zone = line.split("=", 1)[1].strip()
    return token, zone

def create_subdomain_record(subdomain: str, target: str = "localhost:8080") -> bool:
    """Step 3: Create CNAME record on Cloudflare."""
    token, zone = get_cf_credentials()
    if not token or not zone:
        log("ERRO: CLOUDFLARE_API_TOKEN ou CF_ZONE_ID não encontrados no .env")
        return False

    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        f"https://api.cloudflare.com/client/v4/zones/{zone}/dns_records",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps({
            "type": "CNAME",
            "name": subdomain,
            "content": target,
            "ttl": 120,
            "proxied": True
        })
    ], capture_output=True, text=True)

    try:
        data = json.loads(result.stdout)
        return data.get("success", False)
    except json.JSONDecodeError:
        log(f"ERRO CF API: {result.stdout[:200]}")
        return False

def deploy_docker(project_path: str, name: str) -> bool:
    """Step 4: Docker compose up."""
    compose_file = f"{project_path}/docker-compose.yml"
    if not os.path.isfile(compose_file):
        log(f"docker-compose.yml não encontrado em {project_path}")
        return False

    result = subprocess.run(
        ["docker", "compose", "-f", compose_file, "up", "-d"],
        cwd=project_path,
        capture_output=True, text=True
    )
    if result.returncode != 0:
        log(f"Docker deploy falhou: {result.stderr[:200]}")
        return False
    log(f"Docker deployed: {name}")
    return True

def validate_deployment(subdomain: str) -> bool:
    """Step 5: Validate deployment is reachable."""
    if check_subdomain(subdomain):
        log(f"Validação OK: {subdomain}.zappro.site")
        return True
    log(f"Validação falhou: {subdomain}.zappro.site não responde")
    return False

# ── Orchestrator Steps (map to LangGraph nodes) ─────────────────
def step_generate(state: dict) -> dict:
    subdomain = generate_subdomain(state.get("app_name", "saas"))
    state["subdomain"] = subdomain
    state["results"]["step_generate"] = {"ok": True, "subdomain": subdomain}
    log(f"Step 1 OK: {subdomain}")
    return state

def step_check(state: dict) -> dict:
    sub = state["subdomain"]
    tries = 0
    while check_subdomain(sub) and tries < 5:
        log(f"Subdomain já existe, gerando novo...")
        sub = generate_subdomain(state.get("app_name", "saas"))
        tries += 1
    state["subdomain"] = sub
    state["results"]["step_check"] = {"ok": True, "subdomain": sub, "retries": tries}
    log(f"Step 2 OK: {sub}")
    return state

def step_create_cf(state: dict) -> dict:
    sub = state["subdomain"]
    target = state.get("target", "localhost:8080")
    ok = create_subdomain_record(sub, target)
    state["results"]["step_create_cf"] = {"ok": ok}
    log(f"Step 3 {'OK' if ok else 'FALHOU'}: {sub}.zappro.site → {target}")
    if not ok:
        state["error_msg"] = "Cloudflare CNAME creation failed"
    return state

def step_deploy(state: dict) -> dict:
    project_path = state.get("project_path")
    if not project_path or not os.path.isdir(project_path):
        state["results"]["step_deploy"] = {"ok": False, "reason": "no project_path"}
        return state
    ok = deploy_docker(project_path, state.get("app_name", "app"))
    state["results"]["step_deploy"] = {"ok": ok}
    log(f"Step 4 {'OK' if ok else 'FALHOU'}")
    return state

def step_validate(state: dict) -> dict:
    sub = state["subdomain"]
    ok = validate_deployment(sub)
    state["results"]["step_validate"] = {"ok": ok}
    log(f"Step 5 {'OK' if ok else 'FALHOU'}")
    if not ok:
        state["error_msg"] = "Deployment validation failed"
    return state

# ── Main ────────────────────────────────────────────────────────
def main():
    import argparse
    parser = argparse.ArgumentParser(description="nexus-deploy orchestrated")
    parser.add_argument("command", choices=["deploy", "check", "random"])
    parser.add_argument("name", nargs="?", default="saas")
    parser.add_argument("project_path", nargs="?", default=".")
    parser.add_argument("--port", default="8080")
    args = parser.parse_args()

    if args.command == "random":
        print(generate_subdomain(args.name))
        return

    if args.command == "check":
        exists = check_subdomain(args.name)
        print("EXISTS" if exists else "AVAILABLE")
        return

    if args.command == "deploy":
        # 1. Create orchestrator session
        session = Session.create(
            name=f"deploy-{args.name}",
            phase="idle",
            metadata={"app_name": args.name, "project_path": args.project_path}
        )
        log(f"Sessão criada: {session.id}")

        # 2. Build state
        state = {
            "session_id": session.id,
            "phase": "idle",
            "status": "created",
            "app_name": args.name,
            "project_path": os.path.abspath(args.project_path),
            "target": f"localhost:{args.port}",
            "subdomain": "",
            "steps": ["generate", "check", "create_cf", "deploy", "validate"],
            "results": {},
            "error_msg": ""
        }

        # 3. Execute steps with checkpoint at each phase
        graph = get_graph()

        session.update(status="running", phase="planning")
        state["phase"] = "planning"

        # Plan → Execute
        state = step_generate(state)
        state = step_check(state)
        session.checkpoint("pre-cf", state)
        session.update(phase="executing", current_step="create_cf")

        state = step_create_cf(state)
        if state["error_msg"]:
            session.update(phase="error", status="failed", error_message=state["error_msg"])
            print(json.dumps({"ok": False, "session": session.to_dict(), "error": state["error_msg"]}))
            return

        state = step_deploy(state)
        session.checkpoint("post-deploy", state)

        state = step_validate(state)
        if state["error_msg"]:
            session.update(phase="error", status="failed", error_message=state["error_msg"])
            print(json.dumps({"ok": False, "session": session.to_dict(), "error": state["error_msg"]}))
            return

        # Done
        session.update(status="done", phase="done")
        log(f"Deploy completo: {state['subdomain']}.zappro.site")
        print(json.dumps({
            "ok": True,
            "session": session.to_dict(),
            "subdomain": state["subdomain"],
            "full_url": f"https://{state['subdomain']}.zappro.site",
            "results": state["results"]
        }))

if __name__ == "__main__":
    main()
