import * as vscode from "vscode";

export type ConnectionState = "connected" | "disconnected" | "issue";

interface StateConfig {
  text: string;
  tooltip: string;
  backgroundColor: vscode.ThemeColor | undefined;
  color: vscode.ThemeColor | undefined;
}

/**
 * State-to-visual mapping for the CodeDock status bar indicator.
 *
 * VS Code only exposes two background slots: `errorBackground` (red)
 * and `warningBackground` (yellow). There is no native green/success
 * background, so we approximate it using `terminal.ansiGreen` as the
 * foreground color with no background — the standard pattern used by
 * GitLens, ESLint, etc.
 *
 * State mapping:
 *   disconnected → yellow background (warningBackground)
 *   connected    → green foreground  (terminal.ansiGreen)
 *   issue        → red background    (errorBackground)
 */
function getStateConfig(state: ConnectionState): StateConfig {
  switch (state) {
    case "connected":
      return {
        text: "$(pass-filled) CodeDock",
        tooltip: "CodeDock: Connected to room",
        backgroundColor: undefined,
        color: new vscode.ThemeColor("terminal.ansiGreen"),
      };
    case "disconnected":
      return {
        text: "$(circle-slash) CodeDock",
        tooltip: "CodeDock: Disconnected — click to reconnect",
        backgroundColor: new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        ),
        color: new vscode.ThemeColor("statusBarItem.warningForeground"),
      };
    case "issue":
      return {
        text: "$(warning) CodeDock",
        tooltip: "CodeDock: Connection issue — click for details",
        backgroundColor: new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        ),
        color: new vscode.ThemeColor("statusBarItem.errorForeground"),
      };
  }
}

export class CodeDockStatusBar {
  private static instance: CodeDockStatusBar | undefined;
  private readonly item: vscode.StatusBarItem;
  private currentState: ConnectionState | undefined = undefined;

  private constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );

    this.item.command = "codedock.showMenu";
    context.subscriptions.push(this.item);
    this.setState("disconnected");
    this.item.show();
  }

  static init(context: vscode.ExtensionContext): CodeDockStatusBar {
    if (!CodeDockStatusBar.instance) {
      CodeDockStatusBar.instance = new CodeDockStatusBar(context);
    }
    return CodeDockStatusBar.instance;
  }

  static get(): CodeDockStatusBar {
    if (!CodeDockStatusBar.instance) {
      throw new Error(
        "CodeDockStatusBar accessed before init. Call init() in extension.ts first.",
      );
    }

    return CodeDockStatusBar.instance;
  }

  static reset(): void {
    CodeDockStatusBar.instance = undefined;
  }

  setState(state: ConnectionState, detail?: string): void {
    if (this.currentState === state && !detail) {
      return;
    }

    const config = getStateConfig(state);
    this.item.text = config.text;
    this.item.tooltip = detail
      ? `${config.tooltip}\n${detail}`
      : config.tooltip;
    this.item.backgroundColor = config.backgroundColor;
    this.item.color = config.color;
    this.currentState = state;
    this.item.show();
  }

  getState(): ConnectionState {
    return this.currentState ?? "disconnected";
  }

  dispose(): void {
    this.item.dispose();
    CodeDockStatusBar.reset();
  }
}
