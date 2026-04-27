export type LaunchTokenResponse = {
  launch_token: string;
  deep_link: string;
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
