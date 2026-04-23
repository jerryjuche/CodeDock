#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$(pwd)}"
OUTPUT_FILE="${2:-$PROJECT_ROOT/workspace-phase-bundle.txt}"

FILES=(
  "internal/hub/message.go"
  "internal/hub/hub.go"
  "extension/src/extension.ts"
  "extension/src/yjs-sync.ts"
  "extension/src/protocol.ts"
  "extension/src/types.ts"
)

if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "ERROR: Project root does not exist: $PROJECT_ROOT" >&2
  exit 1
fi

{
  echo "============================================================"
  echo "CodeDock Workspace Phase Bundle"
  echo "Generated at: $(date -Iseconds)"
  echo "Project root: $PROJECT_ROOT"
  echo "============================================================"
  echo

  for rel_path in "${FILES[@]}"; do
    abs_path="$PROJECT_ROOT/$rel_path"

    echo "------------------------------------------------------------"
    echo "FILE: $rel_path"
    echo "------------------------------------------------------------"

    if [[ -f "$abs_path" ]]; then
      sed -n '1,400p' "$abs_path"
    else
      echo "[missing file]"
    fi

    echo
  done
} > "$OUTPUT_FILE"

echo "Done."
echo "Bundle written to: $OUTPUT_FILE"
echo
wc -l "$OUTPUT_FILE"