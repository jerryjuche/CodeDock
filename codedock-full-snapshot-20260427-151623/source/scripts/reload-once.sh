#!/usr/bin/env bash
set -Eeuo pipefail

EXT_DIR="${1:-$HOME/Desktop/CodeDock/extension}"

if [[ ! -d "$EXT_DIR" ]]; then
  echo "ERROR: Extension directory not found: $EXT_DIR" >&2
  exit 1
fi

cd "$EXT_DIR"

echo "==> Compiling CodeDock extension..."
npm run compile

echo
echo "Compile succeeded."
echo "Now reload the Extension Development Host once:"
echo "  Ctrl+Shift+P  ->  Developer: Reload Window"