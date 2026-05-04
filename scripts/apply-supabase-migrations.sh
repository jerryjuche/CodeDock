#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql is not installed."
  echo "Install it first:"
  echo "  sudo apt update && sudo apt install -y postgresql-client"
  exit 1
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "❌ SUPABASE_DB_URL is not set."
  echo
  echo "Set it first, example:"
  echo "  export SUPABASE_DB_URL='postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require'"
  exit 1
fi

MIGRATIONS=(
  "migration/001_create_extensions.sql"
  "migration/002_create_enums.sql"
  "migration/003_create_users.sql"
  "migration/004_create_trigger_function.sql"
  "migration/005_create_rooms.sql"
  "migration/006_create_room_members.sql"
  "migration/007_create_snapshots.sql"
  "migration/008_create_invite_tokens.sql"
  "migration/0002_phase1_control_plane.sql"
)

echo "==> Checking Supabase connection..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "select current_database(), current_user, now();"

echo
echo "==> Applying CodeDock migrations..."
for file in "${MIGRATIONS[@]}"; do
  full="$ROOT/$file"

  if [ ! -f "$full" ]; then
    echo "❌ Missing migration: $file"
    exit 1
  fi

  echo
  echo "------------------------------------------------------------"
  echo "Applying: $file"
  echo "------------------------------------------------------------"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$full"
done

echo
echo "==> Verifying expected CodeDock schema..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users',
    'rooms',
    'room_members',
    'snapshots',
    'invite_tokens',
    'room_invite_tokens',
    'room_launch_tokens'
  )
ORDER BY table_name;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'rooms'
  AND column_name IN (
    'slug',
    'owner_user_id',
    'source_type',
    'source_metadata',
    'primary_join_code',
    'updated_at'
  )
ORDER BY column_name;
SQL

echo
echo "✅ Supabase migrations completed."
