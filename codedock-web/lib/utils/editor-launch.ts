export type CodeDockEditorTarget = "vscode" | "antigravity";

export const EDITOR_TARGETS = {
  VSCODE: "vscode",
  ANTIGRAVITY: "antigravity",
} as const;

export const EDITOR_LABELS: Record<CodeDockEditorTarget, string> = {
  vscode: "Visual Studio Code",
  antigravity: "Antigravity",
};

export const EDITOR_DESCRIPTIONS: Record<CodeDockEditorTarget, string> = {
  vscode: "Best if you installed CodeDock from the VS Code Marketplace.",
  antigravity:
    "Best if you installed CodeDock from Open VSX or a VSIX package.",
};

export function isValidEditor(value: unknown): value is CodeDockEditorTarget {
  return value === "vscode" || value === "antigravity";
}
