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
  launch_token: string;
  auth_token?: string;
};

const activeLaunchTokens = new Set<string>();
let statusBarItem: vscode.StatusBarItem | null = null;

let authManager: AuthManager;
let wsManager: WebSocketManager;
let yjsSync: YjsSync;
let apiClient: ApiClient;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("codedock");
  const serverUrl = config.get<string>("serverUrl", "https://codedock.fly.dev");

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
        "CodeDock Chat is not available in this build yet.",
      ),
    ),
    vscode.commands.registerCommand("codedock.openWebApp", async () => {
      const url = vscode.workspace
        .getConfiguration("codedock")
        .get<string>("webAppUrl", "https://codedock.fly.dev");
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),
    vscode.commands.registerCommand("codedock.disconnectRoom", () => {
      outputChannel.appendLine("CodeDock: user requested room disconnect");
      void cleanupActiveRoomState(context);
      wsManager.disconnect("user");
      yjsSync.dispose();
    }),
  );

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri): Promise<void> {
        await handleLaunchUri(context, uri, outputChannel);
      },
    }),
  );

  const statusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusItem.command = "codedock.openWebApp";
  statusItem.text = "$(extensions) CodeDock";
  statusItem.tooltip = "Open the CodeDock web app";
  statusItem.show();
  context.subscriptions.push(statusItem);
  statusBarItem = statusItem;

  const autoUpdate = config.get<boolean>("autoUpdate", true);
  const updateCheckIntervalMinutes = Math.max(
    1,
    config.get<number>("updateCheckIntervalMinutes", 60),
  );

  if (autoUpdate) {
    await checkForExtensionUpdate(context, config, statusItem);
    const intervalHandle = setInterval(() => {
      void checkForExtensionUpdate(context, config, statusItem);
    }, updateCheckIntervalMinutes * 60_000);
    context.subscriptions.push({
      dispose: () => clearInterval(intervalHandle),
    });
  }

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

async function checkForExtensionUpdate(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
  statusBarItem: vscode.StatusBarItem,
): Promise<void> {
  const autoUpdate = config.get<boolean>("autoUpdate", true);
  const currentVersion = context.extension.packageJSON.version as string;
  const lastPrompted = context.globalState.get<string>(
    "codedock.lastUpdatePromptedVersion",
  );

  if (!autoUpdate) {
    statusBarItem.text = "$(extensions) CodeDock";
    statusBarItem.tooltip = "Open the CodeDock web app";
    return;
  }

  try {
    const release = await fetchLatestRelease();
    if (!release?.tag_name) {
      statusBarItem.text = "$(extensions) CodeDock";
      statusBarItem.tooltip = "Open the CodeDock web app";
      return;
    }

    const latestVersion = release.tag_name.replace(/^v/i, "");
    const isNewer = compareVersions(latestVersion, currentVersion);

    if (!isNewer) {
      statusBarItem.text = "$(extensions) CodeDock";
      statusBarItem.tooltip = "Open the CodeDock web app";
      return;
    }

    statusBarItem.text = "$(warning) CodeDock Update";
    statusBarItem.tooltip = `CodeDock update available (${release.tag_name})`;
    if (lastPrompted === release.tag_name) {
      return;
    }

    const selection = await vscode.window.showInformationMessage(
      `A new CodeDock extension release ${release.tag_name} is available.`,
      "Install Update",
      "View Release",
      "Later",
    );

    if (selection === "Install Update") {
      await vscode.env.openExternal(
        vscode.Uri.parse(
          "https://marketplace.visualstudio.com/items?itemName=jerryjuche.codedock",
        ),
      );
    } else if (selection === "View Release") {
      await vscode.env.openExternal(
        vscode.Uri.parse(
          release.html_url ??
            "https://github.com/jerryjuche/CodeDock/releases/latest",
        ),
      );
    }

    await context.globalState.update(
      "codedock.lastUpdatePromptedVersion",
      release.tag_name,
    );
  } catch (error) {
    console.error(
      "CodeDock: update check failed",
      error instanceof Error ? error.message : error,
    );
    statusBarItem.text = "$(extensions) CodeDock";
    statusBarItem.tooltip = "Open the CodeDock web app";
  }
}

async function fetchLatestRelease(): Promise<{
  tag_name?: string;
  html_url?: string;
}> {
  const response = await fetch(
    "https://api.github.com/repos/jerryjuche/CodeDock/releases/latest",
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "CodeDock-VSCode-Extension",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub release check failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    tag_name?: string;
    html_url?: string;
  };

  return data;
}

function compareVersions(latest: string, current: string): boolean {
  const toParts = (value: string) =>
    value
      .split(/[.-]/g)
      .map((part) => parseInt(part.replace(/[^0-9]/g, ""), 10) || 0);

  const latestParts = toParts(latest);
  const currentParts = toParts(current);
  const maxLength = Math.max(latestParts.length, currentParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const latestPart = latestParts[i] ?? 0;
    const currentPart = currentParts[i] ?? 0;
    if (latestPart > currentPart) {
      return true;
    }
    if (latestPart < currentPart) {
      return false;
    }
  }

  return false;
}

async function handleLaunchUri(
  context: vscode.ExtensionContext,
  uri: vscode.Uri,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  outputChannel.appendLine(`URI received: ${uri.toString()}`);

  const params = new URLSearchParams(uri.query);
  const launchToken = params.get("token");
  const serverUrl = params.get("server_url");
  const legacyCode = params.get("code");
  const legacyRoomId = params.get("room_id");

  outputChannel.appendLine(`token: ${launchToken ?? "null"}`);
  outputChannel.appendLine(`server_url: ${serverUrl ?? "null"}`);
  outputChannel.appendLine(`code: ${legacyCode ?? "null"}`);
  outputChannel.appendLine(`room_id: ${legacyRoomId ?? "null"}`);

  if (serverUrl) {
    apiClient.setBaseUrl(serverUrl);
    wsManager.setServerUrl(serverUrl);
    outputChannel.appendLine(`CodeDock: using launch server URL ${serverUrl}`);
  }

  if (!launchToken) {
    vscode.window.showErrorMessage(
      "CodeDock: This launch link is missing its token.",
    );
    return;
  }

  const storedPending = context.globalState.get<PendingLaunchContext>(
    PENDING_LAUNCH_CONTEXT_KEY,
  );

  if (storedPending?.launch_token === launchToken) {
    outputChannel.appendLine(
      "CodeDock: duplicate launch URI received; resuming existing pending launch.",
    );
    await resumePendingLaunch(context, outputChannel);
    return;
  }

  if (activeLaunchTokens.has(launchToken)) {
    outputChannel.appendLine(
      "CodeDock: launch token exchange already in progress; ignoring duplicate URI.",
    );
    return;
  }

  activeLaunchTokens.add(launchToken);
  try {
    const launchContext = await apiClient.exchangeLaunchToken(launchToken);

    if (launchContext.auth_token) {
      await authManager.storeTokenSilently(launchContext.auth_token);
      outputChannel.appendLine(
        "CodeDock: stored auth token from launch exchange",
      );
    }

    const workspaceUri = await ensureManagedWorkspace(
      launchContext,
      outputChannel,
    );
    const pending: PendingLaunchContext = {
      ...launchContext,
      workspace_fs_path: workspaceUri.fsPath,
      launch_token: launchToken,
      auth_token: launchContext.auth_token,
    };

    await context.globalState.update(PENDING_LAUNCH_CONTEXT_KEY, pending);

    const currentRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // PROFESSIONAL DEBUGGING: Log full context
    outputChannel.appendLine(
      `CodeDock: [DEBUG] launch context: ${JSON.stringify(launchContext)}`,
    );

    // Special behavior for host + local_workspace: stay in current window (even if blank) and prompt via resume
    // We treat ANY role that is not explicitly "editor" AS HOST
    // ALSO: If it's a local_workspace and there is NO path hint, it's almost certainly a fresh host setup.
    const isActuallyHost =
      launchContext.role !== "editor" || !launchContext.workspace_path_hint;

    if (launchContext.source_type === "local_workspace" && isActuallyHost) {
      outputChannel.appendLine(
        "CodeDock: [LAUNCH] host + local_workspace detected. skipping automatic openFolder to allow manual selection.",
      );
      outputChannel.appendLine(
        "IMPORTANT: If you don't see the 'Open Folder' prompt, please RELOAD VS Code to ensure the latest extension build is active.",
      );
      await resumePendingLaunch(context, outputChannel);
      return;
    }

    if (
      currentRoot &&
      normalizeFsPath(currentRoot) === normalizeFsPath(workspaceUri.fsPath)
    ) {
      outputChannel.appendLine(
        "CodeDock: launch workspace already open, resuming directly",
      );
      await resumePendingLaunch(context, outputChannel);
      return;
    }

    outputChannel.appendLine(
      `CodeDock: opening managed workspace (${workspaceUri.fsPath})`,
    );

    await vscode.commands.executeCommand(
      "vscode.openFolder",
      workspaceUri,
      true,
    );
  } catch (error) {
    outputChannel.appendLine(
      `CodeDock: launch exchange failed -> ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    vscode.window.showErrorMessage(
      `CodeDock: Launch failed — ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  } finally {
    activeLaunchTokens.delete(launchToken);
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

  if (!currentRoot) {
    if (isHostLike && pending.source_type === "local_workspace") {
      outputChannel.appendLine(
        "CodeDock: host launch pending but no folder open, prompting...",
      );
      const selection = await vscode.window.showInformationMessage(
        `CodeDock: You are the host of "${pending.room_name}". Please open the project folder you want to share.`,
        "Open Folder",
      );
      if (selection === "Open Folder") {
        await vscode.commands.executeCommand("vscode.openFolder");
      }
    } else {
      outputChannel.appendLine(
        "CodeDock: pending launch found but no workspace root is open",
      );
    }
    return;
  }

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
      } else {
        return;
      }
    } else {
      outputChannel.appendLine(
        "CodeDock: current workspace does not match pending launch root",
      );
      return;
    }
  }

  let token = await authManager.getToken();
  if (!token && pending.auth_token) {
    await authManager.storeTokenSilently(pending.auth_token);
    token = pending.auth_token;
    outputChannel.appendLine(
      "CodeDock: restored auth token from pending launch context",
    );
  }

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
