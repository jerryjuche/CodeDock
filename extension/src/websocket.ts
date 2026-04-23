import * as vscode from "vscode";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type MessageHandler = (data: Uint8Array) => void;
type CloseHandler = (code: number, reason: string) => void;
private closeHandlers: Set<CloseHandler> = new Set();

onClose(handler: CloseHandler): vscode.Disposable {
  this.closeHandlers.add(handler);
  return new vscode.Disposable(() => {
    this.closeHandlers.delete(handler);
  });
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;


export class WebSocketManager {
  private socket: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private queue: Uint8Array[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private attemptCount = 0;
  private manualDisconnect = false;
  private token: string | null = null;
  private roomId: string | null = null;

  private messageHandlers: Set<MessageHandler> = new Set();
  private closeHandlers: Set<CloseHandler> = new Set();

  constructor(
    private readonly serverUrl: string,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

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
        "CodeDock: Cannot connect — missing credentials.",
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
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.token = token;
    this.roomId = roomId;
    this.manualDisconnect = false;
    this.state = this.attemptCount > 0 ? "reconnecting" : "connecting";

    const wsUrl =
      this.serverUrl.replace("https://", "wss://").replace("http://", "ws://") +
      `/ws?token=${encodeURIComponent(token)}&room_id=${encodeURIComponent(roomId)}`;

    this.outputChannel.appendLine(
      `CodeDock[ws]: connecting (room=${roomId}, handlers=${this.messageHandlers.size})`,
    );

    this.socket = new WebSocket(wsUrl);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = () => this.handleOpen();
    this.socket.onclose = (event) =>
      this.handleClose(event.code, event.reason ?? "");
    this.socket.onerror = () => this.handleError();
    this.socket.onmessage = (event) => this.handleMessage(event);
  }

  disconnect(reason: string = "user"): void {
    this.manualDisconnect = true;

    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.outputChannel.appendLine(
      `CodeDock[ws]: disconnect requested (reason=${reason}, room=${this.roomId ?? "none"})`,
    );

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.state = "disconnected";
    this.queue = [];
    this.token = null;
    this.roomId = null;
    this.attemptCount = 0;
  }

  send(message: Uint8Array): void {
    const messageType = message.length > 0 ? message[0] : -1;

    if (this.state === "connected" && this.socket) {
      this.outputChannel.appendLine(
        `CodeDock[ws]: send -> type=${messageType}, bytes=${message.length}, room=${this.roomId ?? "none"}`,
      );
      this.socket.send(message);
      return;
    }

    this.queue.push(message);
    this.outputChannel.appendLine(
      `CodeDock[ws]: queued -> type=${messageType}, bytes=${message.length}, pending=${this.queue.length}`,
    );
  }

  dispose(): void {
    this.manualDisconnect = true;

    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.outputChannel.appendLine("CodeDock[ws]: dispose");

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.state = "disconnected";
    this.queue = [];
    this.token = null;
    this.roomId = null;
    this.attemptCount = 0;
    this.messageHandlers.clear();
    this.closeHandlers.clear();
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
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.outputChannel.appendLine(
      `CodeDock[ws]: connected (room=${this.roomId ?? "none"})`,
    );

    vscode.window.showInformationMessage("CodeDock: Connected to room.");
    this.flushQueue();
  }

  private handleClose(code: number, reason: string): void {
    this.socket = null;

    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
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

  private handleError(): void {
    this.outputChannel.appendLine("CodeDock[ws]: socket error");
  }

  private handleMessage(event: MessageEvent): void {
    if (!(event.data instanceof ArrayBuffer)) {
      this.outputChannel.appendLine(
        "CodeDock[ws]: inbound ignored (non-binary payload)",
      );
      return;
    }

    const data = new Uint8Array(event.data);

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

  private scheduleReconnect(): void {
    if (!this.token || !this.roomId) {
      this.outputChannel.appendLine(
        "CodeDock[ws]: reconnect aborted (missing token or room)",
      );
      this.state = "disconnected";
      return;
    }

    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
    }

    const base = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, this.attemptCount),
      MAX_BACKOFF_MS,
    );

    const delay = Math.round(base + Math.random() * base);

    this.outputChannel.appendLine(
      `CodeDock[ws]: reconnect in ${delay}ms (attempt=${this.attemptCount + 1})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.attemptCount++;
      this.connect(this.token!, this.roomId!);
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