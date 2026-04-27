#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

usage() {
  cat <<'EOF'
Usage:
  bash scripts/collect_codedock_full_snapshot.sh [options]

Options:
  --with-go-checks           Run Go test/build commands and capture output
  --host-log /path/to/log    Copy host log into the bundle
  --guest-log /path/to/log   Copy guest log into the bundle
  -h, --help                 Show help

What it generates:
  codedock-full-snapshot-YYYYMMDD-HHMMSS/
    source/                  copied source/config/test files
    logs/                    host/guest logs or placeholders
    meta/                    repo tree, git state, file manifests, indexes
    reports/                 combined code dump + summaries + optional test/build reports

This script captures what exists in the repo so debugging is grounded in the real codebase.
EOF
}

WITH_GO_CHECKS=0
HOST_LOG=""
GUEST_LOG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-go-checks)
      WITH_GO_CHECKS=1
      shift
      ;;
    --host-log)
      [[ $# -ge 2 ]] || { echo "Missing value for --host-log" >&2; exit 1; }
      HOST_LOG="$2"
      shift 2
      ;;
    --guest-log)
      [[ $# -ge 2 ]] || { echo "Missing value for --guest-log" >&2; exit 1; }
      GUEST_LOG="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
else
  REPO_ROOT="$(pwd)"
fi

cd "$REPO_ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for this script." >&2
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$REPO_ROOT/codedock-full-snapshot-$TS"
SRC_DIR="$OUT_DIR/source"
LOG_DIR="$OUT_DIR/logs"
META_DIR="$OUT_DIR/meta"
REPORT_DIR="$OUT_DIR/reports"

mkdir -p "$SRC_DIR" "$LOG_DIR" "$META_DIR" "$REPORT_DIR"

echo "Creating CodeDock snapshot in:"
echo "  $OUT_DIR"
echo

python3 - "$REPO_ROOT" "$SRC_DIR" "$META_DIR" "$REPORT_DIR" <<'PY'
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sys
from collections import Counter, defaultdict
from pathlib import Path

repo_root = Path(sys.argv[1]).resolve()
src_dir = Path(sys.argv[2]).resolve()
meta_dir = Path(sys.argv[3]).resolve()
report_dir = Path(sys.argv[4]).resolve()

INCLUDE_TOP_LEVEL_DIRS = {
    "internal",
    "extension",
    "codedock-web",
    "migration",
    "scripts",
    "test_server",
}

ROOT_PRIORITY_FILES = {
    "main.go",
    "go.mod",
    "go.sum",
    "README.md",
    ".env.example",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Makefile",
    "package.json",
    "pnpm-workspace.yaml",
}

ALWAYS_INCLUDE_FILE_NAMES = {
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "next.config.js",
    "next.config.mjs",
    "tailwind.config.ts",
    "tailwind.config.js",
    "postcss.config.js",
    "postcss.config.mjs",
    "esbuild.js",
    "vite.config.ts",
    "vite.config.js",
    ".env.example",
}

TEXT_EXTENSIONS = {
    ".go",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".md",
    ".sql",
    ".yml",
    ".yaml",
    ".sh",
    ".css",
    ".scss",
    ".html",
    ".txt",
    ".toml",
    ".env",
    ".example",
}

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "out",
    "coverage",
    ".next",
    ".turbo",
    ".cache",
    ".idea",
    ".vscode",
    "vendor",
    "tmp",
    "temp",
    "bin",
    "target",
}

EXCLUDE_FILE_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    ".pdf", ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z",
    ".woff", ".woff2", ".ttf", ".eot",
    ".exe", ".dll", ".so", ".dylib",
    ".mp3", ".mp4", ".mov", ".avi",
}

MAX_FILE_BYTES = 900_000

SEARCH_PATTERNS = {
    "routes_and_handlers": re.compile(
        r"/auth|/rooms|join-code|invites|launch|presence|details|source/local/bind|open-in-vscode",
        re.IGNORECASE,
    ),
    "sync_and_protocol": re.compile(
        r"0x0[1-8]|workspace manifest|file bootstrap|hydration|awareness|sync|chat",
        re.IGNORECASE,
    ),
    "readiness_and_source_state": re.compile(
        r"source_state|launch_allowed|ready|local_workspace|github_repo|source_type|source_metadata",
        re.IGNORECASE,
    ),
    "membership_and_roles": re.compile(
        r"owner|host|guest|editor|viewer|membership|presence|connected",
        re.IGNORECASE,
    ),
}

def rel_parts(path: Path) -> tuple[str, ...]:
    return path.relative_to(repo_root).parts

def is_excluded(path: Path) -> bool:
    parts = rel_parts(path)
    return any(part in EXCLUDE_DIRS for part in parts)

def should_include(path: Path) -> bool:
    if not path.is_file():
        return False
    if is_excluded(path):
        return False
    suffix = path.suffix.lower()
    name = path.name
    rel = path.relative_to(repo_root)
    parts = rel.parts

    if suffix in EXCLUDE_FILE_SUFFIXES:
        return False

    try:
        size = path.stat().st_size
    except OSError:
        return False

    if size > MAX_FILE_BYTES:
        return False

    if len(parts) == 1:
        return name in ROOT_PRIORITY_FILES or suffix in TEXT_EXTENSIONS

    top = parts[0]
    if top not in INCLUDE_TOP_LEVEL_DIRS:
        return False

    return suffix in TEXT_EXTENSIONS or name in ALWAYS_INCLUDE_FILE_NAMES or rel.as_posix() in ROOT_PRIORITY_FILES

def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def safe_read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="replace")

repo_all_paths: list[str] = []
included_paths: list[Path] = []

for root, dirs, files in os.walk(repo_root):
    root_path = Path(root)
    dirs[:] = sorted([d for d in dirs if d not in EXCLUDE_DIRS])
    for file_name in sorted(files):
        path = root_path / file_name
        rel = path.relative_to(repo_root).as_posix()
        repo_all_paths.append(rel)
        if should_include(path):
            included_paths.append(path)

included_paths = sorted(set(included_paths), key=lambda p: p.relative_to(repo_root).as_posix())

(repo_root / ".").resolve()

(meta_dir / "repo-tree.txt").write_text("\n".join(sorted(repo_all_paths)) + "\n", encoding="utf-8")
(meta_dir / "included-file-list.txt").write_text(
    "\n".join([p.relative_to(repo_root).as_posix() for p in included_paths]) + "\n",
    encoding="utf-8",
)

combined = report_dir / "COMBINED_SOURCE_DUMP.txt"
manifest_json = meta_dir / "file-manifest.json"
manifest_md = report_dir / "FILE_MANIFEST.md"
module_summary_md = report_dir / "MODULE_SUMMARY.md"

manifest_records = []
module_counts = Counter()
top_level_counts = Counter()
search_hits: dict[str, list[str]] = defaultdict(list)

with combined.open("w", encoding="utf-8") as combined_f:
    combined_f.write("# CodeDock Combined Source Dump\n\n")
    for path in included_paths:
        rel = path.relative_to(repo_root).as_posix()
        dest = src_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)

        text = safe_read_text(path)
        line_count = text.count("\n") + (0 if text.endswith("\n") or len(text) == 0 else 1)
        size_bytes = path.stat().st_size
        digest = sha256_of(path)
        top = rel.split("/", 1)[0]
        top_level_counts[top] += 1

        if top == "internal":
            module = rel.split("/", 2)[1] if len(rel.split("/", 2)) > 1 else "internal"
            module_counts[f"internal/{module}"] += 1
        elif top in {"extension", "codedock-web"}:
            module_counts[top] += 1
        else:
            module_counts[top] += 1

        manifest_records.append({
            "path": rel,
            "bytes": size_bytes,
            "lines": line_count,
            "sha256": digest,
        })

        combined_f.write("=" * 100 + "\n")
        combined_f.write(f"FILE: {rel}\n")
        combined_f.write("=" * 100 + "\n")
        combined_f.write(text)
        if not text.endswith("\n"):
            combined_f.write("\n")
        combined_f.write("\n\n")

        lines = text.splitlines()
        for index_name, pattern in SEARCH_PATTERNS.items():
            for lineno, line in enumerate(lines, start=1):
                if pattern.search(line):
                    search_hits[index_name].append(f"{rel}:{lineno}: {line}")

manifest_json.write_text(json.dumps(manifest_records, indent=2), encoding="utf-8")

with manifest_md.open("w", encoding="utf-8") as f:
    f.write("# File Manifest\n\n")
    f.write(f"Included files: **{len(manifest_records)}**\n\n")
    f.write("| Path | Lines | Bytes | SHA256 |\n")
    f.write("|---|---:|---:|---|\n")
    for record in manifest_records:
        f.write(
            f"| `{record['path']}` | {record['lines']} | {record['bytes']} | `{record['sha256']}` |\n"
        )

with module_summary_md.open("w", encoding="utf-8") as f:
    f.write("# Module Summary\n\n")
    f.write("## Top-level included file counts\n\n")
    for key, value in sorted(top_level_counts.items()):
        f.write(f"- **{key}**: {value}\n")
    f.write("\n## Module bucket counts\n\n")
    for key, value in sorted(module_counts.items()):
        f.write(f"- **{key}**: {value}\n")

for index_name, hits in search_hits.items():
    out_path = meta_dir / f"{index_name}.txt"
    out_path.write_text("\n".join(hits) + ("\n" if hits else ""), encoding="utf-8")

overview_md = report_dir / "SNAPSHOT_OVERVIEW.md"
overview_md.write_text(
    "\n".join(
        [
            "# CodeDock Snapshot Overview",
            "",
            f"- Repository root: `{repo_root}`",
            f"- Included source/config/test files: **{len(manifest_records)}**",
            f"- Combined source dump: `reports/COMBINED_SOURCE_DUMP.txt`",
            f"- File manifest JSON: `meta/file-manifest.json`",
            f"- Repo tree: `meta/repo-tree.txt`",
            "",
            "## Included top-level areas",
            "",
            "- internal/",
            "- extension/",
            "- codedock-web/",
            "- migration/",
            "- scripts/",
            "- test_server/",
            "- root config/source files",
            "",
            "## Focus indexes generated",
            "",
            "- routes_and_handlers",
            "- sync_and_protocol",
            "- readiness_and_source_state",
            "- membership_and_roles",
            "",
            "This snapshot reflects code that currently exists in the repository. It is intended for precise debugging and integration analysis.",
            "",
        ]
    ),
    encoding="utf-8",
)
PY

echo "Writing git metadata..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git rev-parse HEAD > "$META_DIR/git-head.txt" 2>/dev/null || true
  git branch --show-current > "$META_DIR/git-branch.txt" 2>/dev/null || true
  git status --short > "$META_DIR/git-status.txt" 2>/dev/null || true
  git log --oneline -n 30 > "$META_DIR/git-log-last-30.txt" 2>/dev/null || true
  git diff --stat > "$META_DIR/git-diff-stat.txt" 2>/dev/null || true
  git diff > "$META_DIR/git-diff.patch" 2>/dev/null || true
else
  echo "Not a git repository." > "$META_DIR/git-status.txt"
fi

copy_log_or_placeholder() {
  local provided_path="$1"
  local output_path="$2"
  local label="$3"

  if [[ -n "$provided_path" && -f "$provided_path" ]]; then
    cp "$provided_path" "$output_path"
  else
    cat > "$output_path" <<EOF
Paste the ${label} log here from one focused run.

Include:
- startup / activation
- websocket connect/join
- room creation/join lines
- readiness / details / presence calls if relevant
- workspace manifest / bootstrap / hydration lines
- final failure or incorrect behavior
EOF
  fi
}

copy_log_or_placeholder "$HOST_LOG" "$LOG_DIR/host.log.txt" "host"
copy_log_or_placeholder "$GUEST_LOG" "$LOG_DIR/guest.log.txt" "guest"

if [[ "$WITH_GO_CHECKS" -eq 1 ]]; then
  echo "Running Go checks..."
  {
    echo "\$ go test ./internal/handlers -v -count=1"
    go test ./internal/handlers -v -count=1
  } > "$REPORT_DIR/go-test-internal-handlers.txt" 2>&1 || true

  {
    echo "\$ go test ./... -count=1"
    go test ./... -count=1
  } > "$REPORT_DIR/go-test-all.txt" 2>&1 || true

  {
    echo "\$ go build ./..."
    go build ./...
  } > "$REPORT_DIR/go-build.txt" 2>&1 || true
else
  cat > "$REPORT_DIR/go-checks-skipped.txt" <<'EOF'
Go checks were skipped.

Run this script with:
  --with-go-checks

to include:
- go test ./internal/handlers -v -count=1
- go test ./... -count=1
- go build ./...
EOF
fi

cat > "$OUT_DIR/UPLOAD_ME_FIRST.txt" <<'EOF'
Upload one of these back to ChatGPT:

Preferred:
1. the whole .tar.gz archive generated beside this folder

Good alternative:
1. reports/COMBINED_SOURCE_DUMP.txt
2. reports/SNAPSHOT_OVERVIEW.md
3. reports/MODULE_SUMMARY.md
4. meta/repo-tree.txt
5. meta/git-status.txt
6. meta/git-diff.patch
7. logs/host.log.txt
8. logs/guest.log.txt
9. reports/go-test-all.txt (if go checks were enabled)

This bundle captures the actual integrated code and structure so debugging can be done against the real repository state.
EOF

ARCHIVE_PATH="$REPO_ROOT/$(basename "$OUT_DIR").tar.gz"
if command -v tar >/dev/null 2>&1; then
  tar -czf "$ARCHIVE_PATH" -C "$REPO_ROOT" "$(basename "$OUT_DIR")"
fi

echo
echo "Snapshot complete."
echo "Folder : $OUT_DIR"
if [[ -f "$ARCHIVE_PATH" ]]; then
  echo "Archive: $ARCHIVE_PATH"
fi
echo
echo "Upload the archive, or upload the files listed in:"
echo "  $OUT_DIR/UPLOAD_ME_FIRST.txt"