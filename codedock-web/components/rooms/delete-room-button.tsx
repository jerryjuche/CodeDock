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

  async function onDelete() {
    const confirmed = window.confirm(
      `Delete "${roomName}"? This will end the session for all users.`,
    );

    if (!confirmed) return;
    if (!token) {
      window.alert("You are not logged in.");
      return;
    }

    setLoading(true);
    try {
      await deleteRoom(token, roomId);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete room");
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

      <div className="mt-5">
        <Button variant="destructive" onClick={onDelete} disabled={loading}>
          {loading ? "Deleting..." : "Delete room"}
        </Button>
      </div>
    </Card>
  );
}