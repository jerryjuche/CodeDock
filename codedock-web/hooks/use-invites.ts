"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRoomInvite,
  getRoomInvites,
  revokeRoomInvite,
} from "@/lib/api/invites";
import { useAuth } from "@/hooks/use-auth";
import type { RoomInviteToken } from "@/types/invite";

export function useInvites(roomId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["room-invites", roomId],
    queryFn: () => getRoomInvites(token!, roomId),
    enabled: !!token,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  const createMutation = useMutation({
    mutationFn: (payload: { expires_in_hours?: number; max_uses?: number }) =>
      createRoomInvite(token!, roomId, payload),
    onSuccess: () => {
      // Invalidate and refetch invites
      queryClient.invalidateQueries({ queryKey: ["room-invites", roomId] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) =>
      revokeRoomInvite(token!, roomId, inviteId),
    onSuccess: () => {
      // Invalidate and refetch invites
      queryClient.invalidateQueries({ queryKey: ["room-invites", roomId] });
    },
  });

  return {
    invites: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    createInvite: createMutation.mutateAsync,
    revokeInvite: revokeMutation.mutateAsync,
  };
}
