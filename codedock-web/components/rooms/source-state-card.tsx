// components/rooms/source-state-card.tsx
import { Card } from "@/components/ui/card";
import type { RoomSourceState } from "@/types/room";

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
}: {
  sourceState: RoomSourceState;
}) {
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