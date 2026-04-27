import * as vscode from "vscode";
import { WebSocketManager } from "./websocket";
import {
  encodeAwarenessPayload,
  decodeAwarenessPayload,
  MessageType,
} from "./protocol";
import { throttle, colorFromUserId } from "./utils";
import { AwarenessState } from "./types";

const THROTTLE_MS = 50;
const STALE_CURSOR_MS = 5000;
const CLEANUP_INTERVAL_MS = 1000;

export class CursorManager {
  // one decoration type per remote user — never recreated
  private decorations: Map<string, vscode.TextEditorDecorationType> = new Map();

  // last known awareness state per remote user
  private states: Map<string, AwarenessState> = new Map();

  // last seen timestamp per remote user
  private lastSeen: Map<string, number> = new Map();

  // interval that checks for stale cursors
  private cleanupTimer: NodeJS.Timeout | null = null;

  private active: boolean = false;
  private localUserId: string = "";
  private localEmail: string = "";

  constructor(private readonly wsManager: WebSocketManager) {
    this.wsManager.onMessage((data) => this.handleIncoming(data));
  }

  // --- Public API ---

  activate(userId: string, email: string): void {
    this.active = true;
    this.localUserId = userId;
    this.localEmail = email;

    // watch local cursor movements — throttled to 50ms
    const throttledSend = throttle(() => {
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

  dispose(): void {
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

  private sendLocalAwareness(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const position = editor.selection.active;
    const anchor = editor.selection.anchor;

    const state: AwarenessState = {
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

    const payload = encodeAwarenessPayload(state);
    this.wsManager.send(payload);
  }

  // --- Incoming Awareness ---

  private handleIncoming(data: Uint8Array): void {
    // only handle awareness messages
    if (data[0] !== MessageType.AWARENESS) {
      return;
    }

    const state = decodeAwarenessPayload<AwarenessState>(data);
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

  private renderCursor(state: AwarenessState): void {
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
      const color = colorFromUserId(state.userId);
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
    const position = new vscode.Position(
      state.cursor.line,
      state.cursor.character,
    );
    const range = new vscode.Range(position, position);

    // apply decoration to the active editor
    editor.setDecorations(decorationType, [range]);
  }

  // --- Stale Cursor Cleanup ---

  private removeStalecursors(): void {
    const now = Date.now();

    for (const [userId, timestamp] of this.lastSeen.entries()) {
      if (now - timestamp > STALE_CURSOR_MS) {
        this.removeCursor(userId);
      }
    }
  }

  private removeCursor(userId: string): void {
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
