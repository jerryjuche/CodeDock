"use client";

import { useQuery } from "@tanstack/react-query";
import { getRoomDetails } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
import type { RoomDetails } from "@/types/room";

export function useRoomDetails(roomId: string) {
  const { token } = useAuth();

  const query = useQuery({
    queryKey: ["room-details", roomId],
    queryFn: () => getRoomDetails(token!, roomId),
    enabled: !!token,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds instead of 3
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
  });

  return {
    details: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message || null,
    reload: query.refetch,
  };
}
