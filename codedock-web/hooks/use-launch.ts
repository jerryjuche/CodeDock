"use client";

import { useState } from "react";
import { createEditorLaunch } from "@/lib/api/launch";
import { useAuth } from "@/hooks/use-auth";
import type { LaunchTokenResponse, CodeDockEditorTarget } from "@/types/launch";

export function useLaunch(roomId: string) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  async function openRoom() {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    setLoading(true);
    try {
      const response = await createEditorLaunch(roomId, token, "vscode");
      window.location.assign(response.deep_link);
    } finally {
      setLoading(false);
    }
  }

  return { openRoom, loading };
}

export function useLaunchIDE(roomId: string) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  async function launchIDE(
    editor: CodeDockEditorTarget,
    copyOnly: boolean = false,
  ): Promise<LaunchTokenResponse> {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    setLoading(true);
    try {
      const response = await createEditorLaunch(roomId, token, editor);

      if (!copyOnly) {
        window.location.assign(response.deep_link);
      }

      return response;
    } finally {
      setLoading(false);
    }
  }

  return { launchIDE, loading };
}
