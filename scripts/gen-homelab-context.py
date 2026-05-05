#!/usr/bin/env python3
"""
gen-homelab-context.py — Gera mapa de contexto do homelab inteiro.
Escaneia /srv/, /home/will/, Docker, portas, systemd.
Output: /srv/monorepo/HOMELAB_CONTEXT_TREE.md
"""

import json
import os
import subprocess
from pathlib import Path

REPO_ROOT = Path("/srv/monorepo")
OUTPUT = REPO_ROOT / "HOMELAB_CONTEXT_TREE.md"


def run(cmd, default=""):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        return default


def scan_srv():
    """Scan /srv/ directories."""
    lines = ["## 🖥️  /srv/ — Serviços e Dados\n"]
    entries = sorted(Path("/srv").iterdir(), key=lambda x: x.name)
    for entry in entries:
        if entry.name == "monorepo":
            lines.append(f"- **`{entry.name}/`** — Monorepo principal (este repo)")
        elif entry.is_symlink():
            target = os.readlink(entry)
            lines.append(f"- **`{entry.name}`** → `{target}` (symlink)")
        elif entry.is_dir():
            size = run(f"du -sh {entry} 2>/dev/null | cut -f1", "?")
            lines.append(f"- **`{entry.name}/`** — dir ({size})")
        else:
            lines.append(f"- `{entry.name}` — file")
    return "\n".join(lines) + "\n"


def scan_home():
    """Scan /home/will/ relevant dirs."""
    lines = ["## 🏠 /home/will/ — Configurações do Usuário\n"]
    relevant = [".hermes", ".claude", ".config", ".local", "Desktop", "Documents"]
    home = Path("/home/will")
    for name in relevant:
        p = home / name
        if p.exists():
            if p.is_symlink():
                target = os.readlink(p)
                lines.append(f"- **`.{name}`** → `{target}` (symlink)")
            elif p.is_dir():
                size = run(f"du -sh {p} 2>/dev/null | cut -f1", "?")
                desc = {
                    ".hermes": "Hermes Agent (assistente pessoal)",
                    ".claude": "Configurações Claude Code",
                    ".config": "Configurações de apps",
                    ".local": "Dados locais de apps",
                    "Desktop": "Área de trabalho",
                    "Documents": "Documentos",
                }.get(name, "diretório")
                lines.append(f"- **`.{name}/`** — {desc} ({size})")
    return "\n".join(lines) + "\n"


def scan_docker():
    """List running Docker containers."""
    lines = ["## 🐳 Docker Containers Ativos\n"]
    out = run("docker ps --format '{{.Names}}|{{.Image}}|{{.Ports}}' 2>/dev/null", "")
    if not out:
        lines.append("_Nenhum container rodando._\n")
        return "\n".join(lines)
    for line in out.split("\n"):
        if "|" in line:
            name, image, ports = line.split("|", 2)
            lines.append(f"- **`{name}`** — `{image}` ({ports or 'no ports'})")
    return "\n".join(lines) + "\n"


def scan_ports():
    """List listening ports."""
    lines = ["## 🔌 Portas em Uso (principais)\n"]
    out = run("ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $7}'", "")
    ports = {}
    for line in out.split("\n")[:30]:  # limit
        if ":" in line:
            addr_proc = line.strip().split(" ", 1)
            if len(addr_proc) >= 2:
                addr, proc = addr_proc[0], addr_proc[1]
                port = addr.split(":")[-1]
                ports[port] = proc
    for port in sorted(ports.keys(), key=int):
        lines.append(f"- **`:{port}`** — `{ports[port]}`")
    return "\n".join(lines) + "\n"


def scan_systemd():
    """List active systemd services."""
    lines = ["## ⚙️ Systemd Services Ativos\n"]
    out = run("systemctl list-units --type=service --state=active --no-pager --plain 2>/dev/null | grep '\\.service' | awk '{print $1}'", "")
    services = [s for s in out.split("\n") if s and "systemd-" not in s and "dbus" not in s and "cron" not in s][:20]
    for svc in services:
        lines.append(f"- `{svc}`")
    return "\n".join(lines) + "\n"


def scan_monorepo():
    """Summary of monorepo structure."""
    lines = [
        "## 📦 Monorepo Estrutura (Resumo)\n",
        "Ver `AGENTS.md` para detalhes completos.\n",
        "```",
        "apps/          — Gateways e APIs (api, web, ai-gateway)",
        "libs/          — Frameworks internos (nexus, memory)",
        "packages/      — Bibliotecas compartilhadas (ui, zod-schemas, config)",
        "scripts/       — Automações e utilitários",
        "services/      — Microserviços Docker",
        "deployments/   — Docker Compose e infra",
        "docs/          — Documentação e SPECs",
        "tests/         — Testes",
        "```\n",
    ]
    return "\n".join(lines)


def main():
    print("🔍 Scanning homelab...")

    sections = [
        "# 🧠 HOMELAB CONTEXT TREE\n",
        "> **Gerado automaticamente.** Leia isto antes de tocar em qualquer coisa.\n",
        "> **Data:** " + run("date -Iseconds") + "\n",
        "---\n",
        scan_srv(),
        scan_home(),
        scan_docker(),
        scan_ports(),
        scan_systemd(),
        scan_monorepo(),
        "---\n",
        "*Gerado por scripts/gen-homelab-context.py*",
    ]

    content = "\n".join(sections)
    OUTPUT.write_text(content, encoding="utf-8")
    print(f"✅ HOMELAB_CONTEXT_TREE.md gerado em {OUTPUT}")
    print(f"   {len(content)} caracteres, {content.count(chr(10))} linhas")


if __name__ == "__main__":
    main()