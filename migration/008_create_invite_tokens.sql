CREATE TABLE
    invite_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        room_id UUID NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        created_by UUID NOT NULL REFERENCES users (id),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );