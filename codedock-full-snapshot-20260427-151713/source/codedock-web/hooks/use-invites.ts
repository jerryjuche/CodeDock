"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createRoomInvite,
  getRoomInvites,
  revokeRoomInvite,
} from "@/lib/api/invites";
import { useAuth } from "@/hooks/use-auth";
import type { RoomInviteToken } from "@/types/invite";

export function useInvites(roomId: string) {
  const { token, hydrated } = useAuth();
  const [invites, setInvites] = useState<RoomInviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hydrated) return;

    if (!token) {
      setError("You are not logged in.");
      setLoading(false);
      return;
    }

    try {
      const response = await getRoomInvites(token, roomId);
      setInvites(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, [roomId, token, hydrated]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvite(payload: {
    expires_in_hours?: number;
    max_uses?: number;
  }) {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    await createRoomInvite(token, roomId, payload);
    await load();
  }

  async function revokeInvite(inviteId: string) {
    if (!token) {
      throw new Error("You are not logged in.");
    }

    await revokeRoomInvite(token, roomId, inviteId);
    await load();
  }

  return {
    invites,
    loading,
    error,
    createInvite,
    revokeInvite,
    reload: load,
  };
}