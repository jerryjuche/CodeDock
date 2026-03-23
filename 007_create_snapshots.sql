CREATE TABLE
    snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        room_id UUID NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        yjs_state BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        UNIQUE (room_id, file_path)
    );