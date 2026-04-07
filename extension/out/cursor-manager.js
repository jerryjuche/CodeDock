"use strict";
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
exports.CursorManager = void 0;
const vscode = __importStar(require("vscode"));
const protocol_1 = require("./protocol");
const utils_1 = require("./utils");
const THROTTLE_MS = 50;
const STALE_CURSOR_MS = 5000;
const CLEANUP_INTERVAL_MS = 1000;
class CursorManager {
    constructor(wsManager) {
        this.wsManager = wsManager;
        // one decoration type per remote user — never recreated
        this.decorations = new Map();
        // last known awareness state per remote user
        this.states = new Map();
        // last seen timestamp per remote user
        this.lastSeen = new Map();
        // interval that checks for stale cursors
        this.cleanupTimer = null;
        this.active = false;
        this.localUserId = "";
        this.localEmail = "";
        this.wsManager.onMessage((data) => this.handleIncoming(data));
    }
    // --- Public API ---
    activate(userId, email) {
        this.active = true;
        this.localUserId = userId;
        this.localEmail = email;
        // watch local cursor movements — throttled to 50ms
        const throttledSend = (0, utils_1.throttle)(() => {
            this.sendLocalAwareness();
        }, THROTTLE_MS);
        vscode.window.onDidChangeTextEditorSelection(() => {
            if (this.active) {
                throttledSend();
            }
        });
        // start stale cursor cleanup loop
        this.cleanupTimer = setInterval(() => {
            this.removeStalecursors();
        }, CLEANUP_INTERVAL_MS);
    }
    dispose() {
        this.active = false;
        // stop cleanup loop
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        // dispose all decoration types
        for (const decoration of this.decorations.values()) {
            decoration.dispose();
        }
        this.decorations.clear();
        this.states.clear();
        this.lastSeen.clear();
    }
    // --- Local Awareness ---
    sendLocalAwareness() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const position = editor.selection.active;
        const anchor = editor.selection.anchor;
        const state = {
            userId: this.localUserId,
            email: this.localEmail,
            cursor: {
                line: position.line,
                character: position.character,
            },
            selection: {
                anchor: { line: anchor.line, character: anchor.character },
                active: { line: position.line, character: position.character },
            },
        };
        const payload = (0, protocol_1.encodeAwarenessPayload)(state);
        this.wsManager.send(payload);
    }
    // --- Incoming Awareness ---
    handleIncoming(data) {
        // only handle awareness messages
        if (data[0] !== protocol_1.MessageType.AWARENESS) {
            return;
        }
        const state = (0, protocol_1.decodeAwarenessPayload)(data);
        if (!state || !state.userId) {
            return;
        }
        // ignore own awareness messages
        if (state.userId === this.localUserId) {
            return;
        }
        // update last seen timestamp
        this.lastSeen.set(state.userId, Date.now());
        this.states.set(state.userId, state);
        // render the cursor
        this.renderCursor(state);
    }
    // --- Cursor Rendering ---
    renderCursor(state) {
        if (!state.cursor) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        // get or create decoration type for this user
        let decorationType = this.decorations.get(state.userId);
        if (!decorationType) {
            const color = (0, utils_1.colorFromUserId)(state.userId);
            decorationType = vscode.window.createTextEditorDecorationType({
                borderWidth: "0 0 0 2px",
                borderStyle: "solid",
                borderColor: color,
                after: {
                    contentText: ` ${state.email}`,
                    color: color,
                    fontStyle: "normal",
                    fontWeight: "normal",
                },
            });
            this.decorations.set(state.userId, decorationType);
        }
        // build the decoration range — cursor is a single position
        const position = new vscode.Position(state.cursor.line, state.cursor.character);
        const range = new vscode.Range(position, position);
        // apply decoration to the active editor
        editor.setDecorations(decorationType, [range]);
    }
    // --- Stale Cursor Cleanup ---
    removeStalecursors() {
        const now = Date.now();
        for (const [userId, timestamp] of this.lastSeen.entries()) {
            if (now - timestamp > STALE_CURSOR_MS) {
                this.removeCursor(userId);
            }
        }
    }
    removeCursor(userId) {
        // clear the decoration from all visible editors
        const decoration = this.decorations.get(userId);
        if (decoration) {
            vscode.window.visibleTextEditors.forEach((editor) => {
                editor.setDecorations(decoration, []);
            });
            decoration.dispose();
            this.decorations.delete(userId);
        }
        this.states.delete(userId);
        this.lastSeen.delete(userId);
    }
}
exports.CursorManager = CursorManager;
//# sourceMappingURL=cursor-manager.js.map