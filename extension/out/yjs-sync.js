"use strict";
// extension/src/yjs-sync.ts
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
exports.YjsSync = void 0;
const Y = __importStar(require("yjs"));
const vscode = __importStar(require("vscode"));
const protocol_1 = require("./protocol");
const utils_1 = require("./utils");
const DEBOUNCE_MS = 200;
class YjsSync {
    constructor(wsManager) {
        this.wsManager = wsManager;
        // one Y.Doc per open file, keyed by file path
        this.docs = new Map();
        // prevents infinite loop when applying remote updates
        this.isApplyingRemoteUpdate = false;
        // tracks VS Code event listener disposables per file
        this.listeners = new Map();
        this.active = false;
        // register this instance as the message handler
        this.wsManager.onMessage((data) => this.handleIncoming(data));
    }
    // --- Public API ---
    activate() {
        this.active = true;
        // bind any already-open editors
        vscode.window.visibleTextEditors.forEach((editor) => {
            this.bindDocument(editor.document);
        });
        // bind new editors as they open
        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (this.active) {
                this.bindDocument(doc);
            }
        });
        // clean up when files close
        vscode.workspace.onDidCloseTextDocument((doc) => {
            this.unbindDocument(doc.uri.fsPath);
        });
    }
    dispose() {
        this.active = false;
        // clean up all listeners
        for (const disposable of this.listeners.values()) {
            disposable.dispose();
        }
        this.listeners.clear();
        // clean up all docs
        for (const doc of this.docs.values()) {
            doc.destroy();
        }
        this.docs.clear();
    }
    // --- Document Binding ---
    bindDocument(document) {
        const filePath = document.uri.fsPath;
        // skip if already bound
        if (this.docs.has(filePath)) {
            return;
        }
        // skip non-file documents — output panels, git diffs, etc
        if (document.uri.scheme !== 'file') {
            return;
        }
        // create a new Y.Doc for this file
        const ydoc = new Y.Doc();
        this.docs.set(filePath, ydoc);
        // initialise Y.Text with current file content
        const ytext = ydoc.getText('content');
        ydoc.transact(() => {
            ytext.insert(0, document.getText());
        });
        // watch for local changes — debounced to batch rapid keystrokes
        const debouncedSend = (0, utils_1.debounce)((update) => {
            const payload = (0, protocol_1.encodeSyncPayload)(filePath, update);
            this.wsManager.send(payload);
        }, DEBOUNCE_MS);
        // listen for Yjs document updates caused by local changes
        ydoc.on('update', (update, origin) => {
            // origin === null means local change
            // skip if this update came from a remote apply
            if (origin !== null || this.isApplyingRemoteUpdate) {
                return;
            }
            debouncedSend(update);
        });
        // watch VS Code text document changes
        const listener = vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.uri.fsPath !== filePath) {
                return;
            }
            if (this.isApplyingRemoteUpdate) {
                return;
            }
            // translate VS Code changes into Yjs operations
            ydoc.transact(() => {
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
            }, null); // null origin = local change
        });
        this.listeners.set(filePath, listener);
    }
    unbindDocument(filePath) {
        // dispose the VS Code listener
        const listener = this.listeners.get(filePath);
        if (listener) {
            listener.dispose();
            this.listeners.delete(filePath);
        }
        // destroy the Y.Doc and remove from map
        const ydoc = this.docs.get(filePath);
        if (ydoc) {
            ydoc.destroy();
            this.docs.delete(filePath);
        }
    }
    // --- Incoming Message Handling ---
    handleIncoming(data) {
        const payload = (0, protocol_1.decodeSyncPayload)(data);
        if (!payload) {
            return;
        }
        this.applyRemoteUpdate(payload);
    }
    applyRemoteUpdate(payload) {
        const { filePath, update } = payload;
        // get or create Y.Doc for this file path
        let ydoc = this.docs.get(filePath);
        if (!ydoc) {
            ydoc = new Y.Doc();
            this.docs.set(filePath, ydoc);
        }
        // set guard — prevents local change handler from firing
        this.isApplyingRemoteUpdate = true;
        try {
            Y.applyUpdate(ydoc, update);
            // patch the visible editor if this file is open
            this.patchEditor(filePath, ydoc);
        }
        finally {
            // always clear guard — even if patch throws
            this.isApplyingRemoteUpdate = false;
        }
    }
    patchEditor(filePath, ydoc) {
        const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.fsPath === filePath);
        if (!editor) {
            return;
        }
        const ytext = ydoc.getText('content');
        const newContent = ytext.toString();
        const currentContent = editor.document.getText();
        if (newContent === currentContent) {
            return;
        }
        const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(currentContent.length));
        editor.edit((editBuilder) => {
            editBuilder.replace(fullRange, newContent);
        });
    }
}
exports.YjsSync = YjsSync;
//# sourceMappingURL=yjs-sync.js.map