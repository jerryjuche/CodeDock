import { ApiError, AuthResponse, Room } from "./types";

const REQUEST_TIMEOUT_MS = 10_000;

export type LaunchContext = {
  room_id: string;
  room_name: string;
  room_slug: string;
  role: "host" | "editor";
  source_type: "local_workspace" | "github_repo";
  source_metadata: Record<string, unknown>;
  workspace_path_hint: string;
  auth_token: string;
};

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      false,
    );
  }

  async validateToken(token: string): Promise<void> {
    return this.request<void>(
      "/auth/me",
      { method: "GET" },
      true,
      token,
    );
  }

  async getRooms(token: string): Promise<Room[]> {
    return this.request<Room[]>(
      "/rooms",
      { method: "GET" },
      true,
      token,
    );
  }

  async createRoom(token: string, name: string): Promise<Room> {
    return this.request<Room>(
      "/rooms",
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
      true,
      token,
    );
  }

  async exchangeLaunchToken(rawToken: string): Promise<LaunchContext> {
    return this.request<LaunchContext>(
      "/vscode/launch/exchange",
      {
        method: "POST",
        body: JSON.stringify({ launch_token: rawToken }),
      },
      false,
    );
  }

  async bindLocalWorkspace(
    token: string,
    roomId: string,
    workspaceLabel: string,
  ): Promise<void> {
    return this.request<void>(
      `/rooms/${roomId}/source/local/bind`,
      {
        method: "POST",
        body: JSON.stringify({ workspace_label: workspaceLabel }),
      },
      true,
      token,
    );
  }

  private async request<T>(
    path: string,
    options: RequestInit,
    authenticated: boolean,
    token?: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (authenticated && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new ApiError(response.status, body || `HTTP ${response.status}`);
      }

      const text = await response.text();
      return text ? (JSON.parse(text) as T) : ({} as T);
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError(408, "Request timed out — is the server reachable?");
      }
      throw new ApiError(
        0,
        `Network error: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}