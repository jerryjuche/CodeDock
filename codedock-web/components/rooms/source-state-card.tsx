import { Card } from "@/components/ui/card";
import type { RoomSourceState } from "@/types/room";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toggleRoomActivation } from "@/lib/api/rooms";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
      style={
        ready
          ? { background: "rgba(42,211,139,0.08)", color: "rgb(42,211,139)", border: "1px solid rgba(42,211,139,0.15)" }
          : { background: "rgba(249,145,53,0.08)", color: "rgb(249,145,53)", border: "1px solid rgba(249,145,53,0.15)" }
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: ready ? "rgb(42,211,139)" : "rgb(249,145,53)",
          boxShadow: ready
            ? "0 0 8px rgba(42,211,139,0.6)"
            : "0 0 8px rgba(249,145,53,0.5)",
        }}
      />
      {readableStatus({ status } as RoomSourceState)}
    </span>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium text-[rgb(158,183,211)]">{label}</span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full transition-all duration-500"
          style={{
            background: value ? "rgb(42,211,139)" : "rgba(255,255,255,0.1)",
            boxShadow: value ? "0 0 8px rgba(42,211,139,0.4)" : "none",
          }}
        />
        <span
          className="text-xs font-semibold tracking-wide uppercase transition-colors duration-300"
          style={{ color: value ? "rgb(42,211,139)" : "rgba(255,255,255,0.3)" }}
        >
          {value ? "Connected" : "Disconnected"}
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

  const handleToggle = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await toggleRoomActivation(token, roomId);
      toast.success(
        sourceState.activated
          ? "Room deactivated."
          : "Room activated! Guests can join now.",
      );
      onActivated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setLoading(false);
    }
  };

  const showToggleButton = isHost;

  return (
    <Card className="relative overflow-hidden border-white/[0.04] bg-white/[0.02] backdrop-blur-xl">
      {/* Decorative gradient flare */}
      <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-emerald-500/5 blur-[80px]" />
      
      <div className="relative p-5">
        {/* Header: title + status pill */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Source state</h3>
            <p className="mt-1 text-lg font-semibold text-white">
              Launch Readiness
            </p>
          </div>
          <StatusPill status={sourceState.status} />
        </div>

        {/* Confirmed fields from RoomSourceState only */}
        <div className="mt-6 space-y-1 divide-y divide-white/[0.03]">
          <BoolRow label="Host Workspace" value={sourceState.host_connected} />
          <BoolRow label="Network Access" value={sourceState.launch_allowed} />
        </div>

        {/* Manual Activation Toggle for Host */}
        {showToggleButton && (
          <div className="mt-8">
            <Button
              onClick={handleToggle}
              disabled={loading}
              className={`relative w-full h-12 overflow-hidden rounded-xl border transition-all duration-300 active:scale-[0.98] ${
                sourceState.activated
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              {loading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : null}
              
              <span className="relative z-10 text-sm font-bold tracking-tight">
                {sourceState.activated ? "Deactivate Room" : "Activate Room for Guests"}
              </span>
            </Button>
            
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold opacity-40">
              <span className="h-px w-8 bg-white/10" />
              {sourceState.activated ? "Guests can join" : "Gated access"}
              <span className="h-px w-8 bg-white/10" />
            </div>
          </div>
        )}

        {/* Launch reason — shown only when blocked */}
        {!sourceState.launch_allowed && sourceState.launch_reason ? (
          <div className="mt-5 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3.5">
            <p className="text-xs font-medium leading-relaxed text-orange-400/90">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              {sourceState.launch_reason}
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}