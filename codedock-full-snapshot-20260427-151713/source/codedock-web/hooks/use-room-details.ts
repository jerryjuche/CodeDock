"use client";

import { useEffect, useState } from "react";
import { getRoomDetails } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
import type { RoomDetails } from "@/types/room";

export function useRoomDetails(roomId: string) {
  const { token, hydrated } = useAuth();
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) {
      setLoading(false);
      setError("You are not logged in.");
      return;
    }

    try {
      const response = await getRoomDetails(token, roomId);
      setDetails(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load room details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, roomId, token]);

  return {
    details,
    loading,
    error,
    reload: load,
  };
}