import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { EventEmitter } from "events";
import { AuthManager } from "./auth";
import { ApiClient, LaunchContext } from "./api";
import { WebSocketManager } from "./websocket";
import { YjsSync } from "./yjs-sync";
import { ensureGitRepo } from "./git";

const PENDING_HYDRATED_ROOM_ID_KEY = "codedock.pendingHydrated.roomId";
const PENDING_HYDRATED_ROOT_KEY = "codedock.pendingHydrated.rootPath";
const PENDING_LAUNCH_CONTEXT_KEY = "codedock.pendingLaunch.context";

type PendingLaunchContext = LaunchContext & {
  workspace_fs_path: string;
};

let authManager: AuthManager;
let wsManager: WebSocketManager;
let yjsSync: YjsSync;
let apiClient: ApiClient;
let statusBarItem: vscode.StatusBarItem | undefined;

function refreshStatusBar(): void {
  if (!statusBarItem) {
    return;
  }

  const connectionState = wsManager?.getConnectionState?.() ?? "disconnected";
  const roomId = wsManager?.getRoomId?.();
  const roomLabel = roomId ? ` • ${roomId.slice(0, 8)}` : "";

  statusBarItem.text = roomId
    ? `$(rocket) CodeDock ${connectionState}${roomLabel}`
    : "$(rocket) CodeDock";
  statusBarItem.tooltip = roomId
    ? `CodeDock — ${connectionState.toUpperCase()}${roomLabel}\nClick for room and web app actions`
    : `CodeDock — ${connectionState.toUpperCase()}\nClick for room and web app actions`;
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("codedock");
  const serverUrl = config.get<string>("serverUrl", "https://codedock.fly.dev");
  const webAppUrl = config.get<string>(
    "webAppUrl",
    "https://codedockapp.vercel.app/",
  );

  const outputChannel = vscode.window.createOutputChannel("CodeDock");
  context.subscriptions.push(outputChannel);

  const emitter = new EventEmitter();

  apiClient = new ApiClient(serverUrl);
  authManager = new AuthManager(context.secrets, apiClient, emitter);
  wsManager = new WebSocketManager(serverUrl, outputChannel);
  yjsSync = new YjsSync(wsManager, outputChannel, context.globalState);

  context.subscriptions.push(
    wsManager.onClose((code, reason) => {
      const sessionEnded =
        code === 4004 ||
        code === 4003 ||
        reason === "room_deleted" ||
        reason === "room_unavailable" ||
        reason === "forbidden";

      if (!sessionEnded) {
        return;
      }

      outputChannel.appendLine(
        `CodeDock: room session terminated by server (code=${code}, reason=${reason || "none"})`,
      );

      void clearPendingHydratedJoin(context);
      void clearPendingLaunch(context);
      yjsSync.setActiveRoomId(null);
      yjsSync.setGuestMaterializationRoot(null);
      yjsSync.dispose();
      refreshStatusBar();
    }),
  );

  emitter.on("login", () => {
    outputChannel.appendLine("CodeDock: login event received");
  });

  emitter.on("logout", () => {
    outputChannel.appendLine("CodeDock: logout event received");
    void cleanupActiveRoomState(context);
    wsManager.disconnect("logout");
    yjsSync.dispose();
    refreshStatusBar();
  });

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "codedock.showMenu";
  statusBarItem.text = "$(rocket) CodeDock";
  statusBarItem.tooltip =
    "CodeDock — click for session actions and web app access";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  refreshStatusBar();

  async function showCodeDockMenu(): Promise<void> {
    const options = [
      {
        label: "$(browser) Open CodeDock Web App",
        description: webAppUrl,
        command: "codedock.openWebApp",
      },
      {
        label: "$(sign-in) Login / Reauthenticate",
        description: "Sign in to CodeDock",
        command: "codedock.login",
      },
      {
        label: "$(link-external) Join Room",
        description: "Enter an existing room ID",
        command: "codedock.joinRoom",
      },
      {
        label: "$(add) Create Room",
        description: "Create a new collaborative room",
        command: "codedock.createRoom",
      },
      {
        label: "$(debug) Show CodeDock Logs",
        description: "Open the CodeDock output channel",
        command: "codedock.openLogs",
      },
      {
        label: "$(sign-out) Disconnect Room",
        description: "Leave the current collaboration session",
        command: "codedock.disconnectRoom",
      },
    ];

    const selection = await vscode.window.showQuickPick(options, {
      placeHolder: "Choose a CodeDock action",
      ignoreFocusOut: true,
    });

    if (!selection) {
      return;
    }

    await vscode.commands.executeCommand(selection.command);
  }

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
        "CodeDock Chat is not available in this build yet.",
      ),
    ),
    vscode.commands.registerCommand("codedock.disconnectRoom", () => {
      outputChannel.appendLine("CodeDock: user requested room disconnect");
      void cleanupActiveRoomState(context);
      wsManager.disconnect("user");
      yjsSync.dispose();
      refreshStatusBar();
    }),
    vscode.commands.registerCommand("codedock.openWebApp", async () => {
      await vscode.env.openExternal(vscode.Uri.parse(webAppUrl));
    }),
    vscode.commands.registerCommand("codedock.openLogs", () => {
      outputChannel.show(true);
    }),
    vscode.commands.registerCommand("codedock.showMenu", showCodeDockMenu),
  );

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri): Promise<void> {
        await handleLaunchUri(context, uri, outputChannel);
      },
    }),
  );

  refreshStatusBar();

  await restoreSession();
  await resumePendingLaunch(context, outputChannel);
}

async function restoreSession(): Promise<void> {
  const token = await authManager.getToken();

  if (!token) {
    return;
  }

  await authManager.validateToken();
}

function extractLaunchTokenFromUriPath(path: string): string | null {
  const cleanedPath = path.startsWith("/") ? path.slice(1) : path;
  const prefix = "launch/";
  if (!cleanedPath.startsWith(prefix)) {
    return null;
  }
  const encodedToken = cleanedPath.slice(prefix.length);
  if (!encodedToken) {
    return null;
  }
  try {
    return decodeURIComponent(encodedToken);
  } catch {
    return encodedToken;
  }
}

function extractLaunchTokenFromUriFragment(fragment: string): string | null {
  if (!fragment) {
    return null;
  }

  const params = new URLSearchParams(fragment);
  const token = params.get("token");
  if (token) {
    return token;
  }

  return fragment || null;
}

async function handleLaunchUri(
  context: vscode.ExtensionContext,
  uri: vscode.Uri,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  outputChannel.appendLine(`URI received: ${uri.toString()}`);

  const params = new URLSearchParams(uri.query);
  const launchToken =
    params.get("token") ||
    extractLaunchTokenFromUriPath(uri.path) ||
    extractLaunchTokenFromUriFragment(uri.fragment);
  const legacyCode = params.get("code");
  const legacyRoomId = params.get("room_id");

  outputChannel.appendLine(`uri.scheme: ${uri.scheme}`);
  outputChannel.appendLine(`uri.authority: ${uri.authority}`);
  outputChannel.appendLine(`uri.path: ${uri.path}`);
  outputChannel.appendLine(`uri.query: ${uri.query}`);
  outputChannel.appendLine(`uri.fragment: ${uri.fragment}`);
  outputChannel.appendLine(`token: ${launchToken ?? "null"}`);
  outputChannel.appendLine(`code: ${legacyCode ?? "null"}`);
  outputChannel.appendLine(`room_id: ${legacyRoomId ?? "null"}`);

  if (!launchToken) {
    vscode.window.showErrorMessage(
      "CodeDock: This launch link is missing its token.",
    );
    return;
  }

  try {
    const launchContext = await apiClient.exchangeLaunchToken(launchToken);

    if (launchContext.auth_token) {
      await authManager.storeTokenSilently(launchContext.auth_token);
      outputChannel.appendLine(
        "CodeDock: stored auth token from launch exchange",
      );
    }

    // Determine target fs path (guests and git repos have a predefined managed path)
    let workspaceFsPath = "";
    const isActuallyHost =
      launchContext.role !== "editor" || !launchContext.workspace_path_hint;

    if (launchContext.source_type === "github_repo" || !isActuallyHost) {
      // Validate room_slug to prevent path traversal
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(launchContext.room_slug)) {
        throw new Error(`Invalid room slug: "${launchContext.room_slug}". Slugs must be alphanumeric and contain no path traversal characters.`);
      }
      const baseDir = path.join(os.homedir(), ".codedock", "rooms");
      workspaceFsPath = path.join(baseDir, launchContext.room_slug);
    }

    const pending: PendingLaunchContext = {
      ...launchContext,
      workspace_fs_path: workspaceFsPath,
    };

    await context.globalState.update(PENDING_LAUNCH_CONTEXT_KEY, pending);

    const currentRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    outputChannel.appendLine(
      `CodeDock: [DEBUG] launch context: ${JSON.stringify(launchContext)}`,
    );

    if (currentRoot) {
      // Folder is open, isolate launch by opening a new blank window/workspace
      outputChannel.appendLine(
        "CodeDock: [LAUNCH] Folder is currently open. Opening a new blank workspace window to isolate launch.",
      );
      await vscode.commands.executeCommand("workbench.action.newWindow");
      return;
    }

    // Already in a blank workspace, resume directly
    outputChannel.appendLine(
      "CodeDock: [LAUNCH] Already in a blank workspace. Resuming directly.",
    );
    await resumePendingLaunch(context, outputChannel);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown error";
    outputChannel.appendLine(
      `CodeDock: launch exchange failed -> ${errorMessage}`,
    );

    if (errorMessage.includes("Unexpected HTML response")) {
      vscode.window.showErrorMessage(
        `CodeDock: Launch failed — Incorrect server URL. Verify your codedock.serverUrl is pointed at the backend server.`,
      );
      return;
    }

    vscode.window.showErrorMessage(`CodeDock: Launch failed — ${errorMessage}`);
  }
}

async function resumePendingLaunch(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const pending = context.globalState.get<PendingLaunchContext>(
    PENDING_LAUNCH_CONTEXT_KEY,
  );

  if (!pending) {
    return;
  }

  const currentRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const isHostLike = pending.role !== "editor";

  // Case 1: No Folder is Open (Blank Workspace Window)
  if (!currentRoot) {
    if (isHostLike && pending.source_type === "local_workspace") {
      outputChannel.appendLine(
        "CodeDock: host launch pending in blank workspace, prompting for folder...",
      );
      
      const selection = await vscode.window.showInformationMessage(
        `CodeDock: You are the host of "${pending.room_name}". Please select the folder you want to share.`,
        "Select Folder",
        "Cancel"
      );

      if (selection === "Select Folder") {
        const selected = await vscode.window.showOpenDialog({
          canSelectMany: false,
          canSelectFiles: false,
          canSelectFolders: true,
          openLabel: "Share Folder",
          title: `Select folder to share with room "${pending.room_name}"`,
        });

        if (selected && selected.length > 0) {
          const selectedFolderUri = selected[0];
          pending.workspace_fs_path = selectedFolderUri.fsPath;
          await context.globalState.update(PENDING_LAUNCH_CONTEXT_KEY, pending);

          outputChannel.appendLine(
            `CodeDock: Opening selected folder: ${selectedFolderUri.fsPath}`
          );

          await vscode.commands.executeCommand("vscode.openFolder", selectedFolderUri, {
            forceReuseWindow: true,
          });
        } else {
          outputChannel.appendLine("CodeDock: Folder selection cancelled by user.");
          await clearPendingLaunch(context);
        }
      } else {
        outputChannel.appendLine("CodeDock: Launch cancelled by user.");
        await clearPendingLaunch(context);
      }
    } else {
      // GitHub repo or Guest of local workspace - we must prepare/clone under progress
      outputChannel.appendLine(
        `CodeDock: Blank workspace. Initializing managed folder for ${pending.source_type}...`
      );

      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: pending.source_type === "github_repo"
            ? "CodeDock: Cloning GitHub repository..."
            : "CodeDock: Preparing workspace...",
          cancellable: false
        }, async (progress) => {
          progress.report({ message: "Cloning files and setting up configurations..." });
          await ensureManagedWorkspace(pending, outputChannel);
        });

        const workspaceUri = vscode.Uri.file(pending.workspace_fs_path);
        outputChannel.appendLine(
          `CodeDock: Opening prepared workspace folder: ${workspaceUri.fsPath}`
        );

        await vscode.commands.executeCommand("vscode.openFolder", workspaceUri, {
          forceReuseWindow: true,
        });
      } catch (err) {
        vscode.window.showErrorMessage(
          `CodeDock: Failed to prepare workspace — ${
            err instanceof Error ? err.message : "unknown error"
          }`
        );
        await clearPendingLaunch(context);
      }
    }
    return;
  }

  // Case 2: Folder is Open
  if (
    normalizeFsPath(currentRoot) !== normalizeFsPath(pending.workspace_fs_path)
  ) {
    if (isHostLike && pending.source_type === "local_workspace") {
      outputChannel.appendLine(
        `CodeDock: host opened different folder (${currentRoot}), asking to bind...`,
      );
      const selection = await vscode.window.showInformationMessage(
        `CodeDock: Do you want to share the current folder ("${path.basename(currentRoot)}") with room "${pending.room_name}"?`,
        "Yes, Share Folder",
        "No",
      );
      if (selection === "Yes, Share Folder") {
        pending.workspace_fs_path = currentRoot;
        await context.globalState.update(PENDING_LAUNCH_CONTEXT_KEY, pending);
      } else {
        await clearPendingLaunch(context);
        return;
      }
    } else {
      outputChannel.appendLine(
        "CodeDock: current workspace does not match pending launch root",
      );
      return;
    }
  }

  const token = await authManager.getToken();
  if (!token) {
    vscode.window.showErrorMessage(
      "CodeDock: No auth session found for this launch. Please log in again.",
    );
    return;
  }

  // Ensure backend knows we are bound if we are the host
  if (
    isHostLike &&
    (pending.source_type === "local_workspace" ||
      pending.source_type === "github_repo")
  ) {
    try {
      await apiClient.bindLocalWorkspace(
        token,
        pending.room_id,
        path.basename(currentRoot),
      );
      outputChannel.appendLine(
        `CodeDock: ensured room ${pending.room_id} is bound to ${currentRoot}`,
      );
    } catch (err) {
      outputChannel.appendLine(
        `CodeDock: bindLocalWorkspace warning -> ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    }
  }

  outputChannel.appendLine(
    `CodeDock: resuming launched room ${pending.room_id} (${pending.role})`,
  );

  // Re-verify workspace state (cloning, metadata) during resume
  try {
    await ensureManagedWorkspace(pending, outputChannel);
  } catch (err) {
    vscode.window.showErrorMessage(
      `CodeDock: Resume failed — ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    );
    return;
  }

  yjsSync.setGuestMaterializationRoot(null);
  yjsSync.setActiveRoomId(pending.room_id);
  yjsSync.setSessionRole(isHostLike ? "host" : "guest");

  wsManager.connect(token, pending.room_id);
  yjsSync.activate();

  await clearPendingLaunch(context);

  vscode.window.showInformationMessage(
    `CodeDock: Connected to "${pending.room_name}".`,
  );
}

async function ensureManagedWorkspace(
  launchContext: LaunchContext,
  outputChannel: vscode.OutputChannel,
): Promise<vscode.Uri> {
  // Validate room_slug to prevent path traversal
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(launchContext.room_slug)) {
    throw new Error(`Invalid room slug: "${launchContext.room_slug}". Slugs must be alphanumeric and contain no path traversal characters.`);
  }

  const baseDir = path.join(os.homedir(), ".codedock", "rooms");
  const roomDir = path.join(baseDir, launchContext.room_slug);

  await fs.mkdir(roomDir, { recursive: true });

  outputChannel.appendLine(
    `CodeDock: ensuring workspace ${roomDir} (source=${launchContext.source_type})`,
  );

  if (launchContext.source_type === "github_repo") {
    const meta = launchContext.source_metadata as {
      repo_owner?: string;
      repo_name?: string;
      branch?: string;
    };

    if (meta.repo_owner && meta.repo_name) {
      const repoUrl = `https://github.com/${meta.repo_owner}/${meta.repo_name}.git`;
      const branch = meta.branch || "main";
      try {
        await ensureGitRepo(repoUrl, branch, roomDir, outputChannel);
      } catch (err) {
        throw new Error(
          `Failed to clone GitHub repository: ${
            err instanceof Error ? err.message : "unknown error"
          }`,
        );
      }
    } else {
      outputChannel.appendLine(
        "CodeDock[git]: skipping clone, missing repo_owner or repo_name in metadata",
      );
    }
  }

  const metadataPath = path.join(roomDir, ".codedock-room.json");
  const metadata = {
    roomId: launchContext.room_id,
    roomName: launchContext.room_name,
    roomSlug: launchContext.room_slug,
    sourceType: launchContext.source_type,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

  outputChannel.appendLine(`CodeDock: ensured managed workspace ${roomDir}`);

  return vscode.Uri.file(roomDir);
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
    refreshStatusBar();
  } catch (err) {
    vscode.window.showErrorMessage(
      `CodeDock: Failed to create a room — ${
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
  refreshStatusBar();
}

async function cleanupActiveRoomState(
  context: vscode.ExtensionContext,
): Promise<void> {
  await clearPendingHydratedJoin(context);
  await clearPendingLaunch(context);
  yjsSync.setActiveRoomId(null);
  yjsSync.setGuestMaterializationRoot(null);
}

async function clearPendingHydratedJoin(
  context: vscode.ExtensionContext,
): Promise<void> {
  await context.globalState.update(PENDING_HYDRATED_ROOM_ID_KEY, undefined);
  await context.globalState.update(PENDING_HYDRATED_ROOT_KEY, undefined);
}

async function clearPendingLaunch(
  context: vscode.ExtensionContext,
): Promise<void> {
  await context.globalState.update(PENDING_LAUNCH_CONTEXT_KEY, undefined);
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
