"use client";

import { useLaunch } from "@/hooks/use-launch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

  const disabled = loading || !launchAllowed;

  return (
    <Card>
      <h3 className="text-lg font-semibold">Launch</h3>
      <p className="mt-2 text-sm text-zinc-400">
        Generate a one-time launch token and open this room in VS Code.
      </p>

      {!launchAllowed && launchReason ? (
        <p className="mt-3 text-sm text-amber-300">{launchReason}</p>
      ) : null}

      <div className="mt-4">
        <Button disabled={disabled} onClick={openRoom}>
          {loading ? "Opening..." : "Open in VS Code"}
        </Button>
      </div>
    </Card>
  );
}