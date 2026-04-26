import * as vscode from "vscode";
import { EventEmitter } from "events";
import { ApiClient } from "./api";

const TOKEN_KEY = "codedock.jwt";

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
      this.events.emit("login", response.token);
      vscode.window.showInformationMessage("CodeDock: Logged in successfully.");
      await this.promptRoomAction();
    } catch (err) {
      vscode.window.showErrorMessage(
        `CodeDock: Login failed — ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  async logout(): Promise<void> {
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