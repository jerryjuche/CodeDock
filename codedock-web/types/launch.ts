export type CodeDockEditorTarget = "vscode" | "antigravity";

export type LaunchTokenResponse = {
  launch_token: string;
  editor?: CodeDockEditorTarget;
  deep_link: string;
  deep_links?: {
    vscode: string;
    antigravity: string;
  };
  expires_at?: string;
};

export type LaunchContext = {
  room_id: string;
  room_name: string;
  room_slug: string;
  role: "host" | "editor";
  source_type: "local_workspace" | "github_repo";
  source_metadata: Record<string, unknown>;
  workspace_path_hint: string;
};
