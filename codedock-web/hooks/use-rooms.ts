"use client";

import { useEffect, useState } from "react";
import { getRooms } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
import type { Room } from "@/types/room";

export function useRooms() {
  const { token, hydrated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
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
        const response = await getRooms(token);
        setRooms(response);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load rooms");
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, [token, hydrated]);

  return { rooms, loading, error };
}