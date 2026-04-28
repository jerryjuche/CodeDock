"use client";

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
  const disabled = loading || !launchAllowed;

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

      <div className="mt-5">
        <Button disabled={disabled} onClick={() => void openRoom()}>
          {loading ? "Opening..." : "Open in VS Code"}
        </Button>
      </div>
    </Card>
  );
}