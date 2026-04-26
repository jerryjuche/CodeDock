export type RoomInviteToken = {
  id: string;
  room_id: string;
  code: string;
  created_by_user_id: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  is_revoked: boolean;
  created_at: string;
};
