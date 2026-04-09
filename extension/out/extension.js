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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const events_1 = require("events");
const auth_1 = require("./auth");
const api_1 = require("./api");
const websocket_1 = require("./websocket");
const yjs_sync_1 = require("./yjs-sync");
const cursor_manager_1 = require("./cursor-manager");
const chat_1 = require("./chat");
let authManager;
let wsManager;
let yjsSync;
let cursorManager;
let chatManager;
let apiClient;
async function activate(context) {
    const config = vscode.workspace.getConfiguration("codedock");
    const serverUrl = config.get("serverUrl", "http://localhost:8080");
    // output channel for safe diagnostics — no secrets ever logged here
    const outputChannel = vscode.window.createOutputChannel("CodeDock");
    context.subscriptions.push(outputChannel);
    // shared event emitter — auth announces login/logout, others listen
    const emitter = new events_1.EventEmitter();
    // wire dependencies — office manager hands out keys
    apiClient = new api_1.ApiClient(serverUrl);
    authManager = new auth_1.AuthManager(context.secrets, apiClient, emitter);
    wsManager = new websocket_1.WebSocketManager(serverUrl, outputChannel);
    yjsSync = new yjs_sync_1.YjsSync(wsManager);
    cursorManager = new cursor_manager_1.CursorManager(wsManager);
    chatManager = new chat_1.ChatManager(context, wsManager);
    // observer — when login fires, activate collaboration features
    emitter.on("login", (token, email) => {
        cursorManager.activate(token, email);
        chatManager.activate(token, email);
    });
    // observer — when logout fires, disconnect everything
    emitter.on("logout", () => {
        wsManager.disconnect("logout");
        yjsSync.dispose();
        cursorManager.dispose();
        chatManager.dispose();
    });
    // register all commands into context.subscriptions
    // VS Code disposes these automatically on deactivation
    context.subscriptions.push(vscode.commands.registerCommand("codedock.login", () => authManager.login()), vscode.commands.registerCommand("codedock.logout", () => authManager.logout()), vscode.commands.registerCommand("codedock.joinRoom", () => handleJoinRoom()), vscode.commands.registerCommand("codedock.createRoom", () => handleCreateRoom()), vscode.commands.registerCommand("codedock.openChat", () => chatManager.open()), vscode.commands.registerCommand("codedock.disconnectRoom", () => wsManager.disconnect("user")));
    context.subscriptions.push(vscode.window.registerUriHandler({
        handleUri(uri) {
            outputChannel.appendLine(`URI received: ${uri.toString()}`);
            const params = new URLSearchParams(uri.query);
            const code = params.get("code");
            const roomId = params.get("room_id");
            outputChannel.appendLine(`code: ${code}`);
            outputChannel.appendLine(`room_id: ${roomId}`);
            vscode.window.showInformationMessage(`Deep link received — code: ${code}, room: ${roomId}`);
        },
    }));
    // restore session or prompt login on startup
    await restoreSession();
}
async function restoreSession() {
    const token = await authManager.getToken();
    if (!token) {
        vscode.window.showInformationMessage('CodeDock: Not logged in. Run "CodeDock: Login" to start.');
        return;
    }
    const valid = await authManager.validateToken();
    if (!valid) {
        vscode.window
            .showWarningMessage("CodeDock: Session expired. Please log in again.", "Login")
            .then((selection) => {
            if (selection === "Login") {
                authManager.login();
            }
        });
        return;
    }
    vscode.window.showInformationMessage("CodeDock: Session restored.");
}
async function handleJoinRoom() {
    const token = await authManager.getToken();
    if (!token) {
        vscode.window.showErrorMessage("CodeDock: You must be logged in to join a room.");
        return;
    }
    const roomId = await vscode.window.showInputBox({
        prompt: "Enter Room ID",
        placeHolder: "e.g. 550e8400-e29b-41d4-a716-446655440000",
        ignoreFocusOut: true,
        validateInput: (value) => value.trim().length === 0 ? "Room ID cannot be empty" : null,
    });
    if (!roomId) {
        return;
    }
    await wsManager.connect(token, roomId.trim());
    yjsSync.activate();
}
async function handleCreateRoom() {
    const token = await authManager.getToken();
    if (!token) {
        vscode.window.showErrorMessage("CodeDock: You must be logged in to create a room.");
        return;
    }
    const roomName = await vscode.window.showInputBox({
        prompt: "Enter a name for your room",
        placeHolder: "e.g. my-project",
        ignoreFocusOut: true,
        validateInput: (value) => value.trim().length === 0 ? "Room name cannot be empty" : null,
    });
    if (!roomName) {
        return;
    }
    try {
        const room = await apiClient.createRoom(token, roomName.trim());
        vscode.window.showInformationMessage(`CodeDock: Room "${room.name}" created. ID: ${room.id}`);
        await wsManager.connect(token, room.id);
        yjsSync.activate();
    }
    catch (err) {
        vscode.window.showErrorMessage(`CodeDock: Failed to create room — ${err instanceof Error ? err.message : "unknown error"}`);
    }
}
function deactivate() {
    wsManager?.disconnect("extension_deactivated");
    yjsSync?.dispose();
    cursorManager?.dispose();
    chatManager?.dispose();
}
//# sourceMappingURL=extension.js.map