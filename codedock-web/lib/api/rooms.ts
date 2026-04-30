import { apiRequest } from "./client";
import type { Room, RoomDetails, RoomPresence } from "@/types/room";

export function getRooms(token: string) {
  return apiRequest<Room[]>("/rooms", { token });
}

export function getRoom(token: string, roomId: string) {
  return apiRequest<Room>(`/rooms/${roomId}`, { token });
}

export function getRoomDetails(token: string, roomId: string) {
  return apiRequest<RoomDetails>(`/rooms/${roomId}/details`, { token });
}

export function getRoomPresence(token: string, roomId: string) {
  return apiRequest<RoomPresence>(`/rooms/${roomId}/presence`, { token });
}

export function createRoom(
  token: string,
  payload: {
    name: string;
    source_type: "local_workspace" | "github_repo";
    source_metadata?: Record<string, unknown>;
  },
) {
  return apiRequest<Room>("/rooms", {
    method: "POST",
    token,
    body: payload,
  });
}

export function resolveJoinCode(token: string, code: string) {
  return apiRequest<{
    room: Room;
    membership: {
      role: "host" | "editor";
      joined: boolean;
    };
  }>("/join-code/resolve", {
    method: "POST",
    token,
    body: { code },
  });
}

export function deleteRoom(token: string, roomId: string) {
  return apiRequest<{ success: boolean }>(`/rooms/${roomId}`, {
    method: "DELETE",
    token,
  });
}

export function bindRoomSource(
  token: string,
  roomId: string,
  workspaceLabel?: string,
) {
  return apiRequest<RoomDetails>(`/rooms/${roomId}/source/local/bind`, {
    method: "POST",
    token,
    body: { workspace_label: workspaceLabel },
  });
}