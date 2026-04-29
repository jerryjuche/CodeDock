#!/usr/bin/env bash

set -e

ROOT=~/Desktop/CodeDock/codedock-web
OUT=~/Desktop/CodeDock/UI_CONTEXT.txt

echo "🎨 Exporting UI context..."

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
# DESIGN TOKENS
########################################
section "DESIGN TOKENS (CRITICAL)"

add_file "$ROOT/app/globals.css"
add_file "$ROOT/tailwind.config.ts"

########################################
# CORE UI COMPONENTS
########################################
section "CORE UI COMPONENTS"

find "$ROOT/components/ui" -type f -name "*.tsx" \
  | sort \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

########################################
# LAYOUT COMPONENTS
########################################
section "LAYOUT COMPONENTS"

find "$ROOT/components" -type f -name "*layout*.tsx" \
  | sort \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

########################################
# KEY PAGES (VISUAL STRUCTURE)
########################################
section "KEY UI PAGES"

# dashboard
find "$ROOT/app" -type f -path "*dashboard*" -name "*.tsx" \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

# room pages
find "$ROOT/app" -type f -path "*rooms*" -name "*.tsx" \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

# auth pages
find "$ROOT/app" -type f \( -path "*login*" -o -path "*register*" \) \
  | while read file; do
    echo -e "\n--- $file ---" >> "$OUT"
    cat "$file" >> "$OUT"
  done

########################################
# VISUAL COMPONENTS
########################################
section "VISUAL COMPONENTS"

find "$ROOT/components" -type f \( \
  -name "*card*.tsx" -o \
  -name "*button*.tsx" -o \
  -name "*input*.tsx" -o \
  -name "*form*.tsx" \
\) | while read file; do
  echo -e "\n--- $file ---" >> "$OUT"
  cat "$file" >> "$OUT"
done

########################################
# DESIGN SIGNALS
########################################
section "DESIGN SIGNALS"

grep -rEi "bg-|text-|border-|rounded-|shadow-" "$ROOT/components" \
  --exclude-dir=node_modules >> "$OUT" 2>/dev/null || true

########################################
# DONE
########################################

echo ""
echo "✅ UI context exported"
echo "📄 File: $OUT"