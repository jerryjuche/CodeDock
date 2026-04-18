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
exports.AuthManager = void 0;
const vscode = __importStar(require("vscode"));
const TOKEN_KEY = "codedock.jwt";
class AuthManager {
    constructor(secrets, api, events) {
        this.secrets = secrets;
        this.api = api;
        this.events = events;
    }
    async getToken() {
        const token = await this.secrets.get(TOKEN_KEY);
        return token ?? null;
    }
    async saveToken(token) {
        await this.secrets.store(TOKEN_KEY, token);
    }
    async deleteToken() {
        await this.secrets.delete(TOKEN_KEY);
    }
    async login() {
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
        }
        catch (err) {
            vscode.window.showErrorMessage(`CodeDock: Login failed — ${err instanceof Error ? err.message : "unknown error"}`);
        }
    }
    async logout() {
        await this.deleteToken();
        this.events.emit("logout");
        vscode.window.showInformationMessage("CodeDock: Logged out.");
    }
    async validateToken() {
        try {
            const token = await this.getToken();
            if (!token) {
                return false;
            }
            const valid = await this.api.validateToken(token);
            return true;
        }
        catch {
            await this.deleteToken();
            return false;
        }
    }
    async promptRoomAction() {
        const choice = await vscode.window.showQuickPick(["Join a Room", "Create a Room"], { placeHolder: "What would you like to do?" });
        if (!choice) {
            return;
        }
        if (choice === "Join a Room") {
            vscode.commands.executeCommand("codedock.joinRoom");
        }
        else {
            vscode.commands.executeCommand("codedock.createRoom");
        }
    }
}
exports.AuthManager = AuthManager;
//# sourceMappingURL=auth.js.map