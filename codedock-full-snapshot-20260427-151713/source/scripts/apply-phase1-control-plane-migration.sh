#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$(pwd)}"
MIGRATION_FILE="${2:-$PROJECT_ROOT/migration/0002_phase1_control_plane.sql}"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "ERROR: migration file not found: $MIGRATION_FILE" >&2
  exit 1
fi

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROJECT_ROOT/.env"
  set +a
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Applying migration with DATABASE_URL"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"
  echo "Migration applied successfully."
  exit 0
fi

: "${DB_HOST:?DB_HOST is required if DATABASE_URL is not set}"
: "${DB_PORT:?DB_PORT is required if DATABASE_URL is not set}"
: "${DB_USER:?DB_USER is required if DATABASE_URL is not set}"
: "${DB_PASSWORD:?DB_PASSWORD is required if DATABASE_URL is not set}"
: "${DB_NAME:?DB_NAME is required if DATABASE_URL is not set}"

DB_SSLMODE="${DB_SSLMODE:-require}"

export PGPASSWORD="$DB_PASSWORD"

echo "Applying migration with discrete DB_* environment variables"
psql \
  "host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME sslmode=$DB_SSLMODE" \
  -v ON_ERROR_STOP=1 \
  -f "$MIGRATION_FILE"

echo "Migration applied successfully."