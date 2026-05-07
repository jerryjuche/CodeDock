"use client";

import { openInVSCode, createEditorLaunch } from "@/lib/api/launch";
import { useAuth } from "@/hooks/use-auth";
import type { CodeDockEditorTarget } from "@/types/launch";

export function useLaunch(roomId: string) {
  const { token } = useAuth();

  async function openRoom() {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    const response = await openInVSCode(token, roomId);
    window.location.assign(response.deep_link);
  }

  return { openRoom };
}

export function useLaunchIDE(roomId: string) {
  const { token } = useAuth();

  async function launchIDE(editor: CodeDockEditorTarget): Promise<void> {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    const response = await createEditorLaunch(roomId, token, editor);
    window.location.assign(response.deep_link);
  }

  async function requestIDEDeepLink(
    editor: CodeDockEditorTarget,
  ): Promise<string> {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    const response = await createEditorLaunch(roomId, token, editor);
    return response.deep_link;
  }

  return { launchIDE, requestIDEDeepLink };
}
