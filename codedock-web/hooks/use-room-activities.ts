"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getRoomActivities } from "@/lib/api/rooms";

export function useRoomActivities(roomId: string) {
  const { token } = useAuth();

  const query = useQuery({
    queryKey: ["room-activities", roomId],
    queryFn: () => getRoomActivities(token!, roomId),
    enabled: !!token,
    staleTime: 5000, // Consider data fresh for 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds to get new edits
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
  });

  return {
    activities: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message || null,
    reload: query.refetch,
  };
}
