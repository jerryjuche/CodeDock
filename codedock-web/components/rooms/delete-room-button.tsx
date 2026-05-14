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
      window.location.href = "/dashboard";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete room. Please try again.",
      );
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-[rgba(249,145,53,0.15)]">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[rgba(249,145,53,0.12)]">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-3.5 w-3.5 text-[rgb(249,145,53)]"
            aria-hidden="true"
          >
            <path
              d="M2 4h12M6 4V2h4v2M7 7v5M9 7v5M3 4l1 9h8l1-9"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h3 className="text-base font-semibold text-white">Danger zone</h3>
      </div>
      <p className="mt-2 text-sm text-[rgb(158,183,211)]">
        Permanently ends the session and removes all access through the control
        plane.
      </p>

      {/* Error */}
      {error ? (
        <div className="mt-4 rounded-[12px] border border-[rgba(249,145,53,0.25)] bg-[rgba(249,145,53,0.08)] px-4 py-3">
          <p className="text-sm text-[rgb(249,145,53)]">{error}</p>
        </div>
      ) : null}

      <div className="mt-5">
        {confirming ? (
          <div className="space-y-3">
            {/* Confirmation warning */}
            <div className="rounded-[12px] border border-[rgba(249,145,53,0.25)] bg-[rgba(249,145,53,0.08)] px-4 py-3">
              <p className="text-sm leading-relaxed text-[rgb(249,145,53)]">
                This will permanently delete{" "}
                <strong className="font-semibold text-white">
                  {roomName}
                </strong>{" "}
                and end all active sessions. This cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={() => void onConfirm()}
                disabled={loading}
              >
                {loading ? "Deleting…" : "Yes, delete room"}
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