BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION codedock_slugify(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    value TEXT;
BEGIN
    value := lower(coalesce(input_text, ''));
    value := regexp_replace(value, '[^a-z0-9]+', '-', 'g');
    value := regexp_replace(value, '-{2,}', '-', 'g');
    value := trim(both '-' from value);

    IF value = '' THEN
        value := 'room';
    END IF;

    RETURN value;
END;
$$;

CREATE OR REPLACE FUNCTION codedock_random_code(code_length INTEGER DEFAULT 6)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
    alphabet_len INTEGER := length(alphabet);
    result TEXT := '';
    idx INTEGER;
BEGIN
    IF code_length <= 0 THEN
        RAISE EXCEPTION 'code_length must be > 0';
    END IF;

    FOR i IN 1..code_length LOOP
        idx := 1 + floor(random() * alphabet_len)::INTEGER;
        result := result || substr(alphabet, idx, 1);
    END LOOP;

    RETURN result;
END;
$$;

ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS slug TEXT,
    ADD COLUMN IF NOT EXISTS owner_user_id UUID,
    ADD COLUMN IF NOT EXISTS source_type TEXT,
    ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS primary_join_code TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE rooms
SET owner_user_id = created_by
WHERE owner_user_id IS NULL
  AND created_by IS NOT NULL;

UPDATE rooms
SET source_type = 'local_workspace'
WHERE source_type IS NULL
   OR btrim(source_type) = '';

WITH base AS (
    SELECT
        id,
        CASE
            WHEN name IS NULL OR btrim(name) = '' THEN 'room'
            ELSE codedock_slugify(name)
        END AS base_slug
    FROM rooms
),
ranked AS (
    SELECT
        id,
        base_slug,
        row_number() OVER (PARTITION BY base_slug ORDER BY id) AS rn
    FROM base
)
UPDATE rooms r
SET slug = CASE
    WHEN ranked.rn = 1 THEN ranked.base_slug
    ELSE ranked.base_slug || '-' || ranked.rn
END
FROM ranked
WHERE r.id = ranked.id
  AND (r.slug IS NULL OR btrim(r.slug) = '');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rooms_owner_user_id_fkey'
    ) THEN
        ALTER TABLE rooms
            ADD CONSTRAINT rooms_owner_user_id_fkey
            FOREIGN KEY (owner_user_id)
            REFERENCES users(id)
            ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS room_invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NULL,
    max_uses INTEGER NULL CHECK (max_uses IS NULL OR max_uses > 0),
    uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_invite_tokens_room_id
    ON room_invite_tokens(room_id);

CREATE INDEX IF NOT EXISTS idx_room_invite_tokens_code
    ON room_invite_tokens(code);

CREATE TABLE IF NOT EXISTS room_launch_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intended_role TEXT NOT NULL CHECK (intended_role IN ('host', 'editor')),
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_launch_tokens_room_id
    ON room_launch_tokens(room_id);

CREATE INDEX IF NOT EXISTS idx_room_launch_tokens_user_id
    ON room_launch_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_room_launch_tokens_expires_at
    ON room_launch_tokens(expires_at);

DO $$
DECLARE
    rec RECORD;
    candidate TEXT;
BEGIN
    FOR rec IN
        SELECT id
        FROM rooms
        WHERE primary_join_code IS NULL OR btrim(primary_join_code) = ''
    LOOP
        LOOP
            candidate := codedock_random_code(6);

            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM rooms WHERE primary_join_code = candidate
            )
            AND NOT EXISTS (
                SELECT 1 FROM room_invite_tokens WHERE code = candidate
            );
        END LOOP;

        UPDATE rooms
        SET primary_join_code = candidate
        WHERE id = rec.id;
    END LOOP;
END;
$$;

INSERT INTO room_members (room_id, user_id, role)
SELECT r.id, r.owner_user_id, 'host'
FROM rooms r
WHERE r.owner_user_id IS NOT NULL
ON CONFLICT (room_id, user_id) DO NOTHING;

ALTER TABLE rooms
    ALTER COLUMN slug SET NOT NULL,
    ALTER COLUMN owner_user_id SET NOT NULL,
    ALTER COLUMN source_type SET NOT NULL,
    ALTER COLUMN primary_join_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_primary_join_code
    ON rooms(primary_join_code);

CREATE INDEX IF NOT EXISTS idx_rooms_owner_user_id
    ON rooms(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_rooms_slug
    ON rooms(slug);

COMMIT;
