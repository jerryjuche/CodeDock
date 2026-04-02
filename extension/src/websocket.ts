import * as vscode from "vscode";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type MessageHandler = (data: Uint8Array) => void;

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private queue: Uint8Array[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private attemptCount: number = 0;
  private manualDisconnect: boolean = false;
  private token: string | null = null;
  private roomId: string | null = null;
  private messageHandler: MessageHandler | null = null;

  constructor(
    private readonly serverUrl: string,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  // --- Public API ---

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  connect(token: string, roomId: string): void {
    if (!token || !roomId) {
      vscode.window.showErrorMessage(
        "CodeDock: Cannot connect — missing credentials.",
      );
      return;
    }

    if (this.state === "connecting" || this.state === "connected") {
      return;
    }

    this.token = token;
    this.roomId = roomId;
    this.state = "connecting";

    const wsUrl =
      this.serverUrl
        .replace("https://", "wss://")
        .replace("http://", "ws://") +
      `/ws?token=${token}&room_id=${roomId}`;

    this.socket = new WebSocket(wsUrl);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen    = () => this.handleOpen();
    this.socket.onclose   = () => this.handleClose();
    this.socket.onerror   = () => this.handleError();
    this.socket.onmessage = (event) => this.handleMessage(event);
  }

  disconnect(reason: string = "user"): void {
    // intentional — do not reconnect
    this.manualDisconnect = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
    this.state = "disconnected";
    this.outputChannel.appendLine(`CodeDock: Disconnected — ${reason}`);
  }

  send(message: Uint8Array): void {
    if (this.state === "connected" && this.socket) {
      this.socket.send(message);
    } else {
      // queue the message — flush on reconnect
      this.queue.push(message);
      this.outputChannel.appendLine(
        `CodeDock: Queued message — ${this.queue.length} pending`,
      );
    }
  }

  dispose(): void {
    this.manualDisconnect = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.state = "disconnected";
  }

  // --- Private Handlers ---

  private handleOpen(): void {
    this.state = "connected";
    this.attemptCount = 0;
    this.manualDisconnect = false;
    this.outputChannel.appendLine("CodeDock: WebSocket connected.");
    vscode.window.showInformationMessage("CodeDock: Connected to room.");
    this.flushQueue();
  }

  private handleClose(): void {
    this.socket = null;

    if (this.manualDisconnect) {
      // intentional close — do nothing
      this.state = "disconnected";
      return;
    }

    // unexpected close — attempt reconnect
    this.state = "reconnecting";
    this.outputChannel.appendLine(
      "CodeDock: Connection lost. Scheduling reconnect...",
    );
    this.scheduleReconnect();
  }

  private handleError(): void {
    // log safely — no token, no credentials
    this.outputChannel.appendLine(
      "CodeDock: WebSocket error encountered.",
    );
  }

  private handleMessage(event: MessageEvent): void {
    if (!(event.data instanceof ArrayBuffer)) {
      this.outputChannel.appendLine(
        "CodeDock: Received non-binary message — ignored.",
      );
      return;
    }

    const data = new Uint8Array(event.data);

    if (data.length === 0) {
      this.outputChannel.appendLine(
        "CodeDock: Received empty message — ignored.",
      );
      return;
    }

    this.messageHandler?.(data);
  }

  // --- Reconnection ---

  private scheduleReconnect(): void {
    if (!this.token || !this.roomId) {
      this.outputChannel.appendLine(
        "CodeDock: Cannot reconnect — credentials missing.",
      );
      return;
    }

    // clear any existing timer — never stack timers
    clearTimeout(this.reconnectTimer);

    const base = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, this.attemptCount),
      MAX_BACKOFF_MS,
    );

    // jitter — spread reconnect attempts across time
    const delay = base + Math.random() * base;

    this.outputChannel.appendLine(
      `CodeDock: Reconnecting in ${Math.round(delay)}ms ` +
      `(attempt ${this.attemptCount + 1})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.attemptCount++;
      this.connect(this.token!, this.roomId!);
    }, delay);
  }

  // --- Queue ---

  private flushQueue(): void {
    if (this.queue.length === 0) {
      return;
    }

    this.outputChannel.appendLine(
      `CodeDock: Flushing ${this.queue.length} queued messages.`,
    );

    // flush in order — the queue preserves message sequence
    const pending = [...this.queue];
    this.queue = [];

    for (const message of pending) {
      this.send(message);
    }
  }
}