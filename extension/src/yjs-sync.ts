// extension/src/yjs-sync.ts

import * as Y from 'yjs'
import * as vscode from 'vscode'
import { WebSocketManager } from './websocket'
import { encodeSyncPayload, decodeSyncPayload } from './protocol'
import { debounce } from './utils'
import { SyncPayload } from './types'

const DEBOUNCE_MS = 200

export class YjsSync {
    // one Y.Doc per open file, keyed by file path
    private docs: Map<string, Y.Doc> = new Map()

    // prevents infinite loop when applying remote updates
    private isApplyingRemoteUpdate: boolean = false

    // tracks VS Code event listener disposables per file
    private listeners: Map<string, vscode.Disposable> = new Map()

    private active: boolean = false

    constructor(private readonly wsManager: WebSocketManager) {
        // register this instance as the message handler
        this.wsManager.onMessage((data) => this.handleIncoming(data))
    }

    // --- Public API ---

    activate(): void {
        this.active = true

        // bind any already-open editors
        vscode.window.visibleTextEditors.forEach((editor) => {
            this.bindDocument(editor.document)
        })

        // bind new editors as they open
        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (this.active) {
                this.bindDocument(doc)
            }
        })

        // clean up when files close
        vscode.workspace.onDidCloseTextDocument((doc) => {
            this.unbindDocument(doc.uri.fsPath)
        })
    }

    dispose(): void {
        this.active = false

        // clean up all listeners
        for (const disposable of this.listeners.values()) {
            disposable.dispose()
        }
        this.listeners.clear()

        // clean up all docs
        for (const doc of this.docs.values()) {
            doc.destroy()
        }
        this.docs.clear()
    }

    // --- Document Binding ---

    private bindDocument(document: vscode.TextDocument): void {
        const filePath = document.uri.fsPath

        // skip if already bound
        if (this.docs.has(filePath)) {
            return
        }

        // skip non-file documents — output panels, git diffs, etc
        if (document.uri.scheme !== 'file') {
            return
        }

        // create a new Y.Doc for this file
        const ydoc = new Y.Doc()
        this.docs.set(filePath, ydoc)

        // initialise Y.Text with current file content
        const ytext = ydoc.getText('content')
        ydoc.transact(() => {
            ytext.insert(0, document.getText())
        })

        // watch for local changes — debounced to batch rapid keystrokes
        const debouncedSend = debounce((update: Uint8Array) => {
            const payload = encodeSyncPayload(filePath, update)
            this.wsManager.send(payload)
        }, DEBOUNCE_MS)

        // listen for Yjs document updates caused by local changes
        ydoc.on('update', (update: Uint8Array, origin: unknown) => {
            // origin === null means local change
            // skip if this update came from a remote apply
            if (origin !== null || this.isApplyingRemoteUpdate) {
                return
            }
            debouncedSend(update)
        })

        // watch VS Code text document changes
        const listener = vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.uri.fsPath !== filePath) {
                return
            }

            if (this.isApplyingRemoteUpdate) {
                return
            }

            // translate VS Code changes into Yjs operations
            ydoc.transact(() => {
                for (const change of event.contentChanges) {
                    const start = change.rangeOffset
                    const deleteCount = change.rangeLength
                    const insertText = change.text

                    if (deleteCount > 0) {
                        ytext.delete(start, deleteCount)
                    }
                    if (insertText.length > 0) {
                        ytext.insert(start, insertText)
                    }
                }
            }, null) // null origin = local change
        })

        this.listeners.set(filePath, listener)
    }

    private unbindDocument(filePath: string): void {
        // dispose the VS Code listener
        const listener = this.listeners.get(filePath)
        if (listener) {
            listener.dispose()
            this.listeners.delete(filePath)
        }

        // destroy the Y.Doc and remove from map
        const ydoc = this.docs.get(filePath)
        if (ydoc) {
            ydoc.destroy()
            this.docs.delete(filePath)
        }
    }

    // --- Incoming Message Handling ---

    private handleIncoming(data: Uint8Array): void {
        const payload = decodeSyncPayload(data)

        if (!payload) {
            return
        }

        this.applyRemoteUpdate(payload)
    }

    private applyRemoteUpdate(payload: SyncPayload): void {
        const { filePath, update } = payload

        // get or create Y.Doc for this file path
        let ydoc = this.docs.get(filePath)
        if (!ydoc) {
            ydoc = new Y.Doc()
            this.docs.set(filePath, ydoc)
        }

        // set guard — prevents local change handler from firing
        this.isApplyingRemoteUpdate = true

        try {
            Y.applyUpdate(ydoc, update)

            // patch the visible editor if this file is open
            this.patchEditor(filePath, ydoc)

        } finally {
            // always clear guard — even if patch throws
            this.isApplyingRemoteUpdate = false
        }
    }

    private patchEditor(filePath: string, ydoc: Y.Doc): void {
        const editor = vscode.window.visibleTextEditors.find(
            (e) => e.document.uri.fsPath === filePath
        )

        if (!editor) {
            return
        }

        const ytext = ydoc.getText('content')
        const newContent = ytext.toString()
        const currentContent = editor.document.getText()

        if (newContent === currentContent) {
            return
        }

        const fullRange = new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(currentContent.length)
        )

        editor.edit((editBuilder) => {
            editBuilder.replace(fullRange, newContent)
        })
    }
}