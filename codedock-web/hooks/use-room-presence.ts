"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getRoomPresence } from "@/lib/api/rooms";
import type { RoomPresence } from "@/types/room";

export function useRoomPresence(roomId: string) {
  const { token } = useAuth();

  const query = useQuery({
    queryKey: ["room-presence", roomId],
    queryFn: () => getRoomPresence(token!, roomId),
    enabled: !!token,
    staleTime: 10000, // Consider data fresh for 10 seconds
    refetchInterval: 15000, // Refetch every 15 seconds instead of 5
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
  });

  return {
    presence: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message || null,
    reload: query.refetch,
  };
}
