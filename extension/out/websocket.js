"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
const vscode = __importStar(require("vscode"));
const MAX_BACKOFF_MS = 30000;
const BASE_BACKOFF_MS = 1000;
class WebSocketManager {
    constructor(serverUrl, outputChannel) {
        this.serverUrl = serverUrl;
        this.outputChannel = outputChannel;
        this.socket = null;
        this.state = "disconnected";
        this.queue = [];
        this.reconnectTimer = null;
        this.attemptCount = 0;
        this.manualDisconnect = false;
        this.token = null;
        this.roomId = null;
        this.messageHandler = null;
    }
    // --- Public API ---
    onMessage(handler) {
        this.messageHandler = handler;
    }
    connect(token, roomId) {
        if (!token || !roomId) {
            vscode.window.showErrorMessage("CodeDock: Cannot connect — missing credentials.");
            return;
        }
        if (this.state === "connecting" || this.state === "connected") {
            return;
        }
        this.token = token;
        this.roomId = roomId;
        this.state = "connecting";
        const wsUrl = this.serverUrl
            .replace("https://", "wss://")
            .replace("http://", "ws://") +
            `/ws?token=${token}&room_id=${roomId}`;
        this.socket = new WebSocket(wsUrl);
        this.socket.binaryType = "arraybuffer";
        this.socket.onopen = () => this.handleOpen();
        this.socket.onclose = () => this.handleClose();
        this.socket.onerror = () => this.handleError();
        this.socket.onmessage = (event) => this.handleMessage(event);
    }
    disconnect(reason = "user") {
        // intentional — do not reconnect
        this.manualDisconnect = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectTimer = null;
        this.socket?.close();
        this.socket = null;
        this.state = "disconnected";
        this.outputChannel.appendLine(`CodeDock: Disconnected — ${reason}`);
    }
    send(message) {
        if (this.state === "connected" && this.socket) {
            this.socket.send(message);
        }
        else {
            // queue the message — flush on reconnect
            this.queue.push(message);
            this.outputChannel.appendLine(`CodeDock: Queued message — ${this.queue.length} pending`);
        }
    }
    dispose() {
        this.manualDisconnect = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.socket?.close();
        this.socket = null;
        this.state = "disconnected";
    }
    // --- Private Handlers ---
    handleOpen() {
        this.state = "connected";
        this.attemptCount = 0;
        this.manualDisconnect = false;
        this.outputChannel.appendLine("CodeDock: WebSocket connected.");
        vscode.window.showInformationMessage("CodeDock: Connected to room.");
        this.flushQueue();
    }
    handleClose() {
        this.socket = null;
        if (this.manualDisconnect) {
            // intentional close — do nothing
            this.state = "disconnected";
            return;
        }
        // unexpected close — attempt reconnect
        this.state = "reconnecting";
        this.outputChannel.appendLine("CodeDock: Connection lost. Scheduling reconnect...");
        this.scheduleReconnect();
    }
    handleError() {
        // log safely — no token, no credentials
        this.outputChannel.appendLine("CodeDock: WebSocket error encountered.");
    }
    handleMessage(event) {
        if (!(event.data instanceof ArrayBuffer)) {
            this.outputChannel.appendLine("CodeDock: Received non-binary message — ignored.");
            return;
        }
        const data = new Uint8Array(event.data);
        if (data.length === 0) {
            this.outputChannel.appendLine("CodeDock: Received empty message — ignored.");
            return;
        }
        this.messageHandler?.(data);
    }
    // --- Reconnection ---
    scheduleReconnect() {
        if (!this.token || !this.roomId) {
            this.outputChannel.appendLine("CodeDock: Cannot reconnect — credentials missing.");
            return;
        }
        // clear any existing timer — never stack timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        const base = Math.min(BASE_BACKOFF_MS * Math.pow(2, this.attemptCount), MAX_BACKOFF_MS);
        // jitter — spread reconnect attempts across time
        const delay = base + Math.random() * base;
        this.outputChannel.appendLine(`CodeDock: Reconnecting in ${Math.round(delay)}ms ` +
            `(attempt ${this.attemptCount + 1})`);
        this.reconnectTimer = setTimeout(() => {
            this.attemptCount++;
            this.connect(this.token, this.roomId);
        }, delay);
    }
    // --- Queue ---
    flushQueue() {
        if (this.queue.length === 0) {
            return;
        }
        this.outputChannel.appendLine(`CodeDock: Flushing ${this.queue.length} queued messages.`);
        // flush in order — the queue preserves message sequence
        const pending = [...this.queue];
        this.queue = [];
        for (const message of pending) {
            this.send(message);
        }
    }
}
exports.WebSocketManager = WebSocketManager;
//# sourceMappingURL=websocket.js.map