#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/Desktop/CodeDock}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$ROOT/debug-dumps"
OUT_FILE="$OUT_DIR/open_ide_refactor_context_$STAMP.txt"

mkdir -p "$OUT_DIR"
: > "$OUT_FILE"

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

section "OPEN IDE REFACTOR CONTEXT"
{
  echo "Generated: $(date)"
  echo "Project:   $ROOT"
  echo "Branch:    $(cd "$ROOT" && git branch --show-current 2>/dev/null || true)"
  echo "Commit:    $(cd "$ROOT" && git rev-parse --short HEAD 2>/dev/null || true)"
  echo
  echo "Goal:"
  echo "- Replace Open in VS Code UI with Open IDE"
  echo "- Show a modal so the user chooses Visual Studio Code or Antigravity"
  echo "- Keep the existing backend launch-token flow"
  echo "- Do not rename backend routes yet"
  echo "- Do not break room readiness/launch_allowed logic"
} >> "$OUT_FILE"

section "GIT STATE"
(
  cd "$ROOT"
  git status --short
  echo
  git log --oneline --decorate -8
) >> "$OUT_FILE" 2>&1 || true

section "FRONTEND TREE: ROOM COMPONENTS"
(
  cd "$ROOT"
  find codedock-web/components/rooms codedock-web/lib codedock-web/hooks codedock-web/types \
    -maxdepth 3 \
    -type f \
    \( -name '*.ts' -o -name '*.tsx' \) \
    | sort
) >> "$OUT_FILE" 2>&1 || true

section "RELEVANT SEARCH RESULTS"
(
  cd "$ROOT"

  echo "--- Open in VS Code references ---"
  grep -R "OpenInVSCode\|Open in VS Code\|open-in-vscode\|openInVSCode\|vscode://" -n \
    codedock-web internal extension \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=out \
    --exclude-dir=dist \
    --exclude-dir=.git || true

  echo
  echo "--- Launch token references ---"
  grep -R "launch_token\|LaunchToken\|deep_link\|open-in-vscode\|createLaunch\|useLaunch" -n \
    codedock-web internal extension \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=out \
    --exclude-dir=dist \
    --exclude-dir=.git || true

  echo
  echo "--- Room readiness / launch allowed references ---"
  grep -R "launch_allowed\|launchAllowed\|LaunchAllowed\|disabledReason\|source_state\|sourceState" -n \
    codedock-web internal \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=out \
    --exclude-dir=dist \
    --exclude-dir=.git || true

  echo
  echo "--- Token storage references ---"
  grep -R "getStoredToken\|setStoredToken\|localStorage\|auth_token\|authToken" -n \
    codedock-web/lib codedock-web/hooks codedock-web/components \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=out \
    --exclude-dir=dist \
    --exclude-dir=.git || true
) >> "$OUT_FILE" 2>&1 || true

section "PACKAGE / TYPESCRIPT CONFIG"
dump_file "codedock-web/package.json"
dump_file "codedock-web/tsconfig.json"
dump_file "codedock-web/next.config.ts"

section "PRIMARY FRONTEND FILES"
dump_file "codedock-web/components/rooms/open-in-vscode-button.tsx"
dump_file "codedock-web/components/rooms/room-details-page.tsx"
dump_file "codedock-web/lib/api/launch.ts"
dump_file "codedock-web/hooks/use-launch.ts"
dump_file "codedock-web/lib/utils/storage.ts"
dump_file "codedock-web/types/launch.ts"
dump_file "codedock-web/types/room.ts"

section "UI SUPPORT FILES"
dump_file "codedock-web/components/ui/button.tsx"
dump_file "codedock-web/components/ui/card.tsx"
dump_file "codedock-web/components/ui/badge.tsx"
dump_file "codedock-web/components/ui/spinner.tsx"
dump_file "codedock-web/components/ui/toast.tsx"
dump_file "codedock-web/lib/utils.ts"

section "ROOM PAGE RELATED COMPONENTS"
dump_file "codedock-web/components/rooms/room-header.tsx"
dump_file "codedock-web/components/rooms/source-state-card.tsx"
dump_file "codedock-web/components/rooms/room-source-badge.tsx"
dump_file "codedock-web/components/rooms/presence-card.tsx"
dump_file "codedock-web/components/rooms/delete-room-button.tsx"

section "BACKEND LAUNCH CONTEXT - DO NOT MODIFY UNLESS NECESSARY"
dump_file "internal/handlers/launch.go"
dump_file "internal/services/launch.go"
dump_file "internal/handlers/integration_test.go"

section "EXTENSION URI CONTEXT - DO NOT MODIFY FOR THIS FRONTEND-ONLY CHANGE"
dump_file "extension/src/extension.ts"
dump_file "extension/src/api.ts"
dump_file "extension/package.json"

section "EXPECTED IMPLEMENTATION WALKTHROUGH"
cat >> "$OUT_FILE" <<'PLAN'
Implement this as a frontend-only refactor first.

Required behavior:
1. Room page should show "Open IDE", not "Open in VS Code".
2. Clicking "Open IDE" opens a modal/picker.
3. Modal lets user choose:
   - Visual Studio Code
   - Antigravity
4. Do not create a launch token when the modal opens.
5. Create the launch token only after the user selects an IDE.
6. Keep using the existing backend endpoint:
   POST /rooms/{roomId}/open-in-vscode
7. Keep existing room readiness/disabled logic exactly as-is.
8. Build editor URI from the returned launch token:
   vscode://jerryjuche.codedock/launch?token=<encoded-token>
   antigravity://jerryjuche.codedock/launch?token=<encoded-token>
9. Use the backend-provided deep_link for VS Code when available.
10. Put Antigravity scheme in one helper constant so it is easy to change after real testing.
11. Provide copy-link fallback buttons for both IDEs.
12. Do not modify backend routes/tests for this first pass.
13. Do not modify extension core for this first pass.

Preferred file changes:
- Rename:
  codedock-web/components/rooms/open-in-vscode-button.tsx
  to:
  codedock-web/components/rooms/open-ide-button.tsx

- Update import in:
  codedock-web/components/rooms/room-details-page.tsx

- Add:
  codedock-web/lib/utils/editor-launch.ts

Suggested helper:
export type CodeDockEditorTarget = "vscode" | "antigravity";

export function buildCodeDockEditorLaunchUri(
  editor: CodeDockEditorTarget,
  launchToken: string,
  vscodeDeepLink?: string,
): string

Testing required:
- npm run build in codedock-web
- Room not ready: Open IDE disabled with existing reason
- Room ready: Open IDE enabled
- Cancel modal: no launch token created
- Choose VS Code: opens vscode:// link
- Choose Antigravity: opens antigravity:// link
- API failure: modal shows clear error
- Existing VS Code flow still works
PLAN

section "LOCAL VALIDATION COMMANDS TO RUN AFTER CHANGES"
cat >> "$OUT_FILE" <<'CMDS'
cd ~/Desktop/CodeDock/codedock-web
npm run build

cd ~/Desktop/CodeDock
git status --short
git diff -- codedock-web/components/rooms codedock-web/lib/utils codedock-web/lib/api/launch.ts codedock-web/hooks/use-launch.ts

Manual browser test:
1. Open room details.
2. Confirm button says Open IDE.
3. Confirm disabled state still works when launch_allowed is false.
4. Confirm modal opens.
5. Confirm VS Code path launches.
6. Confirm Antigravity path attempts to launch.
CMDS

echo "✅ Open IDE refactor context exported:"
echo "$OUT_FILE"
