#!/usr/bin/env python3
"""
hermes-tree.py — Contexto Aider-like para agentes

FILOSOFIA: Zero estado. Zero daemon. APENAS lê árvore do repo.
NÃO mantém SQLite, NÃO faz backup, NÃO consome RAM.
Gera tree em 50ms e morre.

Uso:
    python3 scripts/hermes-tree.py /srv/monorepo --depth 3
    python3 scripts/hermes-tree.py . --format json

Lei do Repo (AGENTS.md § Hermes Tree-Only):
    "Hermes-second-brain é tree-only. Proibido manter state.db,
     state.json, ou qualquer arquivo de estado > 1MB."
"""
import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

DEFAULT_IGNORE = {
    ".git", "__pycache__", "node_modules", ".venv", "venv",
    "dist", "build", ".turbo", ".next", "coverage",
    "*.pyc", "*.pyo", "*.egg-info", ".mypy_cache",
    ".pytest_cache", ".ruff_cache", ".claude-events",
    "state.db", "response_store.db", ".skills_prompt_snapshot.json",
    "models_dev_cache.json", "audio_cache", "image_cache", "snapshots",
    "sessions", "logs", "backups", "cache", ".cache", "mem0-data",
}


def should_ignore(path: Path, root: Path) -> bool:
    """Retorna True se o arquivo/diretório deve ser ignorado."""
    name = path.name
    rel = path.relative_to(root)
    parts = rel.parts

    for part in parts:
        if part in DEFAULT_IGNORE:
            return True
        if part.startswith(".") and part not in {".github", ".gitea", ".claude"}:
            return True
    if any(name.endswith(ext.replace("*", "")) for ext in DEFAULT_IGNORE if ext.startswith("*")):
        return True
    return False


def read_file_preview(path: Path, max_chars: int = 500) -> str:
    """Lê preview do arquivo com limite de caracteres."""
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
        if len(text) > max_chars:
            text = text[:max_chars] + f"\n... ({len(text)} chars total)"
        return text
    except Exception:
        return "[binary or unreadable]"


def build_tree(repo_root: str, max_depth: int = 3, with_preview: bool = False):
    """Constrói árvore de arquivos no estilo Aider."""
    root = Path(repo_root).resolve()
    if not root.exists():
        raise FileNotFoundError(f"Repo not found: {root}")

    tree = {
        "meta": {
            "root": str(root),
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "max_depth": max_depth,
            "with_preview": with_preview,
        },
        "files": [],
    }

    for item in root.rglob("*"):
        if item.is_file() and not should_ignore(item, root):
            depth = len(item.relative_to(root).parts)
            if depth > max_depth:
                continue

            file_entry = {
                "path": str(item.relative_to(root)),
                "size": item.stat().st_size,
                "depth": depth,
            }
            if with_preview:
                file_entry["preview"] = read_file_preview(item)
            tree["files"].append(file_entry)

    tree["meta"]["total_files"] = len(tree["files"])
    tree["meta"]["total_size_mb"] = round(
        sum(f["size"] for f in tree["files"]) / (1024 * 1024), 2
    )
    return tree


def print_tree(tree: dict, fmt: str = "text"):
    """Imprime árvore no formato escolhido."""
    meta = tree["meta"]

    if fmt == "json":
        print(json.dumps(tree, indent=2, ensure_ascii=False))
        return

    # Text format (Aider-like)
    print(f"# Repo Tree: {meta['root']}")
    print(f"> Generated: {meta['generated_at']}")
    print(f"> Files: {meta['total_files']} | Size: {meta['total_size_mb']} MB")
    print("")

    for f in sorted(tree["files"], key=lambda x: x["path"]):
        prefix = "  " * (f["depth"] - 1)
        print(f"{prefix}├── {f['path']} ({f['size']} bytes)")
        if f.get("preview"):
            for line in f["preview"].split("\n")[:3]:
                print(f"{prefix}│   {line}")
            if len(f["preview"].split("\n")) > 3:
                print(f"{prefix}│   ...")


def main():
    parser = argparse.ArgumentParser(
        description="Hermes Tree — Aider-like repo context (zero state)"
    )
    parser.add_argument("repo", nargs="?", default=".", help="Repo root path")
    parser.add_argument("--depth", type=int, default=3, help="Max directory depth")
    parser.add_argument("--preview", action="store_true", help="Include file previews")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    tree = build_tree(args.repo, max_depth=args.depth, with_preview=args.preview)
    print_tree(tree, fmt=args.format)


if __name__ == "__main__":
    main()
