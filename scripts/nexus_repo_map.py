#!/usr/bin/env python3
"""
nexus_repo_map.py — Lightweight repo mapper for Nexus Aider Executor
Replaces /srv/hermes-second-brain/libs/nexus_repo_map.py
Zero external dependencies, uses only stdlib.
"""
import os
import sys
import json
import argparse
from pathlib import Path

# File extensions that contain code symbols
CODE_EXTS = {".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".kt"}


def extract_symbols(content: str, ext: str) -> dict:
    """Naive symbol extraction from file content."""
    symbols = {"functions": [], "classes": [], "imports": [], "exports": []}
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("//") or stripped.startswith("#"):
            continue
        if ext in {".py"}:
            if stripped.startswith("def "):
                symbols["functions"].append(stripped.split("(")[0].replace("def ", ""))
            elif stripped.startswith("class "):
                symbols["classes"].append(stripped.split("(")[0].replace("class ", "").replace(":", ""))
            elif "import " in stripped:
                symbols["imports"].append(stripped)
        elif ext in {".ts", ".tsx", ".js", ".jsx"}:
            if stripped.startswith("export "):
                symbols["exports"].append(stripped)
            elif stripped.startswith("function ") or stripped.startswith("const ") or stripped.startswith("async function"):
                symbols["functions"].append(stripped.split("(")[0].split(" ")[-1])
            elif stripped.startswith("import "):
                symbols["imports"].append(stripped)
    return symbols


def build_repo_map(repo_root: str, scope: str = "") -> dict:
    root = Path(repo_root).resolve()
    if not root.exists():
        raise FileNotFoundError(f"Repo not found: {root}")

    files_indexed = 0
    total_symbols = 0
    files = []

    search_root = root / scope if scope else root
    if not search_root.exists():
        search_root = root

    for item in search_root.rglob("*"):
        if item.is_file() and item.suffix in CODE_EXTS:
            rel = str(item.relative_to(root))
            # Skip common ignore patterns
            if any(part.startswith(".") for part in item.relative_to(root).parts):
                continue
            if "node_modules" in rel or "__pycache__" in rel or "dist" in rel or "build" in rel:
                continue

            try:
                content = item.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            lines = len(content.splitlines())
            syms = extract_symbols(content, item.suffix)
            file_symbols = sum(len(v) for v in syms.values())
            total_symbols += file_symbols
            files_indexed += 1

            files.append({
                "path": rel,
                "symbols": file_symbols,
                "functions": syms["functions"][:10],  # cap for brevity
                "classes": syms["classes"][:10],
                "imports": syms["imports"][:5],
                "exports": syms["exports"][:5],
                "lines": lines,
            })

    return {
        "repo": str(root),
        "scope": scope or "root",
        "files_indexed": files_indexed,
        "total_symbols": total_symbols,
        "files": files,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate repo map JSON")
    parser.add_argument("repo", help="Repository root path")
    parser.add_argument("--scope", default="", help="Subdirectory scope")
    args = parser.parse_args()

    result = build_repo_map(args.repo, args.scope)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
