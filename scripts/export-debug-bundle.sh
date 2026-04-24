#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$(pwd)}"
OUTPUT_FILE="${2:-$PROJECT_ROOT/codedock-debug-bundle.txt}"

if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "ERROR: Project root does not exist: $PROJECT_ROOT" >&2
  exit 1
fi

cd "$PROJECT_ROOT"

INCLUDE_EXTENSIONS=(
  "*.go"
  "*.ts"
  "*.tsx"
  "*.js"
  "*.jsx"
  "*.json"
  "*.md"
  "*.txt"
  "*.yaml"
  "*.yml"
  "*.sql"
  "*.sh"
  "*.bash"
  "*.zsh"
  "*.html"
  "*.css"
  "*.scss"
  "*.xml"
  "*.toml"
  "*.ini"
  "*.cfg"
  "*.conf"
  "Dockerfile"
  ".env.example"
)

EXCLUDE_DIRS=(
  ".git"
  "node_modules"
  "dist"
  "build"
  ".next"
  "coverage"
  ".turbo"
  ".cache"
  "tmp"
  "vendor"
  ".idea"
  ".vscode-test"
)

build_find_expr() {
  local first=1
  for dir in "${EXCLUDE_DIRS[@]}"; do
    if [[ $first -eq 1 ]]; then
      printf '( -path "./%s" -o -path "./%s/*"' "$dir" "$dir"
      first=0
    else
      printf ' -o -path "./%s" -o -path "./%s/*"' "$dir" "$dir"
    fi
  done
  printf ' )'
}

EXCLUDE_EXPR="$(build_find_expr)"

{
  echo "============================================================"
  echo "CodeDock Debug Bundle"
  echo "Generated at: $(date -Iseconds)"
  echo "Project root: $PROJECT_ROOT"
  echo "============================================================"
  echo
  echo "==================== FILE TREE =============================="
  echo

  find . $(printf '! %s ' "$EXCLUDE_EXPR") -prune -o -type f -print 2>/dev/null | sort

  echo
  echo "==================== FILE CONTENTS =========================="
  echo

  while IFS= read -r file; do
    rel="${file#./}"

    echo "------------------------------------------------------------"
    echo "FILE: $rel"
    echo "------------------------------------------------------------"

    if file "$file" | grep -qiE 'text|json|xml|javascript|typescript|html|css|shell|unicode'; then
      sed -n '1,400p' "$file"
    else
      echo "[skipped non-text or unsupported file]"
    fi

    echo
  done < <(
    find . $(printf '! %s ' "$EXCLUDE_EXPR") -prune -o -type f \( \
      $(printf -- '-name "%s" -o ' "${INCLUDE_EXTENSIONS[@]}" | sed 's/ -o $//') \
    \) -print | sort
  )

} > "$OUTPUT_FILE"

echo "Done."
echo "Bundle written to: $OUTPUT_FILE"
wc -l "$OUTPUT_FILE"