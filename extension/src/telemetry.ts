import * as vscode from "vscode";
import { PostHog } from "posthog-node";
import * as crypto from "crypto";

const TELEMETRY_ANON_ID_KEY = "codedock.telemetry.anonId";

export class TelemetryService {
  private static instance: TelemetryService | null = null;
  private posthog: PostHog | null = null;
  private distinctId: string = "";
  private globalState: vscode.Memento | null = null;
  private isDisposed: boolean = false;

  private constructor() {}

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.globalState = context.globalState;
    this.distinctId = await this.getOrCreateAnonId();

    if (this.isTelemetryEnabled()) {
      this.initPostHog();
    }

    context.subscriptions.push(
      vscode.env.onDidChangeTelemetryEnabled((enabled) => {
        if (enabled && this.isTelemetryEnabled()) {
          this.initPostHog();
        } else {
          this.disposePostHog();
        }
      })
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("codedock.telemetry")) {
          if (this.isTelemetryEnabled()) {
            this.initPostHog();
          } else {
            this.disposePostHog();
          }
        }
      })
    );
  }

  private isTelemetryEnabled(): boolean {
    if (!vscode.env.isTelemetryEnabled) {
      return false;
    }

    const config = vscode.workspace.getConfiguration("codedock");
    const enabled = config.get<boolean>("telemetry.enabled", true);
    return enabled;
  }

  private initPostHog(): void {
    if (this.posthog || this.isDisposed) {
      return;
    }

    const config = vscode.workspace.getConfiguration("codedock");
    const token = config.get<string>(
      "telemetry.posthogToken",
      "phc_codedock_default_telemetry_placeholder"
    );
    const host = config.get<string>(
      "telemetry.posthogHost",
      "https://eu.i.posthog.com"
    );

    if (
      !token ||
      token.trim() === "" ||
      token.includes("placeholder") ||
      token.includes("YOUR_REAL_TOKEN_HERE")
    ) {
      return;
    }

    try {
      this.posthog = new PostHog(token, {
        host: host,
      });
    } catch {
      // Fail silently
    }
  }

  private disposePostHog(): void {
    if (this.posthog) {
      const ph = this.posthog;
      this.posthog = null;
      try {
        ph.shutdown();
      } catch {
        // no-op
      }
    }
  }

  private async getOrCreateAnonId(): Promise<string> {
    if (!this.globalState) {
      return crypto.randomUUID();
    }

    let anonId = this.globalState.get<string>(TELEMETRY_ANON_ID_KEY);
    if (!anonId) {
      anonId = crypto.randomUUID();
      await this.globalState.update(TELEMETRY_ANON_ID_KEY, anonId);
    }
    return anonId;
  }

  public identify(userId: string, email?: string): void {
    if (!this.isTelemetryEnabled()) {
      return;
    }

    if (!this.posthog) {
      this.initPostHog();
    }

    if (this.posthog) {
      try {
        const previousId = this.distinctId;
        this.distinctId = userId;

        if (previousId && previousId !== userId) {
          this.posthog.alias({
            alias: previousId,
            distinctId: userId,
          });
        }

        this.posthog.identify({
          distinctId: userId,
          properties: {
            email: email,
            $set: { email },
          },
        });
      } catch {
        // Fail silently
      }
    }
  }

  public capture(event: string, properties?: Record<string, any>): void {
    if (!this.isTelemetryEnabled()) {
      return;
    }

    if (!this.posthog) {
      this.initPostHog();
    }

    if (this.posthog) {
      try {
        this.posthog.capture({
          distinctId: this.distinctId,
          event: event,
          properties: {
            ...properties,
            $lib: "codedock-vscode-extension",
          },
        });
      } catch {
        // Fail silently
      }
    }
  }

  public async shutdown(): Promise<void> {
    this.isDisposed = true;
    if (this.posthog) {
      const ph = this.posthog;
      this.posthog = null;
      try {
        ph.shutdown();
      } catch {
        // no-op
      }
    }
  }
}
