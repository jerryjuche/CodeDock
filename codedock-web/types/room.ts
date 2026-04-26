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
