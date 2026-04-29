// components/rooms/delete-room-button.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { deleteRoom } from "@/lib/api/rooms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DeleteRoomButton({
  roomId,
  roomName,
}: {
  roomId: string;
  roomName: string;
}) {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (!token) {
      setError("You are not logged in.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await deleteRoom(token, roomId);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete room. Please try again.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-white">Danger zone</h3>
      <p className="mt-2 text-sm text-[rgb(158,183,211)]">
        Deleting a room ends the session and removes future access through the control plane.
      </p>

      {error ? (
        <p className="mt-4 rounded-[12px] border border-[rgba(255,90,107,0.3)] bg-[rgba(255,90,107,0.08)] px-4 py-3 text-sm text-[rgb(255,160,170)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5">
        {confirming ? (
          <div className="space-y-3">
            <p className="rounded-[12px] border border-[rgba(255,90,107,0.25)] bg-[rgba(255,90,107,0.08)] px-4 py-3 text-sm text-[rgb(255,160,170)]">
              This will permanently delete <strong className="text-white">{roomName}</strong> and end all active sessions. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Yes, delete room"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="destructive"
            onClick={() => setConfirming(true)}
            disabled={loading}
          >
            Delete room
          </Button>
        )}
      </div>
    </Card>
  );
}