SELECT
    id,
    name,
    slug,
    owner_user_id,
    source_type,
    primary_join_code
FROM rooms
ORDER BY created_at DESC;

SELECT
    id,
    room_id,
    code,
    expires_at,
    max_uses,
    uses_count,
    is_revoked
FROM room_invite_tokens
ORDER BY created_at DESC;

SELECT
    id,
    room_id,
    user_id,
    intended_role,
    expires_at,
    used_at
FROM room_launch_tokens
ORDER BY created_at DESC;