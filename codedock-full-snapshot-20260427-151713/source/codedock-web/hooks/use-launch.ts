"use client";

import { useState } from "react";
import { openInVSCode } from "@/lib/api/launch";
import { useAuth } from "@/hooks/use-auth";

export function useLaunch(roomId: string) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  async function openRoom() {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    setLoading(true);
    try {
      const response = await openInVSCode(token, roomId);
      window.location.assign(response.deep_link);
    } finally {
      setLoading(false);
    }
  }

  return { openRoom, loading };
}