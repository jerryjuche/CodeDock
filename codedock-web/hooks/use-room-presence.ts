"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getRoomPresence } from "@/lib/api/rooms";
import type { RoomPresence } from "@/types/room";

export function useRoomPresence(roomId: string) {
  const { token, hydrated } = useAuth();
  const [presence, setPresence] = useState<RoomPresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hydrated) return;

    if (!token) {
      setLoading(false);
      setError("You are not logged in.");
      return;
    }

    try {
      const response = await getRoomPresence(token, roomId);
      setPresence(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load presence");
    } finally {
      setLoading(false);
    }
  }, [hydrated, token, roomId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [load]);

  return {
    presence,
    loading,
    error,
    reload: load,
  };
}