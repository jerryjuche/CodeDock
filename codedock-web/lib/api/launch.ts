import { apiRequest } from "./client";
import type { LaunchTokenResponse, CodeDockEditorTarget } from "@/types/launch";

export function openInVSCode(token: string, roomId: string) {
  return apiRequest<LaunchTokenResponse>(`/rooms/${roomId}/open-in-vscode`, {
    method: "POST",
    token,
    body: {},
  });
}

export async function createEditorLaunch(
  roomId: string,
  token: string,
  editor: CodeDockEditorTarget,
): Promise<LaunchTokenResponse> {
  return apiRequest<LaunchTokenResponse>(`/rooms/${roomId}/open-ide`, {
    method: "POST",
    token,
    body: { editor },
  });
}
