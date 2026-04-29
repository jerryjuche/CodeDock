// components/rooms/open-in-vscode-button.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLaunch } from "@/hooks/use-launch";

export default function OpenInVSCodeButton({
  roomId,
  launchAllowed,
  launchReason,
}: {
  roomId: string;
  launchAllowed: boolean;
  launchReason?: string;
}) {
  const { openRoom, loading } = useLaunch(roomId);
  const [error, setError] = useState<string | null>(null);
  const disabled = loading || !launchAllowed;

  async function handleOpen() {
    setError(null);
    try {
      await openRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open in VS Code. Please try again.");
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-white">Open in VS Code</h3>
      <p className="mt-2 text-sm text-[rgb(158,183,211)]">
        Generate a one-time launch link and continue the room inside VS Code.
      </p>

      {!launchAllowed && launchReason ? (
        <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/10 p-3 text-sm text-amber-100">
          {launchReason}
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[12px] border border-[rgba(255,90,107,0.3)] bg-[rgba(255,90,107,0.08)] px-4 py-3 text-sm text-[rgb(255,160,170)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5">
        <Button disabled={disabled} onClick={() => void handleOpen()}>
          {loading ? "Opening..." : "Open in VS Code"}
        </Button>
      </div>
    </Card>
  );
}