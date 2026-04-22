#!/usr/bin/env bash
set -Eeuo pipefail

# CodeDock targeted debug bundle generator
# Usage:
#   bash scripts/show-debug-files.sh
# Optional:
#   bash scripts/show-debug-files.sh /path/to/project

PROJECT_ROOT="${1:-$(pwd)}"
OUTPUT_FILE="${PROJECT_ROOT}/codedock-debug-bundle.txt"

if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "ERROR: Project root does not exist: $PROJECT_ROOT" >&2
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/go.mod" && ! -d "$PROJECT_ROOT/extension" ]]; then
  echo "ERROR: This does not look like the CodeDock project root." >&2
  echo "Expected at least go.mod or an extension/ directory." >&2
  exit 1
fi

TARGET_FILES=(
  "extension/src/yjs-sync.ts"
  "extension/src/cursor-manager.ts"
  "extension/src/extension.ts"
  "extension/src/chat.ts"
  "extension/package.json"
  "go.mod"
  "main.go"
)

TARGET_DIRS=(
  "extension/src"
  "internal"
  "migration"
)

{
  echo "============================================================"
  echo "CodeDock Debug Bundle"
  echo "Generated at: $(date -Iseconds)"
  echo "Project root: $PROJECT_ROOT"
  echo "============================================================"
  echo

  echo "## Directory snapshot"
  for dir in "${TARGET_DIRS[@]}"; do
    ABS_DIR="${PROJECT_ROOT}/${dir}"
    if [[ -d "$ABS_DIR" ]]; then
      echo
      echo "### ${dir}"
      find "$ABS_DIR" \
        \( -type d \( -name node_modules -o -name dist -o -name build -o -name .git -o -name coverage \) -prune \) -o \
        -type f | sed "s#^${PROJECT_ROOT}/##" | sort
    else
      echo
      echo "### ${dir}"
      echo "[missing directory]"
    fi
  done

  echo
  echo "============================================================"
  echo "## Targeted file contents"
  echo "============================================================"

  for rel_path in "${TARGET_FILES[@]}"; do
    abs_path="${PROJECT_ROOT}/${rel_path}"
    echo
    echo "------------------------------------------------------------"
    echo "FILE: ${rel_path}"
    echo "------------------------------------------------------------"

    if [[ -f "$abs_path" ]]; then
      cat "$abs_path"
    else
      echo "[missing file]"
    fi
  done
} > "$OUTPUT_FILE"

echo "Debug bundle written to:"
echo "  $OUTPUT_FILE"