import * as vscode from "vscode";
import { EventEmitter } from "events";
import { ApiClient } from "./api";
import { TelemetryService } from "./telemetry";

const TOKEN_KEY = "codedock.jwt";

function getUserInfoFromToken(token: string): { userId: string; email?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4 !== 0) {
      b += "=";
    }
    const decoded = Buffer.from(b, "base64").toString("utf8");
    const obj = JSON.parse(decoded);
    const userId = obj.sub || obj.user_id || obj.userId || obj.uid || "";
    const email = obj.email || obj.eml || undefined;
    if (!userId) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

export class AuthManager {
  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly api: ApiClient,
    private readonly events: EventEmitter,
  ) {}

  async getToken(): Promise<string | null> {
    const token = await this.secrets.get(TOKEN_KEY);
    return token ?? null;
  }

  private async saveToken(token: string): Promise<void> {
    await this.secrets.store(TOKEN_KEY, token);
  }

  async storeTokenSilently(token: string): Promise<void> {
    await this.saveToken(token);
    const userInfo = getUserInfoFromToken(token);
    if (userInfo) {
      TelemetryService.getInstance().identify(userInfo.userId, userInfo.email);
      TelemetryService.getInstance().capture("auth_token_stored_silently");
    }
  }

  async deleteToken(): Promise<void> {
    await this.secrets.delete(TOKEN_KEY);
  }

  async login(): Promise<void> {
    const email = await vscode.window.showInputBox({
      prompt: "CodeDock: Enter your email",
      placeHolder: "developer@example.com",
      ignoreFocusOut: true,
    });

    if (!email) {
      return;
    }

    const password = await vscode.window.showInputBox({
      prompt: "CodeDock: Enter your password",
      password: true,
      ignoreFocusOut: true,
    });

    if (!password) {
      return;
    }

    try {
      const response = await this.api.login(email, password);
      await this.saveToken(response.token);
      
      const userInfo = getUserInfoFromToken(response.token);
      if (userInfo) {
        TelemetryService.getInstance().identify(userInfo.userId, userInfo.email);
      }
      TelemetryService.getInstance().capture("login_success");

      this.events.emit("login", response.token);
      vscode.window.showInformationMessage("CodeDock: Logged in successfully.");
      await this.promptRoomAction();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "unknown error";
      TelemetryService.getInstance().capture("login_failed", { error: errorMessage });
      vscode.window.showErrorMessage(
        `CodeDock: Login failed — ${errorMessage}`,
      );
    }
  }

  async logout(): Promise<void> {
    TelemetryService.getInstance().capture("user_logged_out");
    await this.deleteToken();
    this.events.emit("logout");
    vscode.window.showInformationMessage("CodeDock: Logged out.");
  }

  async validateToken(): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        return false;
      }
      await this.api.validateToken(token);
      return true;
    } catch {
      await this.deleteToken();
      return false;
    }
  }

  private async promptRoomAction(): Promise<void> {
    const choice = await vscode.window.showQuickPick(
      ["Join a Room", "Create a Room"],
      { placeHolder: "What would you like to do?" },
    );

    if (!choice) {
      return;
    }

    if (choice === "Join a Room") {
      vscode.commands.executeCommand("codedock.joinRoom");
    } else {
      vscode.commands.executeCommand("codedock.createRoom");
    }
  }
}