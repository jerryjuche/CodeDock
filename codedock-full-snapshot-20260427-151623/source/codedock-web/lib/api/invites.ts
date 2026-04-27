import { apiRequest } from "./client";
import type { RoomInviteToken } from "@/types/invite";

export function getRoomInvites(token: string, roomId: string) {
  return apiRequest<RoomInviteToken[]>(`/rooms/${roomId}/invites`, { token });
}

export function createRoomInvite(
  token: string,
  roomId: string,
  payload: {
    expires_in_hours?: number;
    max_uses?: number;
  },
) {
  return apiRequest<RoomInviteToken>(`/rooms/${roomId}/invites`, {
    method: "POST",
    token,
    body: payload
  });
}

export function revokeRoomInvite(
  token: string,
  roomId: string,
  inviteId: string,
) {
  return apiRequest<{ success: boolean }>(
    `/rooms/${roomId}/invites/${inviteId}/revoke`,
    {
      method: "POST",
      token
    },
  );
}
