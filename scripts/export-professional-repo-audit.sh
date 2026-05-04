#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/Desktop/CodeDock}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$ROOT/debug-dumps"
OUT_FILE="$OUT_DIR/codedock_repo_audit_$STAMP.txt"

mkdir -p "$OUT_DIR"

section() {
  echo "" >> "$OUT_FILE"
  echo "================================================================================" >> "$OUT_FILE"
  echo "$1" >> "$OUT_FILE"
  echo "================================================================================" >> "$OUT_FILE"
}

dump_file() {
  local file="$1"
  section "FILE: $file"

  if [ -f "$ROOT/$file" ]; then
    nl -ba "$ROOT/$file" >> "$OUT_FILE"
  else
    echo "[MISSING] $ROOT/$file" >> "$OUT_FILE"
  fi
}

run_cmd() {
  local title="$1"
  shift

  section "COMMAND: $title"
  (
    cd "$ROOT"
    "$@"
  ) >> "$OUT_FILE" 2>&1 || true
}

: > "$OUT_FILE"

section "CODEDOCK PROFESSIONAL REPO AUDIT"
{
  echo "Generated: $(date)"
  echo "Project:   $ROOT"
  echo "User:      $(whoami)"
  echo "Host:      $(hostname)"
  echo "Shell:     $SHELL"
} >> "$OUT_FILE"

section "SYSTEM / TOOLCHAIN"
{
  echo "--- OS ---"
  uname -a || true
  echo
  echo "--- Git ---"
  git --version || true
  echo
  echo "--- Go ---"
  go version || true
  echo
  echo "--- Node ---"
  node -v || true
  npm -v || true
  echo
  echo "--- Fly ---"
  fly version || true
  echo
  echo "--- Vercel ---"
  vercel --version || true
  echo
  echo "--- VSCE ---"
  vsce --version || true
  echo
  echo "--- PostgreSQL client ---"
  psql --version || true
} >> "$OUT_FILE" 2>&1 || true

section "GIT STATE"
(
  cd "$ROOT"
  echo "--- Branch ---"
  git branch --show-current || true
  echo
  echo "--- Status ---"
  git status --short || true
  echo
  echo "--- Recent commits ---"
  git log --oneline --decorate -12 || true
  echo
  echo "--- Author config ---"
  git config --show-origin --get-all user.name || true
  git config --show-origin --get-all user.email || true
  echo
  echo "--- Ignored sample ---"
  git status --ignored --short | head -200 || true
) >> "$OUT_FILE" 2>&1 || true

section "TOP-LEVEL TREE"
(
  cd "$ROOT"
  find . -maxdepth 3 \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './*/node_modules' -prune -o \
    -path './*/.next' -prune -o \
    -path './*/out' -prune -o \
    -path './*/dist' -prune -o \
    -path './debug-dumps' -prune -o \
    -print | sort
) >> "$OUT_FILE" 2>&1 || true

section "ALL IMPORTANT FILES"
(
  cd "$ROOT"
  find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './*/node_modules' -prune -o \
    -path './*/.next' -prune -o \
    -path './*/out' -prune -o \
    -path './*/dist' -prune -o \
    -path './debug-dumps' -prune -o \
    -type f \( \
      -name '*.go' -o \
      -name '*.ts' -o \
      -name '*.tsx' -o \
      -name '*.js' -o \
      -name '*.json' -o \
      -name '*.sql' -o \
      -name '*.md' -o \
      -name 'Dockerfile' -o \
      -name 'fly.toml' -o \
      -name '.gitignore' -o \
      -name '.dockerignore' -o \
      -name '.vercelignore' -o \
      -name 'package.json' -o \
      -name 'package-lock.json' \
    \) -print | sort
) >> "$OUT_FILE" 2>&1 || true

section "FILE SIZE HOTSPOTS"
(
  cd "$ROOT"
  find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './*/node_modules' -prune -o \
    -path './debug-dumps' -prune -o \
    -type f -printf '%s %p\n' 2>/dev/null | sort -nr | head -80
) >> "$OUT_FILE" 2>&1 || true

section "POSSIBLE SECRETS / LOCAL FILES CHECK"
(
  cd "$ROOT"
  echo "--- Sensitive-looking filenames ---"
  find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './*/node_modules' -prune -o \
    -path './debug-dumps' -prune -o \
    -type f \( \
      -name '.env' -o \
      -name '.env.*' -o \
      -name '*.pem' -o \
      -name '*.key' -o \
      -name '*.crt' -o \
      -name '*secret*' -o \
      -name '*token*' \
    \) -print | sort

  echo
  echo "--- Tracked sensitive-looking files ---"
  git ls-files | grep -Ei '(^|/)\.env|secret|token|\.pem$|\.key$|\.crt$' || true
) >> "$OUT_FILE" 2>&1 || true

section "PACKAGE MANAGERS / LOCKFILES"
(
  cd "$ROOT"
  find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -path './*/node_modules' -prune -o \
    -type f \( \
      -name 'package.json' -o \
      -name 'package-lock.json' -o \
      -name 'pnpm-lock.yaml' -o \
      -name 'yarn.lock' -o \
      -name 'go.mod' -o \
      -name 'go.sum' \
    \) -print | sort
) >> "$OUT_FILE" 2>&1 || true

section "ROUTES / PUBLIC ENDPOINTS"
(
  cd "$ROOT"
  grep -R "HandleFunc\|mux.Handle\|/health\|/ready\|/auth\|/rooms\|/ws\|vscode/launch/exchange\|NEXT_PUBLIC_API_BASE_URL\|WEB_ALLOWED_ORIGINS" -n \
    main.go internal codedock-web extension \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=out \
    --exclude-dir=dist \
    --exclude-dir=.git || true
) >> "$OUT_FILE" 2>&1 || true

section "DEPLOYMENT CONFIG SEARCH"
(
  cd "$ROOT"
  grep -R "fly.toml\|Dockerfile\|vercel\|NEXT_PUBLIC\|DATABASE_URL\|WEB_ALLOWED_ORIGINS\|codedock.fly.dev\|code-dock-beige" -n . \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=out \
    --exclude-dir=dist \
    --exclude-dir=debug-dumps || true
) >> "$OUT_FILE" 2>&1 || true

section "GITIGNORE / DOCKERIGNORE ANALYSIS"
(
  cd "$ROOT"
  echo "--- Current ignore files ---"
  find . -maxdepth 4 \( -name '.gitignore' -o -name '.dockerignore' -o -name '.vercelignore' \) -print | sort
  echo
  echo "--- Tracked generated artifacts that may need removal ---"
  git ls-files | grep -Ei 'node_modules|\.next|(^|/)out/|(^|/)dist/|\.vsix$|\.env|debug-dumps|\.vercel|\.DS_Store|\.log$|\.bak$' || true
) >> "$OUT_FILE" 2>&1 || true

section "BUILD / TEST CONFIG FILES"
dump_file "go.mod"
dump_file "go.sum"
dump_file "package.json"
dump_file "package-lock.json"

dump_file "Dockerfile"
dump_file "fly.toml"
dump_file ".gitignore"
dump_file ".dockerignore"
dump_file ".vercelignore"
dump_file "README.md"

section "BACKEND KEY FILES"
dump_file "main.go"
dump_file "internal/handlers/health.go"
dump_file "internal/handlers/auth.go"
dump_file "internal/handlers/rooms.go"
dump_file "internal/handlers/invites.go"
dump_file "internal/handlers/launch.go"
dump_file "internal/handlers/ws.go"
dump_file "internal/services/rooms.go"
dump_file "internal/services/invite.go"
dump_file "internal/services/launch.go"
dump_file "internal/services/users.go"
dump_file "internal/services/snapshots.go"
dump_file "internal/hub/hub.go"
dump_file "internal/hub/client.go"
dump_file "internal/hub/message.go"

section "FRONTEND KEY FILES"
dump_file "codedock-web/package.json"
dump_file "codedock-web/package-lock.json"
dump_file "codedock-web/.gitignore"
dump_file "codedock-web/.env.example"
dump_file "codedock-web/next.config.ts"
dump_file "codedock-web/next.config.js"
dump_file "codedock-web/app/layout.tsx"
dump_file "codedock-web/app/page.tsx"
dump_file "codedock-web/lib/config/env.ts"
dump_file "codedock-web/lib/api/client.ts"

section "EXTENSION KEY FILES"
dump_file "extension/package.json"
dump_file "extension/tsconfig.json"
dump_file "extension/esbuild.js"
dump_file "extension/src/extension.ts"
dump_file "extension/src/api.ts"
dump_file "extension/src/auth.ts"
dump_file "extension/src/websocket.ts"
dump_file "extension/README.md"

section "MIGRATIONS"
(
  cd "$ROOT"
  find migration -maxdepth 2 -type f -name '*.sql' -print | sort | while read -r file; do
    echo
    echo "--------------------------------------------------------------------------------"
    echo "$file"
    echo "--------------------------------------------------------------------------------"
    nl -ba "$file"
  done
) >> "$OUT_FILE" 2>&1 || true

section "LOCAL BUILD CHECKS"
run_cmd "go test internal packages" go test ./internal/... -count=1
run_cmd "go build all packages" go build ./...
run_cmd "frontend npm build" bash -lc 'cd codedock-web && npm run build'
run_cmd "extension npm compile" bash -lc 'cd extension && npm run compile'

section "RECOMMENDED OUTPUT TARGETS"
{
  echo "Use this audit to generate:"
  echo "- Root .gitignore"
  echo "- Root .dockerignore"
  echo "- Optional .vercelignore"
  echo "- README.md"
  echo "- DEPLOYMENT.md"
  echo "- SECURITY.md"
  echo "- CONTRIBUTING.md"
  echo "- scripts for migrations/deploys"
} >> "$OUT_FILE"

echo "✅ CodeDock repo audit created:"
echo "$OUT_FILE"
echo
echo "Upload this file here:"
echo "$OUT_FILE"
