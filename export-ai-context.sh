#!/usr/bin/env bash

set -e

ROOT=~/Desktop/CodeDock/codedock-web
OUT=~/Desktop/CodeDock/AI_CONTEXT.txt

echo "📦 Exporting CodeDock AI context..."

rm -f "$OUT"
touch "$OUT"

section() {
  echo -e "\n\n==================== $1 ====================\n" >> "$OUT"
}

add_file() {
  FILE=$1
  if [ -f "$FILE" ]; then
    echo -e "\n--- $FILE ---\n" >> "$OUT"
    cat "$FILE" >> "$OUT"
  fi
}

########################################
# PROJECT STRUCTURE
########################################
section "PROJECT STRUCTURE"

find "$ROOT" \
  -type d \( -name node_modules -o -name .next -o -name .git \) -prune -o \
  -print | sed "s|$ROOT/||" >> "$OUT"

########################################
# CONFIGURATION
########################################
section "CONFIGURATION"

add_file "$ROOT/package.json"
add_file "$ROOT/tsconfig.json"
add_file "$ROOT/tailwind.config.ts"
add_file "$ROOT/postcss.config.js"
add_file "$ROOT/next.config.js"

########################################
# GLOBAL STYLES
########################################
section "GLOBAL STYLES"

add_file "$ROOT/app/globals.css"

########################################
# APP ROUTES (NEXT APP DIR)
########################################
section "APP ROUTES"

find "$ROOT/app" -type f \( -name "*.tsx" -o -name "*.ts" \) \
  | sort \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

########################################
# COMPONENTS
########################################
section "COMPONENTS"

find "$ROOT/components" -type f \( -name "*.tsx" -o -name "*.ts" \) \
  | sort \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

########################################
# HOOKS
########################################
section "HOOKS"

find "$ROOT/hooks" -type f -name "*.ts" \
  | sort \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

########################################
# API LAYER (VERY IMPORTANT)
########################################
section "API LAYER"

find "$ROOT/lib/api" -type f -name "*.ts" \
  | sort \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

########################################
# TYPES
########################################
section "TYPES"

find "$ROOT" -type f -name "*.ts" | grep "types" \
  | sort \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

########################################
# DESIGN TOKENS (UI SIGNALS)
########################################
section "DESIGN TOKENS"

grep -rEi "color|brand|font|spacing|radius" "$ROOT" \
  --exclude-dir=node_modules \
  --exclude-dir=.next >> "$OUT" 2>/dev/null || true

########################################
# ENV USAGE
########################################
section "ENV USAGE"

grep -r "process.env" "$ROOT" \
  --exclude-dir=node_modules \
  --exclude-dir=.next >> "$OUT" 2>/dev/null || true

########################################
# FINAL
########################################
echo ""
echo "✅ AI context export complete"
echo "📄 File: $OUT"