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

export default function SourceStateCard({
  sourceState,
}: {
  sourceState: RoomSourceState;
}) {
  return (
    <Card>
      <h3 className="text-lg font-semibold">Project Source</h3>
      <p className="mt-2 text-sm text-zinc-400">{readableStatus(sourceState)}</p>

      <div className="mt-4 space-y-2 text-sm text-zinc-300">
        <div>
          <span className="text-zinc-500">Type:</span> {sourceState.type}
        </div>

        <div>
          <span className="text-zinc-500">Ready:</span> {sourceState.ready ? "Yes" : "No"}
        </div>

        <div>
          <span className="text-zinc-500">Launch allowed:</span>{" "}
          {sourceState.launch_allowed ? "Yes" : "No"}
        </div>

        {sourceState.launch_reason ? (
          <div>
            <span className="text-zinc-500">Launch reason:</span> {sourceState.launch_reason}
          </div>
        ) : null}

        {sourceState.type === "local_workspace" && (
          <>
            <div>
              <span className="text-zinc-500">Host bound:</span>{" "}
              {sourceState.host_bound ? "Yes" : "No"}
            </div>

            {sourceState.workspace_label ? (
              <div>
                <span className="text-zinc-500">Workspace:</span>{" "}
                {sourceState.workspace_label}
              </div>
            ) : null}
          </>
        )}

        {sourceState.type === "github_repo" && (
          <>
            <div>
              <span className="text-zinc-500">Repo owner:</span>{" "}
              {sourceState.repo_owner || "—"}
            </div>
            <div>
              <span className="text-zinc-500">Repo name:</span>{" "}
              {sourceState.repo_name || "—"}
            </div>
            <div>
              <span className="text-zinc-500">Branch:</span>{" "}
              {sourceState.branch || "—"}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}