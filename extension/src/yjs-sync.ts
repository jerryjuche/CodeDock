import * as path from "path";
import * as vscode from "vscode";
import * as Y from "yjs";
import { WebSocketManager } from "./websocket";
import { encodeSyncPayload, decodeSyncPayload } from "./protocol";
import { SyncPayload } from "./types";

const OUTBOUND_BATCH_MS = 120;
const INBOUND_RECONCILE_MS = 90;
const GUEST_HYDRATION_WAIT_MS = 1200;

const LOCAL_CHANGE_ORIGIN = Symbol("codedock-local-change");
const INITIAL_DOCUMENT_ORIGIN = Symbol("codedock-initial-document");

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
  private active = false;
  private sessionRole: SessionRole = "guest";

  constructor(
    private readonly wsManager: WebSocketManager,
    private readonly outputChannel: vscode.OutputChannel,
  ) {
    this.wsManager.onMessage((data) => this.handleIncoming(data));
  }

  setSessionRole(role: SessionRole): void {
    this.sessionRole = role;
    this.log(`session role set (${role})`);
  }

  activate(): void {
    if (this.active) {
      this.log("activate skipped: already active");
      return;
    }

    this.active = true;
    this.log(`activate (${this.sessionRole})`);

    this.bindVisibleEditors();

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

  private log(message: string): void {
    this.outputChannel.appendLine(`CodeDock[sync]: ${message}`);
  }
}
