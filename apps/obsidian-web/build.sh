#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Building obsidian-web container..."
docker build -t obsidian-web:local .

echo "Build complete!"