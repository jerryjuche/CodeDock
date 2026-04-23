import * as path from "path";
import * as vscode from "vscode";
import * as Y from "yjs";
import { WebSocketManager } from "./websocket";
import { encodeSyncPayload, decodeSyncPayload } from "./protocol";
import { debounce } from "./utils";
import { SyncPayload } from "./types";

const DEBOUNCE_MS = 200;

const LOCAL_CHANGE_ORIGIN = Symbol("codedock-local-change");
const INITIAL_DOCUMENT_ORIGIN = Symbol("codedock-initial-document");

type DocEntry = {
  ydoc: Y.Doc;
  initializedFromLocal: boolean;
  hasRemoteState: boolean;
};

type Binding = {
  documentChangeDisposable: vscode.Disposable;
};

export class YjsSync {
  private docs: Map<string, DocEntry> = new Map();
  private bindings: Map<string, Binding> = new Map();
  private globalDisposables: vscode.Disposable[] = [];
  private remoteApplyDepthByFile: Map<string, number> = new Map();
  private active = false;

  constructor(
    private readonly wsManager: WebSocketManager,
    private readonly outputChannel: vscode.OutputChannel,
  ) {
    this.wsManager.onMessage((data) => this.handleIncoming(data));
  }

  activate(): void {
    if (this.active) {
      this.log("activate skipped: already active");
      return;
    }

    this.active = true;
    this.log("activate");

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
      return;
    }

    this.log(`binding document (${fileKey})`);

    const entry = this.getOrCreateDocEntry(fileKey);

    if (!entry.initializedFromLocal && !entry.hasRemoteState) {
      const ytext = entry.ydoc.getText("content");
      const currentContent = document.getText();

      entry.ydoc.transact(() => {
        ytext.delete(0, ytext.length);

        if (currentContent.length > 0) {
          ytext.insert(0, currentContent);
        }
      }, INITIAL_DOCUMENT_ORIGIN);

      entry.initializedFromLocal = true;
      this.log(
        `initialized from local editor (${fileKey}, chars=${currentContent.length})`,
      );
    }

    const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        const eventFileKey = this.getCanonicalFileKey(event.document);
        if (eventFileKey !== fileKey) {
          return;
        }

        if (this.isRemoteApplyInProgress(fileKey)) {
          this.log(`local change ignored during remote apply (${fileKey})`);
          return;
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

    void this.patchEditor(fileKey, entry.ydoc);
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

    const debouncedSend = debounce((update: Uint8Array) => {
      const payload = encodeSyncPayload(fileKey, update);
      this.log(
        `outbound sync send (${fileKey}, updateBytes=${update.length}, payloadBytes=${payload.length})`,
      );
      this.wsManager.send(payload);
    }, DEBOUNCE_MS);

    ydoc.on("update", (update: Uint8Array, origin: unknown) => {
      if (!this.active) {
        this.log("Y.Doc update ignored: sync inactive");
        return;
      }

      if (origin !== LOCAL_CHANGE_ORIGIN) {
        return;
      }

      this.log(`Y.Doc local update (${fileKey}, bytes=${update.length})`);
      debouncedSend(update);
    });

    const entry: DocEntry = {
      ydoc,
      initializedFromLocal: false,
      hasRemoteState: false,
    };

    this.docs.set(fileKey, entry);
    return entry;
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

    Y.applyUpdate(entry.ydoc, update);

    await this.patchEditor(fileKey, entry.ydoc);
  }

  private async patchEditor(fileKey: string, ydoc: Y.Doc): Promise<void> {
    const visibleEditorKeys = vscode.window.visibleTextEditors
      .map((editor) => this.getCanonicalFileKey(editor.document))
      .filter((key): key is string => Boolean(key));

    const editor = vscode.window.visibleTextEditors.find(
      (candidate) => this.getCanonicalFileKey(candidate.document) === fileKey,
    );

    if (!editor) {
      this.log(
        `patch skipped: no visible editor for (${fileKey}), visible=[${visibleEditorKeys.join(", ")}]`,
      );
      return;
    }

    const ytext = ydoc.getText("content");
    const newContent = ytext.toString();
    const currentContent = editor.document.getText();

    if (newContent === currentContent) {
      this.log(`patch skipped: content already matches (${fileKey})`);
      return;
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