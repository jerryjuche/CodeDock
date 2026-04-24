import * as path from "path";
import * as vscode from "vscode";
import { EventEmitter } from "events";
import { AuthManager } from "./auth";
import { ApiClient } from "./api";
import { WebSocketManager } from "./websocket";
import { YjsSync } from "./yjs-sync";

const PENDING_HYDRATED_ROOM_ID_KEY = "codedock.pendingHydrated.roomId";
const PENDING_HYDRATED_ROOT_KEY = "codedock.pendingHydrated.rootPath";

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
  yjsSync = new YjsSync(wsManager, outputChannel, context.globalState);

  emitter.on("login", () => {
    outputChannel.appendLine("CodeDock: login event received (sync-only mode)");
  });

  emitter.on("logout", () => {
    outputChannel.appendLine("CodeDock: logout event received");
    void clearPendingHydratedJoin(context);
    yjsSync.setActiveRoomId(null);
    yjsSync.setGuestMaterializationRoot(null);
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
      handleJoinRoom(context, outputChannel),
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
      void clearPendingHydratedJoin(context);
      yjsSync.setActiveRoomId(null);
      yjsSync.setGuestMaterializationRoot(null);
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

  const sessionReady = await restoreSession();

  if (sessionReady) {
    await resumePendingHydratedJoin(context, outputChannel);
  }
}

async function restoreSession(): Promise<boolean> {
  const token = await authManager.getToken();

  if (!token) {
    vscode.window.showInformationMessage(
      'CodeDock: Not logged in. Run "CodeDock: Login" to start.',
    );
    return false;
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
    return false;
  }

  vscode.window.showInformationMessage("CodeDock: Session restored.");
  return true;
}

async function handleJoinRoom(
  context: vscode.ExtensionContext,
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

  if (!hasWorkspaceRoot()) {
    const selected = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: "Use Folder for CodeDock Room",
      title: "Choose a folder where CodeDock should hydrate the host project",
    });

    if (!selected || selected.length === 0) {
      outputChannel.appendLine(
        "CodeDock: join cancelled (no guest workspace folder selected)",
      );
      return;
    }

    const destinationRoot = selected[0];
    outputChannel.appendLine(
      `CodeDock: guest materialization root set to ${destinationRoot.fsPath}`,
    );

    yjsSync.setGuestMaterializationRoot(destinationRoot);
  } else {
    yjsSync.setGuestMaterializationRoot(null);
  }

  await clearPendingHydratedJoin(context);
  await joinRoomNow(token, normalizedRoomId, outputChannel);
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

  if (!hasWorkspaceRoot()) {
    const selection = await vscode.window.showErrorMessage(
      "CodeDock: Open the project folder you want to share before creating a room.",
      "Open Folder",
    );

    if (selection === "Open Folder") {
      await vscode.commands.executeCommand("workbench.action.files.openFolder");
    }

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
    yjsSync.setActiveRoomId(room.id);
    yjsSync.setGuestMaterializationRoot(null);
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

async function joinRoomNow(
  token: string,
  roomId: string,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  outputChannel.appendLine(`CodeDock: joining room ${roomId}`);

  yjsSync.setSessionRole("guest");
  yjsSync.setActiveRoomId(roomId);
  wsManager.connect(token, roomId);
  yjsSync.activate();
}

async function resumePendingHydratedJoin(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const pendingRoomId = context.globalState.get<string>(
    PENDING_HYDRATED_ROOM_ID_KEY,
  );
  const pendingRootPath = context.globalState.get<string>(
    PENDING_HYDRATED_ROOT_KEY,
  );

  if (!pendingRoomId || !pendingRootPath) {
    return;
  }

  const currentRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!currentRoot) {
    return;
  }

  if (normalizeFsPath(currentRoot) !== normalizeFsPath(pendingRootPath)) {
    return;
  }

  const token = await authManager.getToken();
  if (!token) {
    outputChannel.appendLine(
      "CodeDock: pending hydrated project reopen found, but no valid session is available",
    );
    return;
  }

  outputChannel.appendLine(
    `CodeDock: resuming room ${pendingRoomId} in hydrated project window`,
  );

  yjsSync.setGuestMaterializationRoot(null);
  await joinRoomNow(token, pendingRoomId, outputChannel);
  await clearPendingHydratedJoin(context);
}

async function clearPendingHydratedJoin(
  context: vscode.ExtensionContext,
): Promise<void> {
  await context.globalState.update(PENDING_HYDRATED_ROOM_ID_KEY, undefined);
  await context.globalState.update(PENDING_HYDRATED_ROOT_KEY, undefined);
}

function hasWorkspaceRoot(): boolean {
  const folders = vscode.workspace.workspaceFolders;
  return Array.isArray(folders) && folders.length > 0;
}

function normalizeFsPath(fsPath: string): string {
  return path.resolve(fsPath);
}

export function deactivate(): void {
  wsManager?.disconnect("extension_deactivated");
  yjsSync?.dispose();
}