-- Set default for new rooms to inactive
ALTER TABLE rooms ALTER COLUMN is_active SET DEFAULT FALSE;

-- Ensure all existing empty rooms (or rooms that shouldn't be active yet) are inactive
-- Note: This is optional but good for consistency
-- UPDATE rooms SET is_active = FALSE WHERE id NOT IN (SELECT room_id FROM room_activities);
