export interface AuthResponse {
  token: string;
  email: string;
}

export interface Room {
  id: string;
  name: string;
  is_active: boolean;
}

export interface AwarenessState {
  userId: string;
  email: string;
  cursor: CursorPosition | null;
  selection: SelectionRange | null;
}

export interface CursorPosition {
  line: number;
  character: number;
}

export interface SelectionRange {
  anchor: CursorPosition;
  active: CursorPosition;
}

export interface ChatMessage {
  id: string;
  userId: string;
  email: string;
  content: string;
  timestamp: number;
}

export interface SyncPayload {
  filePath: string;
  update: Uint8Array;
}

export interface WebSocketMessage {
  type: number;
  payload: Uint8Array;
}

export interface DocumentBinding {
  filePath: string;
  dispose: () => void;
}

export interface WorkspaceManifestRequest {
  requestedAt: number;
}

export interface WorkspaceManifestEntry {
  path: string;
  kind: "file" | "dir";
  isText?: boolean;
  size?: number;
}

export interface WorkspaceManifest {
  rootName: string;
  entries: WorkspaceManifestEntry[];
  generatedAt: number;
}

export interface FileBootstrapRequest {
  path: string;
}

export interface FileBootstrapResponse {
  path: string;
  content: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}