export type Room = {
  id: string;
  name: string;
  slug: string;
  created_by?: string;
  owner_user_id: string;
  source_type: "local_workspace" | "github_repo";
  source_metadata: Record<string, unknown>;
  primary_join_code: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RoomMembership = {
  role: "host" | "editor";
};

export type RoomSourceState = {
  type: "local_workspace" | "github_repo" | string;
  ready: boolean;
  host_bound: boolean;
  status: string;
  launch_allowed: boolean;
  launch_reason?: string;
  workspace_label?: string;
  repo_owner?: string;
  repo_name?: string;
  branch?: string;
};

export type RoomDetails = {
  room: Room;
  membership: RoomMembership;
  source_state: RoomSourceState;
};

export type RoomPresenceMember = {
  user_id: string;
  email: string;
  role: "host" | "editor" | string;
  connected: boolean;
};

export type RoomPresence = {
  members: RoomPresenceMember[];
  connected_count: number;
  total_members: number;
};