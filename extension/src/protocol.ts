import {
  FileBootstrapRequest,
  FileBootstrapResponse,
  SyncPayload,
  WorkspaceManifest,
  WorkspaceManifestRequest,
  FileActivityPayload,
} from "./types";


export const MessageType = {
  SYNC: 0x01,
  AWARENESS: 0x02,
  CHAT: 0x03,
  HYDRATION_REQUEST: 0x04,
  WORKSPACE_MANIFEST_REQUEST: 0x05,
  WORKSPACE_MANIFEST_RESPONSE: 0x06,
  FILE_BOOTSTRAP_REQUEST: 0x07,
  FILE_BOOTSTRAP_RESPONSE: 0x08,
  FILE_ACTIVITY: 0x09,
  FILE_ACTIVITY_INCREMENTAL: 0x0b,
} as const;

export type MessageTypeValue = typeof MessageType[keyof typeof MessageType];

export function encodeSyncPayload(
  filePath: string,
  update: Uint8Array,
): Uint8Array {
  const encoder = new TextEncoder();
  const filePathBytes = encoder.encode(filePath);

  if (filePathBytes.length > 65535) {
    throw new Error(
      `File path too long: ${filePathBytes.length} bytes. Maximum is 65535.`,
    );
  }

  const buffer = new Uint8Array(1 + 2 + filePathBytes.length + update.length);
  let offset = 0;

  buffer[offset++] = MessageType.SYNC;
  buffer[offset++] = (filePathBytes.length >> 8) & 0xff;
  buffer[offset++] = filePathBytes.length & 0xff;

  buffer.set(filePathBytes, offset);
  offset += filePathBytes.length;

  buffer.set(update, offset);

  return buffer;
}

export function decodeSyncPayload(buffer: Uint8Array): SyncPayload | null {
  try {
    if (buffer.length < 5) {
      return null;
    }

    if (buffer[0] !== MessageType.SYNC) {
      return null;
    }

    let offset = 1;
    const filePathLength = (buffer[offset++] << 8) | buffer[offset++];

    if (filePathLength === 0) {
      return null;
    }

    if (offset + filePathLength > buffer.length) {
      return null;
    }

    const decoder = new TextDecoder();
    const filePath = decoder.decode(buffer.slice(offset, offset + filePathLength));
    offset += filePathLength;

    const update = buffer.slice(offset);

    if (update.length === 0) {
      return null;
    }

    return { filePath, update };
  } catch {
    return null;
  }
}

export function encodeAwarenessPayload(state: object): Uint8Array {
  const encoder = new TextEncoder();
  const json = JSON.stringify(state);
  const jsonBytes = encoder.encode(json);

  const buffer = new Uint8Array(1 + jsonBytes.length);
  buffer[0] = MessageType.AWARENESS;
  buffer.set(jsonBytes, 1);

  return buffer;
}

export function decodeAwarenessPayload<T>(buffer: Uint8Array): T | null {
  try {
    if (buffer.length < 2 || buffer[0] !== MessageType.AWARENESS) {
      return null;
    }

    const decoder = new TextDecoder();
    const json = decoder.decode(buffer.slice(1));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function encodeChatPayload(message: object): Uint8Array {
  const encoder = new TextEncoder();
  const json = JSON.stringify(message);
  const jsonBytes = encoder.encode(json);

  const buffer = new Uint8Array(1 + jsonBytes.length);
  buffer[0] = MessageType.CHAT;
  buffer.set(jsonBytes, 1);

  return buffer;
}

export function decodeChatPayload<T>(buffer: Uint8Array): T | null {
  try {
    if (buffer.length < 2 || buffer[0] !== MessageType.CHAT) {
      return null;
    }

    const decoder = new TextDecoder();
    const json = decoder.decode(buffer.slice(1));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function encodeJsonPayload(type: number, payload: object): Uint8Array {
  const encoder = new TextEncoder();
  const json = JSON.stringify(payload);
  const jsonBytes = encoder.encode(json);

  const buffer = new Uint8Array(1 + jsonBytes.length);
  buffer[0] = type;
  buffer.set(jsonBytes, 1);

  return buffer;
}

function decodeJsonPayload<T>(
  buffer: Uint8Array,
  expectedType: number,
): T | null {
  try {
    if (buffer.length < 2 || buffer[0] !== expectedType) {
      return null;
    }

    const decoder = new TextDecoder();
    const json = decoder.decode(buffer.slice(1));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function encodeHydrationRequest(filePath: string): Uint8Array {
  const filePathBytes = new TextEncoder().encode(filePath);
  const result = new Uint8Array(1 + 2 + filePathBytes.length);

  result[0] = MessageType.HYDRATION_REQUEST;
  result[1] = (filePathBytes.length >> 8) & 0xff;
  result[2] = filePathBytes.length & 0xff;
  result.set(filePathBytes, 3);

  return result;
}

export function decodeHydrationRequest(buffer: Uint8Array): string | null {
  try {
    if (buffer.length < 3 || buffer[0] !== MessageType.HYDRATION_REQUEST) {
      return null;
    }

    const filePathLen = (buffer[1] << 8) | buffer[2];
    if (filePathLen <= 0 || 3 + filePathLen > buffer.length) {
      return null;
    }

    return new TextDecoder().decode(buffer.slice(3, 3 + filePathLen));
  } catch {
    return null;
  }
}

export function encodeWorkspaceManifestRequest(): Uint8Array {
  const request: WorkspaceManifestRequest = {
    requestedAt: Date.now(),
  };

  return encodeJsonPayload(MessageType.WORKSPACE_MANIFEST_REQUEST, request);
}

export function decodeWorkspaceManifestRequest(
  buffer: Uint8Array,
): WorkspaceManifestRequest | null {
  return decodeJsonPayload<WorkspaceManifestRequest>(
    buffer,
    MessageType.WORKSPACE_MANIFEST_REQUEST,
  );
}

export function encodeWorkspaceManifestResponse(
  manifest: WorkspaceManifest,
): Uint8Array {
  return encodeJsonPayload(MessageType.WORKSPACE_MANIFEST_RESPONSE, manifest);
}

export function decodeWorkspaceManifestResponse(
  buffer: Uint8Array,
): WorkspaceManifest | null {
  return decodeJsonPayload<WorkspaceManifest>(
    buffer,
    MessageType.WORKSPACE_MANIFEST_RESPONSE,
  );
}

export function encodeFileBootstrapRequest(
  request: FileBootstrapRequest,
): Uint8Array {
  return encodeJsonPayload(MessageType.FILE_BOOTSTRAP_REQUEST, request);
}

export function decodeFileBootstrapRequest(
  buffer: Uint8Array,
): FileBootstrapRequest | null {
  return decodeJsonPayload<FileBootstrapRequest>(
    buffer,
    MessageType.FILE_BOOTSTRAP_REQUEST,
  );
}

export function encodeFileBootstrapResponse(
  response: FileBootstrapResponse,
): Uint8Array {
  return encodeJsonPayload(MessageType.FILE_BOOTSTRAP_RESPONSE, response);
}

export function decodeFileBootstrapResponse(
  buffer: Uint8Array,
): FileBootstrapResponse | null {
  return decodeJsonPayload<FileBootstrapResponse>(
    buffer,
    MessageType.FILE_BOOTSTRAP_RESPONSE,
  );
}

export function encodeFileActivityPayload(
  payload: FileActivityPayload,
): Uint8Array {
  return encodeJsonPayload(MessageType.FILE_ACTIVITY, payload);
}

export function decodeFileActivityPayload(
  buffer: Uint8Array,
): FileActivityPayload | null {
  return decodeJsonPayload<FileActivityPayload>(
    buffer,
    MessageType.FILE_ACTIVITY,
  );
}

export interface FileActivityIncrementalPayload {
  filePath: string;
  start: number;
  deleteCount: number;
  insert: string;
}

export function encodeFileActivityIncrementalPayload(
  payload: FileActivityIncrementalPayload,
): Uint8Array {
  return encodeJsonPayload(MessageType.FILE_ACTIVITY_INCREMENTAL, payload);
}

export function decodeFileActivityIncrementalPayload(
  buffer: Uint8Array,
): FileActivityIncrementalPayload | null {
  return decodeJsonPayload<FileActivityIncrementalPayload>(
    buffer,
    MessageType.FILE_ACTIVITY_INCREMENTAL,
  );
}

export function isValidMessageType(byte: number): byte is MessageTypeValue {
  return (
    byte === MessageType.SYNC ||
    byte === MessageType.AWARENESS ||
    byte === MessageType.CHAT ||
    byte === MessageType.HYDRATION_REQUEST ||
    byte === MessageType.WORKSPACE_MANIFEST_REQUEST ||
    byte === MessageType.WORKSPACE_MANIFEST_RESPONSE ||
    byte === MessageType.FILE_BOOTSTRAP_REQUEST ||
    byte === MessageType.FILE_BOOTSTRAP_RESPONSE ||
    byte === MessageType.FILE_ACTIVITY ||
    byte === MessageType.FILE_ACTIVITY_INCREMENTAL
  );
}