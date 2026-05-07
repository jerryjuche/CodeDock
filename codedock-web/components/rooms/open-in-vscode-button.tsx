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
  isHost,
}: {
  roomId: string;
  launchAllowed: boolean;
  launchReason?: string;
  isHost?: boolean;
}) {
  const { openRoom } = useLaunch(roomId);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const disabled = loading || (!isHost && !launchAllowed);

  async function handleOpen() {
    setError(null);
    setLoading(true);
    try {
      await openRoom();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to open in VS Code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(36,166,242,0.12)] border border-[rgba(36,166,242,0.2)]">
          {/* VS Code icon approximation */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4.5 w-4.5 h-[18px] w-[18px] text-[rgb(36,166,242)]"
            aria-hidden="true"
          >
            <path
              d="M17 3L7 12.5L17 22M7 3l10 9.5L7 22"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">
            Open in VS Code
          </h3>
          <p className="mt-0.5 text-sm text-[rgb(158,183,211)]">
            Generate a one-time launch link and continue the session inside VS
            Code.
          </p>
        </div>
      </div>

      {/* Readiness warning */}
      {/* Readiness warning (Only show for guests, or if host really can't launch) */}
      {!launchAllowed && launchReason && !isHost ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[rgba(249,145,53,0.2)] bg-[rgba(249,145,53,0.07)] px-4 py-3.5">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-[rgb(249,145,53)]"
            aria-hidden="true"
          >
            <path
              d="M8 2L14.928 14H1.072L8 2Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M8 6v4M8 11.5h.01"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-sm leading-relaxed text-[rgb(249,145,53)]">
            {launchReason}
          </p>
        </div>
      ) : null}

      {isHost && !launchAllowed && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[rgba(36,166,242,0.2)] bg-[rgba(36,166,242,0.05)] px-4 py-3.5">
          <p className="text-sm leading-relaxed text-[rgb(36,166,242)]">
            <strong>Host Note:</strong> You can launch now to set up the
            workspace. Guests will be able to join once you have opened the
            project in VS Code.
          </p>
        </div>
      )}

      {/* Launch error */}
      {error ? (
        <div className="mt-4 flex items-start gap-3 rounded-[12px] border border-[rgba(255,90,107,0.25)] bg-[rgba(255,90,107,0.08)] px-4 py-3">
          <p className="text-sm text-[rgb(255,160,170)]">{error}</p>
        </div>
      ) : null}

      {/* Launch button */}
      <div className="mt-5">
        <Button disabled={disabled} onClick={() => void handleOpen()}>
          {loading ? "Opening…" : "Open in VS Code"}
        </Button>
      </div>
    </Card>
  );
}
