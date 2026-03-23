CREATE TABLE
    room_members (
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        room_id UUID NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
        role room_role NOT NULL DEFAULT 'editor',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        PRIMARY KEY (user_id, room_id)
    );

CREATE INDEX idx_room_members_room_id ON room_members (room_id);

CREATE INDEX idx_room_members_user_id ON room_members (user_id);