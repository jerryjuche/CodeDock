import { Card } from "@/components/ui/card";
import type { RoomSourceState } from "@/types/room";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { bindRoomSource } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";

function readableStatus(state: RoomSourceState) {
  switch (state.status) {
    case "ready":
      return "Ready";
    case "repo_configured":
      return "Repository configured";
    case "repo_not_configured":
      return "Repository not configured";
    case "host_workspace_required":
      return "Host must select a project folder in VS Code";
    case "host_activation_required":
      return "Host must activate room";
    case "waiting_for_host":
      return "Waiting for host";
    case "waiting_for_host_workspace":
      return "Waiting for host workspace";
    case "clone_not_ready":
      return "Repository is not provisioned yet";
    default:
      return state.status || "Unknown";
  }
}

function StatusPill({ status }: { status: string }) {
  const ready = status === "ready";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={
        ready
          ? { background: "rgba(42,211,139,0.10)", color: "rgb(42,211,139)" }
          : { background: "rgba(249,145,53,0.10)", color: "rgb(249,145,53)" }
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: ready ? "rgb(42,211,139)" : "rgb(249,145,53)",
          boxShadow: ready
            ? "0 0 5px rgba(42,211,139,0.5)"
            : "0 0 5px rgba(249,145,53,0.4)",
        }}
      />
      {readableStatus({ status } as RoomSourceState)}
    </span>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-[rgb(158,183,211)]">{label}</span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: value ? "rgb(42,211,139)" : "rgb(158,183,211)",
            boxShadow: value ? "0 0 5px rgba(42,211,139,0.45)" : "none",
          }}
        />
        <span
          className="text-sm font-medium"
          style={{ color: value ? "rgb(42,211,139)" : "rgb(158,183,211)" }}
        >
          {value ? "Yes" : "No"}
        </span>
      </span>
    </div>
  );
}

export default function SourceStateCard({
  sourceState,
  roomId,
  isHost,
  onActivated,
}: {
  sourceState: RoomSourceState;
  roomId: string;
  isHost: boolean;
  onActivated?: () => void;
}) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await bindRoomSource(token, roomId);
      toast.success("Room activated successfully!");
      onActivated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setLoading(false);
    }
  };

  const showActivateButton = isHost && !sourceState.ready;

  return (
    <Card>
      {/* Header: title + status pill */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Source state</h3>
          <p className="mt-0.5 text-sm text-[rgb(158,183,211)]">
            Workspace and launch readiness.
          </p>
        </div>
        <StatusPill status={sourceState.status} />
      </div>

      {/* Confirmed fields from RoomSourceState only */}
      <div className="mt-4 divide-y divide-white/[0.06]">
        <BoolRow label="Launch allowed" value={sourceState.launch_allowed} />
      </div>

      {/* Manual Activation Button for Host */}
      {showActivateButton && (
        <div className="mt-4">
          <Button
            onClick={handleActivate}
            disabled={loading}
            className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 border-none shadow-lg shadow-emerald-900/20"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            Activate Room for Guests
          </Button>
          <p className="mt-2 text-[11px] text-center text-[rgb(158,183,211)]">
            Activation notifies guests that the room is ready for joining.
          </p>
        </div>
      )}

      {/* Launch reason — shown only when blocked */}
      {!sourceState.launch_allowed && sourceState.launch_reason ? (
        <div className="mt-4 rounded-xl border border-[rgba(249,145,53,0.2)] bg-[rgba(249,145,53,0.07)] px-4 py-3">
          <p className="text-sm leading-relaxed text-[rgb(249,145,53)]">
            {sourceState.launch_reason}
          </p>
        </div>
      ) : null}
    </Card>
  );
}