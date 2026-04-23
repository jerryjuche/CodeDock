import * as vscode from "vscode";
import { EventEmitter } from "events";
import { AuthManager } from "./auth";
import { ApiClient } from "./api";
import { WebSocketManager } from "./websocket";
import { YjsSync } from "./yjs-sync";

let authManager: AuthManager;
let wsManager: WebSocketManager;
let yjsSync: YjsSync;
let apiClient: ApiClient;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("codedock");
  const serverUrl = config.get<string>("serverUrl", "http://localhost:8080");

  const outputChannel = vscode.window.createOutputChannel("CodeDock");
  context.subscriptions.push(outputChannel);

  outputChannel.show(true);
  outputChannel.appendLine("CodeDock: DIAG BUILD LOADED (SYNC-ONLY)");
  vscode.window.showInformationMessage("CodeDock: DIAG BUILD LOADED (SYNC-ONLY)");

  const emitter = new EventEmitter();

  apiClient = new ApiClient(serverUrl);
  authManager = new AuthManager(context.secrets, apiClient, emitter);
  wsManager = new WebSocketManager(serverUrl, outputChannel);
  yjsSync = new YjsSync(wsManager, outputChannel);

  emitter.on("login", () => {
    outputChannel.appendLine("CodeDock: login event received (sync-only mode)");
  });

  emitter.on("logout", () => {
    outputChannel.appendLine("CodeDock: logout event received");
    wsManager.disconnect("logout");
    yjsSync.dispose();
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("codedock.login", () =>
      authManager.login(),
    ),
    vscode.commands.registerCommand("codedock.logout", () =>
      authManager.logout(),
    ),
    vscode.commands.registerCommand("codedock.joinRoom", () =>
      handleJoinRoom(outputChannel),
    ),
    vscode.commands.registerCommand("codedock.createRoom", () =>
      handleCreateRoom(outputChannel),
    ),
    vscode.commands.registerCommand("codedock.openChat", () =>
      vscode.window.showWarningMessage(
        "CodeDock Chat is temporarily disabled in sync-only diagnostic mode.",
      ),
    ),
    vscode.commands.registerCommand("codedock.disconnectRoom", () => {
      outputChannel.appendLine("CodeDock: user requested room disconnect");
      wsManager.disconnect("user");
      yjsSync.dispose();
    }),
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

async function handleJoinRoom(
  outputChannel: vscode.OutputChannel,
): Promise<void> {
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

  const normalizedRoomId = roomId.trim();
  outputChannel.appendLine(`CodeDock: joining room ${normalizedRoomId}`);

  yjsSync.setSessionRole("guest");
  wsManager.connect(token, normalizedRoomId);
  yjsSync.activate();
}

async function handleCreateRoom(
  outputChannel: vscode.OutputChannel,
): Promise<void> {
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

    outputChannel.appendLine(`CodeDock: created room ${room.id}`);

    yjsSync.setSessionRole("host");
    wsManager.connect(token, room.id);
    yjsSync.activate();
  } catch (err) {
    vscode.window.showErrorMessage(
      `CodeDock: Failed to create room — ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    );
  }
}

export function deactivate(): void {
  wsManager?.disconnect("extension_deactivated");
  yjsSync?.dispose();
}