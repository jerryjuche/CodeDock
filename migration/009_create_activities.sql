CREATE TABLE
    activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        room_id UUID NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        file_path TEXT,
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

CREATE INDEX idx_activities_room_user_created
    ON activities (room_id, user_id, created_at DESC);

CREATE INDEX idx_activities_room_created
    ON activities (room_id, created_at DESC);
