import { apiRequest } from "./client";
import type { LaunchTokenResponse } from "@/types/launch";

export function openInVSCode(token: string, roomId: string) {
  return apiRequest<LaunchTokenResponse>(`/rooms/${roomId}/open-in-vscode`, {
    method: "POST",
    token,
    body: {}
  });
}
