import * as vscode from "vscode";
import { EventEmitter } from "events";
import { AuthManager } from "./auth";
import { ApiClient } from "./api";
import { WebSocketManager } from "./websocket";
import { YjsSync } from "./yjs-sync";
import { CursorManager } from "./cursor-manager";
import { ChatManager } from "./chat";

let authManager: AuthManager;
let wsManager: WebSocketManager;
let yjsSync: YjsSync;
let cursorManager: CursorManager;
let chatManager: ChatManager;
let apiClient: ApiClient;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("codedock");
  const serverUrl = config.get<string>("serverUrl", "http://localhost:8080");

  // output channel for safe diagnostics — no secrets ever logged here
  const outputChannel = vscode.window.createOutputChannel("CodeDock");
  context.subscriptions.push(outputChannel);

  // shared event emitter — auth announces login/logout, others listen
  const emitter = new EventEmitter();

  // wire dependencies — office manager hands out keys
  apiClient = new ApiClient(serverUrl);
  authManager = new AuthManager(context.secrets, apiClient, emitter);
  wsManager = new WebSocketManager(serverUrl, outputChannel);
  yjsSync = new YjsSync(wsManager);
  cursorManager = new CursorManager(wsManager);
  chatManager = new ChatManager(context, wsManager);

  // observer — when login fires, activate collaboration features
  emitter.on("login", (token: string, email: string) => {
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
  context.subscriptions.push(
    vscode.commands.registerCommand("codedock.login", () =>
      authManager.login(),
    ),
    vscode.commands.registerCommand("codedock.logout", () =>
      authManager.logout(),
    ),
    vscode.commands.registerCommand("codedock.joinRoom", () =>
      handleJoinRoom(),
    ),
    vscode.commands.registerCommand("codedock.createRoom", () =>
      handleCreateRoom(),
    ),
    vscode.commands.registerCommand("codedock.openChat", () =>
      chatManager.open(),
    ),
    vscode.commands.registerCommand("codedock.disconnectRoom", () =>
      wsManager.disconnect("user"),
    ),
  );

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri): void {
        outputChannel.appendLine(`URI received: ${uri.toString()}`);

        const params = new URLSearchParams(uri.query);
        const code = params.get("code");
        const roomId = params.get("room_id");

        outputChannel.appendLine(`code: ${code}`);
        outputChannel.appendLine(`room_id: ${roomId}`);

        vscode.window.showInformationMessage(
          `Deep link received — code: ${code}, room: ${roomId}`,
        );
      },
    }),
  );

  // restore session or prompt login on startup
  await restoreSession();
}

async function restoreSession(): Promise<void> {
  const token = await authManager.getToken();

  if (!token) {
    vscode.window.showInformationMessage(
      'CodeDock: Not logged in. Run "CodeDock: Login" to start.',
    );
    return;
  }

  const valid = await authManager.validateToken();

  if (!valid) {
    vscode.window
      .showWarningMessage(
        "CodeDock: Session expired. Please log in again.",
        "Login",
      )
      .then((selection) => {
        if (selection === "Login") {
          authManager.login();
        }
      });
    return;
  }

  vscode.window.showInformationMessage("CodeDock: Session restored.");
}

async function handleJoinRoom(): Promise<void> {
  const token = await authManager.getToken();

  if (!token) {
    vscode.window.showErrorMessage(
      "CodeDock: You must be logged in to join a room.",
    );
    return;
  }

  const roomId = await vscode.window.showInputBox({
    prompt: "Enter Room ID",
    placeHolder: "e.g. 550e8400-e29b-41d4-a716-446655440000",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim().length === 0 ? "Room ID cannot be empty" : null,
  });

  if (!roomId) {
    return;
  }

  await wsManager.connect(token, roomId.trim());
  yjsSync.activate();
}

async function handleCreateRoom(): Promise<void> {
  const token = await authManager.getToken();

  if (!token) {
    vscode.window.showErrorMessage(
      "CodeDock: You must be logged in to create a room.",
    );
    return;
  }

  const roomName = await vscode.window.showInputBox({
    prompt: "Enter a name for your room",
    placeHolder: "e.g. my-project",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim().length === 0 ? "Room name cannot be empty" : null,
  });

  if (!roomName) {
    return;
  }

  try {
    const room = await apiClient.createRoom(token, roomName.trim());
    vscode.window.showInformationMessage(
      `CodeDock: Room "${room.name}" created. ID: ${room.id}`,
    );
    await wsManager.connect(token, room.id);
    yjsSync.activate();
  } catch (err) {
    vscode.window.showErrorMessage(
      `CodeDock: Failed to create room — ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

export function deactivate(): void {
  wsManager?.disconnect("extension_deactivated");
  yjsSync?.dispose();
  cursorManager?.dispose();
  chatManager?.dispose();
}
