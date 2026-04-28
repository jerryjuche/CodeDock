"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRoom } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
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

  async function handleDelete() {
    if (!token) {
      window.alert("You are not logged in.");
      return;
    }

    const confirmed = window.confirm(
      `Delete room "${roomName}"? This will hide the room and invalidate future launches.`,
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      await deleteRoom(token, roomId);
      router.replace("/dashboard");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
      <p className="mt-2 text-sm text-zinc-400">
        Delete this room and remove it from active room listings.
      </p>

      <div className="mt-4">
        <Button disabled={loading} variant="danger" onClick={handleDelete}>
          {loading ? "Deleting..." : "Delete Room"}
        </Button>
      </div>
    </Card>
  );
}