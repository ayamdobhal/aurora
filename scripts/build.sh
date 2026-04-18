#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Type-checking..."
tsc --noEmit

echo "Building..."
mkdir -p extensions

for src in src/*.ts; do
  name="$(basename "$src" .ts)"
  [[ "$name" == *.d ]] && continue
  esbuild "$src" \
    --bundle \
    --format=iife \
    --target=es2020 \
    --outfile="extensions/$name.js" \
    --log-level=warning
  echo "  Built extensions/$name.js"
done

echo "Done."
