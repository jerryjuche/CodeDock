import { apiRequest } from "./client";
import type { Room } from "@/types/room";

export function getRooms(token: string) {
  return apiRequest<Room[]>("/rooms", { token });
}

export function getRoom(token: string, roomId: string) {
  return apiRequest<Room>(`/rooms/${roomId}`, { token });
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
    body: payload
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
    body: { code }
  });
}
