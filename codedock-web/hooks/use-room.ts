"use client";

import { useEffect, useState } from "react";
import { getRoom } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
import type { Room } from "@/types/room";

export function useRoom(roomId: string) {
  const { token, hydrated } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!hydrated) return;

      if (!token) {
        setLoading(false);
        setError("You are not logged in.");
        return;
      }

      try {
        const response = await getRoom(token, roomId);
        setRoom(response);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load room");
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, [token, hydrated, roomId]);

  return { room, loading, error };
}