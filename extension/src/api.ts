import * as vscode from "vscode";
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

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("codedock");
  const serverUrl = config.get<string>("serverUrl", "http://localhost:8080");

  const apiClient = new ApiClient(serverUrl);
  authManager = new AuthManager(context.secrets, apiClient);
  wsManager = new WebSocketManager();
  yjsSync = new YjsSync(wsManager);
  cursorManager = new CursorManager(wsManager);
  chatManager = new ChatManager(context);

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
    vscode.commands.registerCommand("codedock.openChat", () =>
      chatManager.open(),
    ),
    vscode.commands.registerCommand("codedock.disconnectRoom", () =>
      wsManager.disconnect("user"),
    ),
  );

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
    validateInput: (value) =>
      value.trim().length === 0 ? "Room ID cannot be empty" : null,
  });

  if (!roomId) {
    return;
  }

  await wsManager.connect(token, roomId.trim());
  yjsSync.activate();
  cursorManager.activate();
}

export function deactivate(): void {
  wsManager?.disconnect("extension_deactivated");
  yjsSync?.dispose();
  cursorManager?.dispose();
  chatManager?.dispose();
}
