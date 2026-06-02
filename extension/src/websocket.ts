import * as vscode from "vscode";
import WebSocket, { RawData } from "ws";
import {
  clearTimeout as nodeClearTimeout,
  setTimeout as nodeSetTimeout,
} from "timers";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type MessageHandler = (data: Uint8Array) => void;
type CloseHandler = (code: number, reason: string) => void;
type StateChangeHandler = (state: ConnectionState) => void;

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private _state: ConnectionState = "disconnected";
  private queue: Uint8Array[] = [];
  private reconnectTimer: ReturnType<typeof nodeSetTimeout> | undefined;
  private attemptCount = 0;
  private manualDisconnect = false;
  private token: string | null = null;
  private roomId: string | null = null;

  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly closeHandlers = new Set<CloseHandler>();
  private readonly stateChangeHandlers = new Set<StateChangeHandler>();

  constructor(
    private readonly serverUrl: string,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  public get state(): ConnectionState {
    return this._state;
  }

  private set state(value: ConnectionState) {
    if (this._state === value) {
      return;
    }
    this._state = value;
    try {
      this.outputChannel.appendLine(`CodeDock[ws] state -> ${value}`);
    } catch {
      // ignore
    }
    this.emitStateChange();
  }

  private emitStateChange(): void {
    for (const handler of this.stateChangeHandlers) {
      try {
        handler(this._state);
      } catch (error) {
        this.outputChannel.appendLine(
          `CodeDock[ws]: state change handler failure -> ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
  }

  onStateChange(handler: StateChangeHandler): vscode.Disposable {
    this.stateChangeHandlers.add(handler);
    this.outputChannel.appendLine(
      `CodeDock[ws]: registered state change handler (total=${this.stateChangeHandlers.size})`,
    );

    return new vscode.Disposable(() => {
      this.stateChangeHandlers.delete(handler);
      this.outputChannel.appendLine(
        `CodeDock[ws]: removed state change handler (total=${this.stateChangeHandlers.size})`,
      );
    });
  }

  onMessage(handler: MessageHandler): vscode.Disposable {
    this.messageHandlers.add(handler);
    this.outputChannel.appendLine(
      `CodeDock[ws]: registered message handler (total=${this.messageHandlers.size})`,
    );

    return new vscode.Disposable(() => {
      this.messageHandlers.delete(handler);
      this.outputChannel.appendLine(
        `CodeDock[ws]: removed message handler (total=${this.messageHandlers.size})`,
      );
    });
  }

  onClose(handler: CloseHandler): vscode.Disposable {
    this.closeHandlers.add(handler);
    this.outputChannel.appendLine(
      `CodeDock[ws]: registered close handler (total=${this.closeHandlers.size})`,
    );

    return new vscode.Disposable(() => {
      this.closeHandlers.delete(handler);
      this.outputChannel.appendLine(
        `CodeDock[ws]: removed close handler (total=${this.closeHandlers.size})`,
      );
    });
  }

  connect(token: string, roomId: string): void {
    if (!token || !roomId) {
      vscode.window.showErrorMessage(
        "CodeDock: Cannot connect — missing token or room ID.",
      );
      return;
    }

    if (this.state === "connecting" || this.state === "connected") {
      this.outputChannel.appendLine(
        `CodeDock[ws]: connect skipped (state=${this.state}, room=${this.roomId ?? "none"})`,
      );
      return;
    }

    if (this.reconnectTimer !== undefined) {
      nodeClearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.token = token;
    this.roomId = roomId;
    this.manualDisconnect = false;
    this.state = this.attemptCount > 0 ? "reconnecting" : "connecting";

    const wsUrl =
      this.serverUrl
        .replace(/^https:\/\//, "wss://")
        .replace(/^http:\/\//, "ws://") +
      `/ws?token=${encodeURIComponent(token)}&room_id=${encodeURIComponent(roomId)}&client=vscode`;

    this.outputChannel.appendLine(
      `CodeDock[ws]: connecting (room=${roomId}, handlers=${this.messageHandlers.size})`,
    );

    try {
      this.socket = new WebSocket(wsUrl);
    } catch (error) {
      this.outputChannel.appendLine(
        `CodeDock[ws]: socket creation failed -> ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      this.state = "disconnected";
      this.scheduleReconnect();
      return;
    }

    this.socket.binaryType = "arraybuffer";

    this.socket.on("open", () => this.handleOpen());

    this.socket.on("message", (data: RawData) => {
      this.handleMessage(data);
    });

    this.socket.on("error", (error: Error) => {
      this.handleError(error);
    });

    this.socket.on("close", (code: number, reasonBuffer: Buffer) => {
      const reason = reasonBuffer?.toString("utf8") ?? "";
      this.handleClose(code, reason);
    });
  }

  disconnect(reason: string = "user"): void {
    this.manualDisconnect = true;

    if (this.reconnectTimer !== undefined) {
      nodeClearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.outputChannel.appendLine(
      `CodeDock[ws]: disconnect requested (reason=${reason}, room=${this.roomId ?? "none"})`,
    );

    const socket = this.socket;
    this.socket = null;

    if (socket) {
      try {
        socket.close(1000, reason);
      } catch {
        // no-op
      }
    }

    this.state = "disconnected";
    this.queue = [];
    this.token = null;
    this.roomId = null;
    this.attemptCount = 0;
  }

  dispose(): void {
    this.manualDisconnect = true;

    if (this.reconnectTimer !== undefined) {
      nodeClearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.outputChannel.appendLine("CodeDock[ws]: dispose");

    const socket = this.socket;
    this.socket = null;

    if (socket) {
      try {
        socket.close(1000, "dispose");
      } catch {
        // no-op
      }
    }

    this.state = "disconnected";
    this.queue = [];
    this.token = null;
    this.roomId = null;
    this.attemptCount = 0;
    this.messageHandlers.clear();
    this.closeHandlers.clear();
  }

  send(message: Uint8Array): void {
    const messageType = message.length > 0 ? message[0] : -1;

    if (
      this.state === "connected" &&
      this.socket &&
      this.socket.readyState === WebSocket.OPEN
    ) {
      this.outputChannel.appendLine(
        `CodeDock[ws]: send -> type=${messageType}, bytes=${message.length}, room=${this.roomId ?? "none"}`,
      );
      this.socket.send(Buffer.from(message));
      return;
    }

    this.queue.push(message);
    this.outputChannel.appendLine(
      `CodeDock[ws]: queued -> type=${messageType}, bytes=${message.length}, pending=${this.queue.length}`,
    );
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  private handleOpen(): void {
    this.state = "connected";
    this.attemptCount = 0;
    this.manualDisconnect = false;

    if (this.reconnectTimer !== undefined) {
      nodeClearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.outputChannel.appendLine(
      `CodeDock[ws]: connected (room=${this.roomId ?? "none"})`,
    );

    this.flushQueue();
  }

  private handleClose(code: number, reason: string): void {
    this.socket = null;

    if (this.reconnectTimer !== undefined) {
      nodeClearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    const normalizedReason = reason || "none";

    this.outputChannel.appendLine(
      `CodeDock[ws]: closed (code=${code}, reason=${normalizedReason}, manual=${this.manualDisconnect})`,
    );

    for (const handler of this.closeHandlers) {
      try {
        handler(code, reason);
      } catch (error) {
        this.outputChannel.appendLine(
          `CodeDock[ws]: close handler failure -> ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }

    const terminal = this.isTerminalClose(code, reason);

    if (this.manualDisconnect || terminal) {
      this.state = "disconnected";
      this.manualDisconnect = true;
      this.queue = [];
      this.token = null;
      this.roomId = null;
      this.attemptCount = 0;

      if (reason === "room_deleted" || code === 4004) {
        vscode.window.showWarningMessage(
          "CodeDock: This session has ended because the room was deleted.",
        );
      } else if (
        reason === "forbidden" ||
        reason === "room_unavailable" ||
        code === 4003
      ) {
        vscode.window.showWarningMessage(
          "CodeDock: This room is no longer available.",
        );
      }

      return;
    }

    this.state = "reconnecting";
    this.outputChannel.appendLine("CodeDock[ws]: scheduling reconnect");
    this.scheduleReconnect();
  }

  private handleError(error: Error): void {
    this.outputChannel.appendLine(
      `CodeDock[ws]: socket error -> ${error.message}`,
    );
  }

  private handleMessage(rawData: RawData): void {
    const data = this.rawDataToUint8Array(rawData);

    if (!data) {
      this.outputChannel.appendLine(
        "CodeDock[ws]: inbound ignored (unsupported payload)",
      );
      return;
    }

    if (data.length === 0) {
      this.outputChannel.appendLine("CodeDock[ws]: inbound ignored (empty)");
      return;
    }

    this.outputChannel.appendLine(
      `CodeDock[ws]: inbound <- type=${data[0]}, bytes=${data.length}, handlers=${this.messageHandlers.size}`,
    );

    for (const handler of this.messageHandlers) {
      try {
        handler(data);
      } catch (error) {
        this.outputChannel.appendLine(
          `CodeDock[ws]: handler failure -> ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
  }

  private rawDataToUint8Array(rawData: RawData): Uint8Array | null {
    if (Buffer.isBuffer(rawData)) {
      return new Uint8Array(rawData);
    }

    if (rawData instanceof ArrayBuffer) {
      return new Uint8Array(rawData);
    }

    if (Array.isArray(rawData)) {
      const merged = Buffer.concat(rawData);
      return new Uint8Array(merged);
    }

    return null;
  }

  private scheduleReconnect(): void {
    if (!this.token || !this.roomId) {
      this.outputChannel.appendLine(
        "CodeDock[ws]: reconnect aborted (missing token or room)",
      );
      this.state = "disconnected";
      return;
    }

    if (this.reconnectTimer !== undefined) {
      nodeClearTimeout(this.reconnectTimer);
    }

    const baseDelay = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, this.attemptCount),
      MAX_BACKOFF_MS,
    );
    const jitter = Math.floor(Math.random() * baseDelay);
    const delay = baseDelay + jitter;

    this.outputChannel.appendLine(
      `CodeDock[ws]: reconnect in ${delay}ms (attempt=${this.attemptCount + 1})`,
    );

    this.reconnectTimer = nodeSetTimeout(() => {
      this.reconnectTimer = undefined;
      this.attemptCount += 1;

      const token = this.token;
      const roomId = this.roomId;

      if (!token || !roomId) {
        this.outputChannel.appendLine(
          "CodeDock[ws]: reconnect cancelled (missing token or room)",
        );
        this.state = "disconnected";
        return;
      }

      this.connect(token, roomId);
    }, delay);
  }

  private flushQueue(): void {
    if (this.queue.length === 0) {
      this.outputChannel.appendLine("CodeDock[ws]: flush skipped (queue empty)");
      return;
    }

    this.outputChannel.appendLine(
      `CodeDock[ws]: flushing queue (${this.queue.length} message(s))`,
    );

    const pending = [...this.queue];
    this.queue = [];

    for (const message of pending) {
      this.send(message);
    }
  }

  private isTerminalClose(code: number, reason: string): boolean {
    return (
      code === 4003 ||
      code === 4004 ||
      reason === "forbidden" ||
      reason === "room_deleted" ||
      reason === "room_unavailable"
    );
  }
}