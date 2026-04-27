import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import * as Y from "yjs";
import { WebSocketManager } from "./websocket";
import {
  decodeFileBootstrapRequest,
  decodeFileBootstrapResponse,
  decodeHydrationRequest,
  decodeSyncPayload,
  decodeWorkspaceManifestRequest,
  decodeWorkspaceManifestResponse,
  encodeFileBootstrapRequest,
  encodeFileBootstrapResponse,
  encodeHydrationRequest,
  encodeSyncPayload,
  encodeWorkspaceManifestRequest,
  encodeWorkspaceManifestResponse,
  MessageType,
} from "./protocol";
import {
  FileBootstrapRequest,
  FileBootstrapResponse,
  SyncPayload,
  WorkspaceManifest,
  WorkspaceManifestEntry,
} from "./types";

const PENDING_HYDRATED_ROOM_ID_KEY = "codedock.pendingHydrated.roomId";
const PENDING_HYDRATED_ROOT_KEY = "codedock.pendingHydrated.rootPath";

const OUTBOUND_BATCH_MS = 120;
const INBOUND_RECONCILE_MS = 90;
const GUEST_HYDRATION_WAIT_MS = 1200;
const WORKSPACE_MANIFEST_RETRY_MS = 1000;
const MAX_MANIFEST_RETRIES = 6;
const MAX_BOOTSTRAP_FILE_BYTES = 400 * 1024;

const LOCAL_CHANGE_ORIGIN = Symbol("codedock-local-change");
const INITIAL_DOCUMENT_ORIGIN = Symbol("codedock-initial-document");

const IGNORED_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".codedock",
  ".vscode",
]);

const IGNORED_FILE_NAMES = new Set([
  ".DS_Store",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
]);

const TEXT_EXTENSIONS = new Set([
  ".go",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".txt",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".sh",
  ".bash",
  ".zsh",
  ".css",
  ".scss",
  ".html",
  ".xml",
  ".sql",
  ".proto",
  ".graphql",
  ".gql",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".tgz",
  ".jar",
  ".so",
  ".dll",
  ".exe",
  ".bin",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".mp4",
  ".mp3",
  ".avi",
  ".mov",
]);

type SessionRole = "host" | "guest";

type DocEntry = {
  ydoc: Y.Doc;
  initializedFromLocal: boolean;
  hasRemoteState: boolean;
};

type Binding = {
  documentChangeDisposable: vscode.Disposable;
};

type OutboundBatchState = {
  updates: Uint8Array[];
  forceFullState: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

type PatchState = {
  inFlight: boolean;
  dirty: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

export class YjsSync {
  private docs: Map<string, DocEntry> = new Map();
  private bindings: Map<string, Binding> = new Map();
  private globalDisposables: vscode.Disposable[] = [];
  private remoteApplyDepthByFile: Map<string, number> = new Map();
  private outboundBatches: Map<string, OutboundBatchState> = new Map();
  private patchStates: Map<string, PatchState> = new Map();
  private hydrationTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  private pendingFileBootstrapRequests: Set<string> = new Set();

  private workspaceManifestReceived = false;
  private workspaceManifestRetryCount = 0;
  private workspaceManifestRetryTimer?: ReturnType<typeof setTimeout>;
  private hydratedProjectOpenPromptShown = false;

  private guestMaterializationRoot: vscode.Uri | null = null;
  private currentRoomId: string | null = null;
  private active = false;
  private sessionRole: SessionRole = "guest";

  constructor(
    private readonly wsManager: WebSocketManager,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly state: vscode.Memento,
  ) {
    this.wsManager.onMessage((data) => this.handleIncoming(data));
  }

  setSessionRole(role: SessionRole): void {
    this.sessionRole = role;
    this.log(`session role set (${role})`);
  }

  setActiveRoomId(roomId: string | null): void {
    this.currentRoomId = roomId;
    this.log(`active room ${roomId ? `set (${roomId})` : "cleared"}`);
  }

  setGuestMaterializationRoot(root: vscode.Uri | null): void {
    this.guestMaterializationRoot = root;
    this.hydratedProjectOpenPromptShown = false;
    this.log(
      `guest materialization root ${root ? `set (${root.fsPath})` : "cleared"}`,
    );
  }

  activate(): void {
    if (this.active) {
      this.log("activate skipped: already active");
      return;
    }

    this.active = true;
    this.log(`activate (${this.sessionRole})`);

    this.bindVisibleEditors();

    if (this.sessionRole === "guest") {
      this.requestWorkspaceManifest();
      this.scheduleWorkspaceManifestRetry();
    }

    this.globalDisposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (!this.active) {
          return;
        }
        this.bindDocument(document);
      }),
    );

    this.globalDisposables.push(
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.unbindDocument(document);
      }),
    );

    this.globalDisposables.push(
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        if (!this.active) {
          return;
        }

        this.log(`visible editors changed: count=${editors.length}`);

        for (const editor of editors) {
          this.bindDocument(editor.document);

          const fileKey = this.getCanonicalFileKey(editor.document);
          if (!fileKey || !this.docs.has(fileKey)) {
            continue;
          }

          this.markFileDirty(fileKey);
          this.scheduleReconcile(fileKey);
        }
      }),
    );
  }

  dispose(): void {
    this.log("dispose");
    this.active = false;

    for (const disposable of this.globalDisposables) {
      disposable.dispose();
    }
    this.globalDisposables = [];

    for (const binding of this.bindings.values()) {
      binding.documentChangeDisposable.dispose();
    }
    this.bindings.clear();

    for (const batch of this.outboundBatches.values()) {
      if (batch.timer !== undefined) {
        clearTimeout(batch.timer);
      }
    }
    this.outboundBatches.clear();

    for (const patchState of this.patchStates.values()) {
      if (patchState.timer !== undefined) {
        clearTimeout(patchState.timer);
      }
    }
    this.patchStates.clear();

    for (const timer of this.hydrationTimers.values()) {
      clearTimeout(timer);
    }
    this.hydrationTimers.clear();

    if (this.workspaceManifestRetryTimer !== undefined) {
      clearTimeout(this.workspaceManifestRetryTimer);
      this.workspaceManifestRetryTimer = undefined;
    }

    this.pendingFileBootstrapRequests.clear();
    this.workspaceManifestReceived = false;
    this.workspaceManifestRetryCount = 0;
    this.hydratedProjectOpenPromptShown = false;
    this.guestMaterializationRoot = null;
    this.currentRoomId = null;

    for (const entry of this.docs.values()) {
      entry.ydoc.destroy();
    }
    this.docs.clear();

    this.remoteApplyDepthByFile.clear();
  }

  private bindVisibleEditors(): void {
    const seen = new Set<string>();

    this.log(
      `bindVisibleEditors: visibleEditors=${vscode.window.visibleTextEditors.length}`,
    );

    for (const editor of vscode.window.visibleTextEditors) {
      const fileKey = this.getCanonicalFileKey(editor.document);
      if (!fileKey || seen.has(fileKey)) {
        continue;
      }

      seen.add(fileKey);
      this.bindDocument(editor.document);
    }
  }

  private bindDocument(document: vscode.TextDocument): void {
    const fileKey = this.getCanonicalFileKey(document);
    if (!fileKey) {
      this.log(
        `bind skipped: no canonical key for uri=${document.uri.toString()}`,
      );
      return;
    }

    if (this.bindings.has(fileKey)) {
      this.log(`bind skipped: already bound (${fileKey})`);
      this.markFileDirty(fileKey);
      this.scheduleReconcile(fileKey);
      return;
    }

    this.log(`binding document (${fileKey})`);

    const entry = this.getOrCreateDocEntry(fileKey);

    if (this.sessionRole === "host") {
      this.seedFromLocalDocument(document, entry, fileKey, "host initial seed");
      this.queueForceFullState(fileKey);
    } else {
      this.log(`guest waiting for remote hydration (${fileKey})`);
      this.sendHydrationRequest(fileKey);
      this.startGuestHydrationFallback(document, entry, fileKey);
    }

    const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        const eventFileKey = this.getCanonicalFileKey(event.document);
        if (eventFileKey !== fileKey) {
          return;
        }

        if (event.contentChanges.length === 0) {
          return;
        }

        if (this.isRemoteApplyInProgress(fileKey)) {
          this.log(`local change ignored during remote apply (${fileKey})`);
          return;
        }

        if (!entry.initializedFromLocal && !entry.hasRemoteState) {
          this.seedFromLocalDocument(
            event.document,
            entry,
            fileKey,
            "guest fallback seed on local edit",
          );
          this.queueForceFullState(fileKey);
        }

        this.log(
          `local document change (${fileKey}, changes=${event.contentChanges.length})`,
        );

        const ytext = entry.ydoc.getText("content");

        entry.ydoc.transact(() => {
          for (const change of event.contentChanges) {
            const start = change.rangeOffset;
            const deleteCount = change.rangeLength;
            const insertText = change.text;

            if (deleteCount > 0) {
              ytext.delete(start, deleteCount);
            }

            if (insertText.length > 0) {
              ytext.insert(start, insertText);
            }
          }
        }, LOCAL_CHANGE_ORIGIN);
      },
    );

    this.bindings.set(fileKey, { documentChangeDisposable });

    this.markFileDirty(fileKey);
    this.scheduleReconcile(fileKey);
  }

  private unbindDocument(document: vscode.TextDocument): void {
    const fileKey = this.getCanonicalFileKey(document);
    if (!fileKey) {
      return;
    }

    const binding = this.bindings.get(fileKey);
    if (!binding) {
      return;
    }

    this.log(`unbinding document (${fileKey})`);

    binding.documentChangeDisposable.dispose();
    this.bindings.delete(fileKey);
  }

  private requestWorkspaceManifest(): void {
    const payload = encodeWorkspaceManifestRequest();

    this.log(`requesting workspace manifest (payloadBytes=${payload.length})`);
    this.wsManager.send(payload);
  }

  private scheduleWorkspaceManifestRetry(): void {
    if (this.sessionRole !== "guest" || this.workspaceManifestReceived) {
      return;
    }

    if (this.workspaceManifestRetryTimer !== undefined) {
      return;
    }

    this.workspaceManifestRetryTimer = setTimeout(() => {
      this.workspaceManifestRetryTimer = undefined;

      if (this.workspaceManifestReceived || !this.active) {
        return;
      }

      this.workspaceManifestRetryCount++;

      if (this.workspaceManifestRetryCount > MAX_MANIFEST_RETRIES) {
        this.log("workspace manifest retry limit reached");
        return;
      }

      this.log(
        `workspace manifest retry (${this.workspaceManifestRetryCount}/${MAX_MANIFEST_RETRIES})`,
      );
      this.requestWorkspaceManifest();
      this.scheduleWorkspaceManifestRetry();
    }, WORKSPACE_MANIFEST_RETRY_MS);
  }

  private startGuestHydrationFallback(
    document: vscode.TextDocument,
    entry: DocEntry,
    fileKey: string,
  ): void {
    if (this.hydrationTimers.has(fileKey)) {
      return;
    }

    const timer = setTimeout(() => {
      this.hydrationTimers.delete(fileKey);

      if (entry.hasRemoteState || entry.initializedFromLocal) {
        return;
      }

      const currentContent = document.getText();
      if (currentContent.length === 0) {
        this.log(
          `guest hydration fallback skipped: local file empty (${fileKey})`,
        );
        return;
      }

      this.seedFromLocalDocument(
        document,
        entry,
        fileKey,
        "guest hydration timeout fallback",
      );
      this.queueForceFullState(fileKey);
    }, GUEST_HYDRATION_WAIT_MS);

    this.hydrationTimers.set(fileKey, timer);
  }

  private clearHydrationTimer(fileKey: string): void {
    const timer = this.hydrationTimers.get(fileKey);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.hydrationTimers.delete(fileKey);
  }

  private seedFromLocalDocument(
    document: vscode.TextDocument,
    entry: DocEntry,
    fileKey: string,
    reason: string,
  ): void {
    if (entry.initializedFromLocal) {
      return;
    }

    const currentContent = document.getText();
    const ytext = entry.ydoc.getText("content");

    entry.ydoc.transact(() => {
      ytext.delete(0, ytext.length);

      if (currentContent.length > 0) {
        ytext.insert(0, currentContent);
      }
    }, INITIAL_DOCUMENT_ORIGIN);

    entry.initializedFromLocal = true;
    this.log(`${reason} (${fileKey}, chars=${currentContent.length})`);
  }

  private getCanonicalFileKey(document: vscode.TextDocument): string | null {
    if (document.uri.scheme !== "file") {
      return null;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return null;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    const absolutePath = document.uri.fsPath;
    const relativePath = path.relative(workspaceRoot, absolutePath);

    if (!relativePath) {
      return null;
    }

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return null;
    }

    return relativePath.replace(/\\/g, "/");
  }

  private getWorkspaceRoot(): vscode.Uri | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }

    return folders[0].uri;
  }

  private getMaterializationRoot(): vscode.Uri | null {
    const workspaceRoot = this.getWorkspaceRoot();
    if (workspaceRoot) {
      return workspaceRoot;
    }

    return this.guestMaterializationRoot;
  }

  private getOrCreateDocEntry(fileKey: string): DocEntry {
    const existing = this.docs.get(fileKey);
    if (existing) {
      return existing;
    }

    this.log(`creating Y.Doc (${fileKey})`);

    const ydoc = new Y.Doc();

    ydoc.on("update", (update: Uint8Array, origin: unknown) => {
      if (!this.active) {
        this.log("Y.Doc update ignored: sync inactive");
        return;
      }

      if (origin !== LOCAL_CHANGE_ORIGIN) {
        return;
      }

      this.log(`Y.Doc local update (${fileKey}, bytes=${update.length})`);
      this.queueOutboundUpdate(fileKey, update);
    });

    const entry: DocEntry = {
      ydoc,
      initializedFromLocal: false,
      hasRemoteState: false,
    };

    this.docs.set(fileKey, entry);
    return entry;
  }

  private queueOutboundUpdate(fileKey: string, update: Uint8Array): void {
    let state = this.outboundBatches.get(fileKey);
    if (!state) {
      state = {
        updates: [],
        forceFullState: false,
      };
      this.outboundBatches.set(fileKey, state);
    }

    state.updates.push(update);

    if (state.timer !== undefined) {
      return;
    }

    state.timer = setTimeout(() => {
      void this.flushOutboundUpdates(fileKey);
    }, OUTBOUND_BATCH_MS);
  }

  private queueForceFullState(fileKey: string): void {
    let state = this.outboundBatches.get(fileKey);
    if (!state) {
      state = {
        updates: [],
        forceFullState: false,
      };
      this.outboundBatches.set(fileKey, state);
    }

    state.forceFullState = true;

    if (state.timer !== undefined) {
      return;
    }

    state.timer = setTimeout(() => {
      void this.flushOutboundUpdates(fileKey);
    }, OUTBOUND_BATCH_MS);
  }

  private async flushOutboundUpdates(fileKey: string): Promise<void> {
    const state = this.outboundBatches.get(fileKey);
    if (!state) {
      return;
    }

    if (state.timer !== undefined) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    const entry = this.docs.get(fileKey);
    if (!entry) {
      state.updates = [];
      state.forceFullState = false;
      return;
    }

    const pendingUpdates = state.updates;
    state.updates = [];

    let updateToSend: Uint8Array | null = null;
    let mode = "incremental";

    if (this.sessionRole === "host" || state.forceFullState) {
      updateToSend = Y.encodeStateAsUpdate(entry.ydoc);
      mode = "full-state";
      state.forceFullState = false;
    } else if (pendingUpdates.length > 0) {
      updateToSend =
        pendingUpdates.length === 1
          ? pendingUpdates[0]
          : Y.mergeUpdates(pendingUpdates);
    }

    if (!updateToSend) {
      return;
    }

    const payload = encodeSyncPayload(fileKey, updateToSend);

    this.log(
      `outbound sync send (${fileKey}, mode=${mode}, mergedUpdates=${pendingUpdates.length}, updateBytes=${updateToSend.length}, payloadBytes=${payload.length})`,
    );

    this.wsManager.send(payload);
  }

  private handleIncoming(data: Uint8Array): void {
    const type = data.length > 0 ? data[0] : -1;
    this.log(`inbound frame observed (type=${type}, bytes=${data.length})`);

    switch (type) {
      case MessageType.HYDRATION_REQUEST:
        this.handleHydrationRequest(data);
        return;

      case MessageType.WORKSPACE_MANIFEST_REQUEST:
        void this.handleWorkspaceManifestRequest(data);
        return;

      case MessageType.WORKSPACE_MANIFEST_RESPONSE:
        void this.handleWorkspaceManifestResponse(data);
        return;

      case MessageType.FILE_BOOTSTRAP_REQUEST:
        void this.handleFileBootstrapRequest(data);
        return;

      case MessageType.FILE_BOOTSTRAP_RESPONSE:
        void this.handleFileBootstrapResponse(data);
        return;

      case MessageType.SYNC:
        break;

      default:
        this.log(`inbound frame ignored: unsupported type (${type})`);
        return;
    }

    const payload = decodeSyncPayload(data);
    if (!payload) {
      this.log("inbound frame ignored: decodeSyncPayload returned null");
      return;
    }

    this.log(
      `inbound sync decoded (${payload.filePath}, updateBytes=${payload.update.length})`,
    );

    void this.applyRemoteUpdate(payload);
  }

  private handleHydrationRequest(data: Uint8Array): void {
    const fileKey = decodeHydrationRequest(data);
    if (!fileKey) {
      this.log("hydration request ignored: invalid payload");
      return;
    }

    if (this.sessionRole !== "host") {
      this.log(`hydration request ignored: not host (${fileKey})`);
      return;
    }

    const entry = this.docs.get(fileKey);
    if (!entry) {
      this.log(`hydration request ignored: no doc entry (${fileKey})`);
      return;
    }

    const fullState = Y.encodeStateAsUpdate(entry.ydoc);
    const payload = encodeSyncPayload(fileKey, fullState);

    this.log(
      `responding to hydration request (${fileKey}, updateBytes=${fullState.length}, payloadBytes=${payload.length})`,
    );

    this.wsManager.send(payload);
  }

  private sendHydrationRequest(fileKey: string): void {
    const payload = encodeHydrationRequest(fileKey);

    this.log(
      `sending hydration request (${fileKey}, payloadBytes=${payload.length})`,
    );

    this.wsManager.send(payload);
  }

  private async handleWorkspaceManifestRequest(data: Uint8Array): Promise<void> {
    const request = decodeWorkspaceManifestRequest(data);
    if (!request) {
      this.log("workspace manifest request ignored: invalid payload");
      return;
    }

    if (this.sessionRole !== "host") {
      this.log("workspace manifest request ignored: not host");
      return;
    }

    const manifest = await this.buildWorkspaceManifest();
    if (!manifest) {
      this.log("workspace manifest response skipped: no workspace root");
      return;
    }

    const payload = encodeWorkspaceManifestResponse(manifest);

    this.log(
      `responding to workspace manifest request (requestedAt=${request.requestedAt}, entries=${manifest.entries.length}, payloadBytes=${payload.length})`,
    );

    this.wsManager.send(payload);
  }

  private async handleWorkspaceManifestResponse(
    data: Uint8Array,
  ): Promise<void> {
    const manifest = decodeWorkspaceManifestResponse(data);
    if (!manifest) {
      this.log("workspace manifest response ignored: invalid payload");
      return;
    }

    if (this.sessionRole !== "guest") {
      this.log("workspace manifest response ignored: not guest");
      return;
    }

    this.workspaceManifestReceived = true;
    if (this.workspaceManifestRetryTimer !== undefined) {
      clearTimeout(this.workspaceManifestRetryTimer);
      this.workspaceManifestRetryTimer = undefined;
    }

    this.log(
      `received workspace manifest (root=${manifest.rootName}, entries=${manifest.entries.length})`,
    );

    await this.materializeWorkspaceManifest(manifest);
    await this.maybeOfferOpenHydratedProject();
  }

  private async handleFileBootstrapRequest(data: Uint8Array): Promise<void> {
    const request = decodeFileBootstrapRequest(data);
    if (!request) {
      this.log("file bootstrap request ignored: invalid payload");
      return;
    }

    if (this.sessionRole !== "host") {
      this.log(`file bootstrap request ignored: not host (${request.path})`);
      return;
    }

    const rootUri = this.getWorkspaceRoot();
    if (!rootUri) {
      this.log("file bootstrap request ignored: no workspace root");
      return;
    }

    const targetUri = this.resolveWorkspacePath(rootUri, request.path);
    if (!targetUri) {
      this.log(`file bootstrap request ignored: invalid path (${request.path})`);
      return;
    }

    try {
      const bytes = await fs.readFile(targetUri.fsPath);

      if (bytes.length > MAX_BOOTSTRAP_FILE_BYTES) {
        this.log(
          `file bootstrap skipped: file too large (${request.path}, bytes=${bytes.length})`,
        );
        return;
      }

      if (!this.isProbablyTextBuffer(bytes, request.path)) {
        this.log(`file bootstrap skipped: non-text file (${request.path})`);
        return;
      }

      const response: FileBootstrapResponse = {
        path: request.path,
        content: new TextDecoder().decode(bytes),
      };

      const payload = encodeFileBootstrapResponse(response);

      this.log(
        `responding to file bootstrap request (${request.path}, payloadBytes=${payload.length})`,
      );

      this.wsManager.send(payload);
    } catch (error) {
      this.log(
        `file bootstrap request failed (${request.path}): ${this.describeError(error)}`,
      );
    }
  }

  private async handleFileBootstrapResponse(data: Uint8Array): Promise<void> {
    const response = decodeFileBootstrapResponse(data);
    if (!response) {
      this.log("file bootstrap response ignored: invalid payload");
      return;
    }

    this.pendingFileBootstrapRequests.delete(response.path);

    if (this.sessionRole !== "guest") {
      return;
    }

    const rootUri = this.getMaterializationRoot();
    if (!rootUri) {
      this.log("file bootstrap response ignored: no materialization root");
      await this.maybeOfferOpenHydratedProject();
      return;
    }

    if (this.bindings.has(response.path)) {
      this.log(
        `file bootstrap response skipped: file currently bound (${response.path})`,
      );
      await this.maybeOfferOpenHydratedProject();
      return;
    }

    const targetUri = this.resolveWorkspacePath(rootUri, response.path);
    if (!targetUri) {
      this.log(`file bootstrap response ignored: invalid path (${response.path})`);
      await this.maybeOfferOpenHydratedProject();
      return;
    }

    try {
      const existingContent = await this.readFileTextIfExists(targetUri);

      if (
        existingContent !== null &&
        existingContent.length > 0 &&
        existingContent !== response.content
      ) {
        this.log(
          `file bootstrap response skipped: local file has conflicting content (${response.path})`,
        );
      } else {
        await this.ensureParentDirectory(targetUri);
        await vscode.workspace.fs.writeFile(
          targetUri,
          new TextEncoder().encode(response.content),
        );

        this.log(
          `file bootstrap response applied (${response.path}, chars=${response.content.length})`,
        );
      }
    } catch (error) {
      this.log(
        `file bootstrap response failed (${response.path}): ${this.describeError(error)}`,
      );
    }

    await this.maybeOfferOpenHydratedProject();
  }

  private async maybeOfferOpenHydratedProject(): Promise<void> {
    if (this.sessionRole !== "guest") {
      return;
    }

    if (!this.workspaceManifestReceived) {
      return;
    }

    if (!this.guestMaterializationRoot) {
      return;
    }

    if (!this.currentRoomId) {
      return;
    }

    if (this.hydratedProjectOpenPromptShown) {
      return;
    }

    if (this.pendingFileBootstrapRequests.size > 0) {
      return;
    }

    this.hydratedProjectOpenPromptShown = true;

    const selection = await vscode.window.showInformationMessage(
      `CodeDock: Host project hydrated into ${this.guestMaterializationRoot.fsPath}. Open it in a new window?`,
      "Open in New Window",
      "Later",
    );

    if (selection !== "Open in New Window") {
      return;
    }

    await this.state.update(PENDING_HYDRATED_ROOM_ID_KEY, this.currentRoomId);
    await this.state.update(
      PENDING_HYDRATED_ROOT_KEY,
      this.guestMaterializationRoot.fsPath,
    );

    this.log(
      `opening hydrated project in new window (${this.guestMaterializationRoot.fsPath})`,
    );

    await vscode.commands.executeCommand(
      "vscode.openFolder",
      this.guestMaterializationRoot,
      true,
    );
  }

  private async buildWorkspaceManifest(): Promise<WorkspaceManifest | null> {
    const rootUri = this.getWorkspaceRoot();
    if (!rootUri) {
      return null;
    }

    const entries: WorkspaceManifestEntry[] = [];
    await this.walkWorkspace(rootUri.fsPath, rootUri.fsPath, entries);

    entries.sort((a, b) => a.path.localeCompare(b.path));

    return {
      rootName: path.basename(rootUri.fsPath),
      entries,
      generatedAt: Date.now(),
    };
  }

  private async walkWorkspace(
    rootFsPath: string,
    currentFsPath: string,
    entries: WorkspaceManifestEntry[],
  ): Promise<void> {
    const dirents = await fs.readdir(currentFsPath, { withFileTypes: true });

    dirents.sort((a, b) => a.name.localeCompare(b.name));

    for (const dirent of dirents) {
      const absolutePath = path.join(currentFsPath, dirent.name);
      const relativePath = path
        .relative(rootFsPath, absolutePath)
        .replace(/\\/g, "/");

      if (!relativePath || this.shouldIgnoreRelativePath(relativePath)) {
        continue;
      }

      if (dirent.isDirectory()) {
        entries.push({
          path: relativePath,
          kind: "dir",
        });

        await this.walkWorkspace(rootFsPath, absolutePath, entries);
        continue;
      }

      if (!dirent.isFile()) {
        continue;
      }

      const stat = await fs.stat(absolutePath);
      const isText = this.looksLikeTextPath(relativePath);

      entries.push({
        path: relativePath,
        kind: "file",
        isText,
        size: stat.size,
      });
    }
  }

  private async materializeWorkspaceManifest(
    manifest: WorkspaceManifest,
  ): Promise<void> {
    const rootUri = this.getMaterializationRoot();
    if (!rootUri) {
      this.log("workspace manifest materialization skipped: no materialization root");
      return;
    }

    const dirs = manifest.entries
      .filter((entry) => entry.kind === "dir")
      .sort((a, b) => a.path.length - b.path.length);

    for (const entry of dirs) {
      const dirUri = this.resolveWorkspacePath(rootUri, entry.path);
      if (!dirUri) {
        continue;
      }

      await vscode.workspace.fs.createDirectory(dirUri);
    }

    const files = manifest.entries.filter((entry) => entry.kind === "file");

    for (const entry of files) {
      const fileUri = this.resolveWorkspacePath(rootUri, entry.path);
      if (!fileUri) {
        continue;
      }

      await this.ensureParentDirectory(fileUri);

      const exists = await this.fileExists(fileUri);

      if (!exists && entry.isText) {
        await vscode.workspace.fs.writeFile(fileUri, new Uint8Array());
      }

      if (entry.isText) {
        const alreadyBound = this.bindings.has(entry.path);
        if (!alreadyBound) {
          this.requestFileBootstrap(entry.path);
        }
      }
    }

    this.log(
      `workspace manifest materialized (dirs=${dirs.length}, files=${files.length})`,
    );
  }

  private requestFileBootstrap(filePath: string): void {
    if (this.pendingFileBootstrapRequests.has(filePath)) {
      return;
    }

    this.pendingFileBootstrapRequests.add(filePath);

    const request: FileBootstrapRequest = { path: filePath };
    const payload = encodeFileBootstrapRequest(request);

    this.log(
      `requesting file bootstrap (${filePath}, payloadBytes=${payload.length})`,
    );

    this.wsManager.send(payload);
  }

  private resolveWorkspacePath(
    rootUri: vscode.Uri,
    relativePath: string,
  ): vscode.Uri | null {
    const normalized = relativePath.replace(/\\/g, "/");

    if (
      normalized.length === 0 ||
      normalized.startsWith("/") ||
      path.isAbsolute(normalized)
    ) {
      return null;
    }

    const segments = normalized.split("/").filter(Boolean);
    if (segments.length === 0 || segments.some((segment) => segment === "..")) {
      return null;
    }

    return vscode.Uri.joinPath(rootUri, ...segments);
  }

  private shouldIgnoreRelativePath(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, "/");
    const segments = normalized.split("/").filter(Boolean);
    const basename = segments[segments.length - 1] ?? "";

    if (segments.some((segment) => IGNORED_DIR_NAMES.has(segment))) {
      return true;
    }

    if (IGNORED_FILE_NAMES.has(basename)) {
      return true;
    }

    return false;
  }

  private looksLikeTextPath(relativePath: string): boolean {
    const basename = path.basename(relativePath);
    if (IGNORED_FILE_NAMES.has(basename)) {
      return false;
    }

    const ext = path.extname(relativePath).toLowerCase();

    if (BINARY_EXTENSIONS.has(ext)) {
      return false;
    }

    if (TEXT_EXTENSIONS.has(ext)) {
      return true;
    }

    return ext === "";
  }

  private isProbablyTextBuffer(
    buffer: Uint8Array,
    relativePath: string,
  ): boolean {
    if (!this.looksLikeTextPath(relativePath)) {
      return false;
    }

    const sampleLength = Math.min(buffer.length, 8192);
    for (let i = 0; i < sampleLength; i++) {
      if (buffer[i] === 0) {
        return false;
      }
    }

    return true;
  }

  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureParentDirectory(fileUri: vscode.Uri): Promise<void> {
    const parentDir = path.dirname(fileUri.fsPath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(parentDir));
  }

  private async readFileTextIfExists(uri: vscode.Uri): Promise<string | null> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

  private async applyRemoteUpdate(payload: SyncPayload): Promise<void> {
    const { filePath: fileKey, update } = payload;

    this.log(`apply remote update (${fileKey}, bytes=${update.length})`);

    const entry = this.getOrCreateDocEntry(fileKey);
    entry.hasRemoteState = true;
    this.clearHydrationTimer(fileKey);

    Y.applyUpdate(entry.ydoc, update);

    this.markFileDirty(fileKey);
    this.scheduleReconcile(fileKey);
  }

  private getPatchState(fileKey: string): PatchState {
    let state = this.patchStates.get(fileKey);
    if (!state) {
      state = {
        inFlight: false,
        dirty: false,
      };
      this.patchStates.set(fileKey, state);
    }
    return state;
  }

  private markFileDirty(fileKey: string): void {
    this.getPatchState(fileKey).dirty = true;
  }

  private scheduleReconcile(fileKey: string): void {
    const state = this.getPatchState(fileKey);

    if (state.timer !== undefined || state.inFlight) {
      return;
    }

    state.timer = setTimeout(() => {
      state.timer = undefined;
      void this.reconcileFile(fileKey);
    }, INBOUND_RECONCILE_MS);
  }

  private async reconcileFile(fileKey: string): Promise<void> {
    const state = this.getPatchState(fileKey);

    if (state.inFlight) {
      return;
    }

    state.inFlight = true;

    try {
      while (state.dirty) {
        state.dirty = false;

        const entry = this.docs.get(fileKey);
        if (!entry) {
          return;
        }

        const visibleEditorKeys = vscode.window.visibleTextEditors
          .map((editor) => this.getCanonicalFileKey(editor.document))
          .filter((key): key is string => Boolean(key));

        const editor = vscode.window.visibleTextEditors.find(
          (candidate) =>
            this.getCanonicalFileKey(candidate.document) === fileKey,
        );

        if (!editor) {
          this.log(
            `reconcile skipped: no visible editor for (${fileKey}), visible=[${visibleEditorKeys.join(", ")}]`,
          );
          return;
        }

        const ytext = entry.ydoc.getText("content");
        const newContent = ytext.toString();
        const currentContent = editor.document.getText();

        if (newContent === currentContent) {
          this.log(`reconcile skipped: content already matches (${fileKey})`);
          continue;
        }

        this.log(
          `patching editor (${fileKey}, oldChars=${currentContent.length}, newChars=${newContent.length})`,
        );

        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(currentContent.length),
        );

        this.beginRemoteApply(fileKey);

        try {
          const applied = await editor.edit(
            (editBuilder) => {
              editBuilder.replace(fullRange, newContent);
            },
            {
              undoStopBefore: false,
              undoStopAfter: false,
            },
          );

          this.log(
            `patch result (${fileKey}) -> ${applied ? "applied" : "failed"}`,
          );
        } finally {
          this.endRemoteApply(fileKey);
        }
      }
    } finally {
      state.inFlight = false;

      if (state.dirty) {
        this.scheduleReconcile(fileKey);
      }
    }
  }

  private isRemoteApplyInProgress(fileKey: string): boolean {
    return (this.remoteApplyDepthByFile.get(fileKey) ?? 0) > 0;
  }

  private beginRemoteApply(fileKey: string): void {
    const currentDepth = this.remoteApplyDepthByFile.get(fileKey) ?? 0;
    this.remoteApplyDepthByFile.set(fileKey, currentDepth + 1);
  }

  private endRemoteApply(fileKey: string): void {
    const currentDepth = this.remoteApplyDepthByFile.get(fileKey) ?? 0;

    if (currentDepth <= 1) {
      this.remoteApplyDepthByFile.delete(fileKey);
      return;
    }

    this.remoteApplyDepthByFile.set(fileKey, currentDepth - 1);
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : "unknown error";
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`CodeDock[sync]: ${message}`);
  }
}