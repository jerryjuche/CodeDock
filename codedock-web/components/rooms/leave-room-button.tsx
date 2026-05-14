"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { leaveRoom } from "@/lib/api/rooms";
import { Button } from "@/components/ui/button";

export default function LeaveRoomButton({
  roomId,
}: {
  roomId: string;
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
      console.log("Leaving room:", roomId);
      await leaveRoom(token, roomId);
      console.log("Leave room successful, redirecting...");
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Leave room failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to leave room. Please try again.",
      );
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="pt-4 border-t border-white/[0.04] space-y-3">
        <div className="rounded-xl border border-[rgb(239,102,46,0.2)] bg-[rgb(239,102,46,0.05)] px-4 py-3">
          <p className="text-xs leading-relaxed text-[rgb(239,102,46)]">
            Are you sure you want to leave? You will need a new invite to rejoin this session.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={() => void onConfirm()}
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Leaving..." : "Yes, Leave"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
        {error && <p className="text-[10px] text-center text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-white/[0.04]">
      {error && <p className="mb-2 text-[10px] text-center text-rose-400 font-medium">{error}</p>}
      <Button
        variant="outline"
        onClick={() => setConfirming(true)}
        className="w-full border-orange-500/20 text-orange-400 hover:bg-orange-500/10"
      >
        Leave Session
      </Button>
      <p className="mt-3 text-[10px] text-center text-slate-500 font-medium">
        Your access will be revoked immediately.
      </p>
    </div>
  );
}
