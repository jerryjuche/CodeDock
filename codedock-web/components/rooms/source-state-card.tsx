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

function BoolIndicator({ value }: { value: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: value ? "rgb(42,211,139)" : "rgb(158,183,211)",
          boxShadow: value ? "0 0 6px rgba(42,211,139,0.5)" : "none",
        }}
      />
      <span className={value ? "text-[rgb(42,211,139)]" : "text-[rgb(158,183,211)]"}>
        {value ? "Yes" : "No"}
      </span>
    </span>
  );
}

export default function SourceStateCard({
  sourceState,
}: {
  sourceState: RoomSourceState;
}) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-white">Source readiness</h3>
      <p className="mt-2 text-sm text-[rgb(158,183,211)]">
        {readableStatus(sourceState)}
      </p>

      <div className="mt-5 space-y-3 text-sm text-white">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[rgb(158,183,211)]">Type</span>
          <span>{sourceState.type}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-[rgb(158,183,211)]">Ready</span>
          <BoolIndicator value={sourceState.ready} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-[rgb(158,183,211)]">Launch allowed</span>
          <BoolIndicator value={sourceState.launch_allowed} />
        </div>

        {sourceState.launch_reason ? (
          <div className="rounded-2xl border border-amber-300/15 bg-amber-300/10 p-3 text-sm text-amber-100">
            {sourceState.launch_reason}
          </div>
        ) : null}

        {sourceState.workspace_label ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-[rgb(158,183,211)]">Workspace</span>
            <span>{sourceState.workspace_label}</span>
          </div>
        ) : null}

        {sourceState.repo_owner || sourceState.repo_name ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[rgb(158,183,211)]">Repo owner</span>
              <span>{sourceState.repo_owner || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[rgb(158,183,211)]">Repo name</span>
              <span>{sourceState.repo_name || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[rgb(158,183,211)]">Branch</span>
              <span>{sourceState.branch || "—"}</span>
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}