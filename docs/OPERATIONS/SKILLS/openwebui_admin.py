#!/usr/bin/env python3
"""
OpenWebUI Admin CLI
==================
Gestão de OpenWebUI via REST API + Infisical para credenciais.

Uso:
    python3 openwebui_admin.py list-models
    python3 openwebui_admin.py list-users
    python3 openwebui_admin.py create-api-key [--user USER_ID]
    python3 openwebui_admin.py chat --model MODEL --message "texto"
    python3 openwebui_admin.py config

Variáveis de ambiente (ou Infisical):
    OPENWEBUI_URL=http://localhost:8080
    OPENWEBUI_EMAIL=admin@openwebui.local
    OPENWEBUI_PASSWORD=AdminPass123!
    INFISICAL_TOKEN=st.XXX (opcional, para buscar secrets do Infisical)
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, List

# =============================================================================
# Infisical SDK (para credenciais)
# =============================================================================
INFISICAL_AVAILABLE = False
try:
    from infisical import Infisical
    INFISICAL_AVAILABLE = True
except ImportError:
    pass


def get_infisical_secrets(token: str, project_id: str, env: str = "prod") -> Dict[str, str]:
    """Busca secrets do Infisical."""
    if not INFISICAL_AVAILABLE:
        raise ImportError("Infisical SDK não instalado: pip install infisical")

    client = Infisical(token=token)
    secrets = client.secrets.list(project_id=project_id, environment=env)
    return {s.secret: s.value for s in secrets}


def get_config() -> Dict[str, str]:
    """Obtém configuração via env vars ou Infisical."""
    config = {
        "url": os.environ.get("OPENWEBUI_URL", "http://localhost:8080"),
        "email": os.environ.get("OPENWEBUI_EMAIL", ""),
        "password": os.environ.get("OPENWEBUI_PASSWORD", ""),
        "jwt_token": os.environ.get("OPENWEBUI_JWT_TOKEN", ""),
        "api_key": os.environ.get("OPENWEBUI_API_KEY", ""),
        "infisical_token": os.environ.get("INFISICAL_TOKEN", ""),
        "infisical_project_id": os.environ.get("INFISICAL_PROJECT_ID", ""),
    }

    # Se tem Infisical token, tentar obter credenciais de lá
    if config["infisical_token"] and config["infisical_project_id"]:
        try:
            secrets = get_infisical_secrets(
                config["infisical_token"],
                config["infisical_project_id"]
            )
            config["email"] = secrets.get("OPENWEBUI_EMAIL", config["email"])
            config["password"] = secrets.get("OPENWEBUI_PASSWORD", config["password"])
            config["jwt_token"] = secrets.get("OPENWEBUI_JWT_TOKEN", config["jwt_token"])
            config["api_key"] = secrets.get("OPENWEBUI_API_KEY", config["api_key"])
        except Exception as e:
            print(f"Aviso: Não conseguiu carregar do Infisical: {e}", file=sys.stderr)

    return config


def get_auth_token(config: Dict[str, str]) -> str:
    """Obtém token de autenticação (JWT ou API Key)."""
    #JWT token
    if config["jwt_token"]:
        return config["jwt_token"]

    # API key
    if config["api_key"]:
        return config["api_key"]

    # JWT
    if config["email"] and config["password"]:
        req = urllib.request.Request(
            f"{config['url']}/api/v1/auths/signin",
            data=json.dumps({
                "email": config["email"],
                "password": config["password"]
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                return data.get("token", "")
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            raise Exception(f"Sign-in falhou ({e.code}): {body}")

    raise Exception("É necessário OPENWEBUI_EMAIL + OPENWEBUI_PASSWORD ou OPENWEBUI_JWT_TOKEN")


def api_request(
    config: Dict[str, str],
    path: str,
    method: str = "GET",
    data: Optional[Dict[str, Any]] = None,
    token: Optional[str] = None
) -> Dict[str, Any]:
    """Faz request à API do OpenWebUI."""
    if token is None:
        token = get_auth_token(config)

    headers = {"Authorization": f"Bearer {token}"}
    if data is not None:
        headers["Content-Type"] = "application/json"

    body = json.dumps(data).encode() if data else None
    url = f"{config['url']}{path}"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            if not content:
                return {}
            return json.loads(content)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"API request falhou ({e.code}): {body}")
    except Exception as e:
        raise Exception(f"API request falhou: {e}")


# =============================================================================
# Comandos
# =============================================================================

def cmd_list_models(config: Dict[str, str]):
    """Lista modelos disponíveis."""
    result = api_request(config, "/api/v1/models")
    models = result.get("data", result.get("models", []))
    if not models:
        print("Nenhum modelo encontrado.")
        return
    print(f"{len(models)} modelos:")
    for m in models:
        mid = m.get("id", m.get("name", "?"))
        name = m.get("name", mid)
        print(f"  - {name} ({mid})")


def cmd_list_users(config: Dict[str, str]):
    """Lista utilizadores."""
    result = api_request(config, "/api/v1/users")
    users = result.get("data", result.get("users", []))
    if not users:
        print("Nenhum utilizador encontrado.")
        return
    print(f"{len(users)} utilizadores:")
    for u in users:
        print(f"  - {u.get('name')} ({u.get('email')}) - {u.get('role')}")


def cmd_create_api_key(config: Dict[str, str], user_id: Optional[str] = None):
    """Cria API key para o utilizador."""
    payload = {}
    if user_id:
        payload["user_id"] = user_id

    result = api_request(config, "/api/v1/users/api-key", method="POST", data=payload)
    if "api_key" in result:
        print(f"API Key: {result['api_key']}")
    else:
        print(f"Erro: {result}")


def cmd_chat(config: Dict[str, str], model: str, message: str):
    """Envia mensagem de chat."""
    result = api_request(
        config,
        "/api/v1/chat/completions",
        method="POST",
        data={
            "model": model,
            "messages": [{"role": "user", "content": message}]
        }
    )
    if "choices" in result:
        content = result["choices"][0].get("message", {}).get("content", "")
        print(content)
    else:
        print(f"Erro ou resposta vazia: {result}")


def cmd_config(config: Dict[str, str]):
    """Mostra configuração atual do OpenWebUI."""
    result = api_request(config, "/api/v1/config")
    print(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser(description="OpenWebUI Admin CLI")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("list-models", help="Lista modelos disponíveis")
    sub.add_parser("list-users", help="Lista utilizadores")
    sub.add_parser("config", help="Mostra configuração")

    key_cmd = sub.add_parser("create-api-key", help="Cria API key")
    key_cmd.add_argument("--user", help="User ID (opcional)")

    chat_cmd = sub.add_parser("chat", help="Envia mensagem de chat")
    chat_cmd.add_argument("--model", default="gpt-4", help="Modelo a usar")
    chat_cmd.add_argument("--message", required=True, help="Mensagem")

    args = parser.parse_args()
    config = get_config()

    try:
        if args.command == "list-models":
            cmd_list_models(config)
        elif args.command == "list-users":
            cmd_list_users(config)
        elif args.command == "create-api-key":
            cmd_create_api_key(config, args.user)
        elif args.command == "chat":
            cmd_chat(config, args.model, args.message)
        elif args.command == "config":
            cmd_config(config)
        else:
            parser.print_help()
    except Exception as e:
        print(f"Erro: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
