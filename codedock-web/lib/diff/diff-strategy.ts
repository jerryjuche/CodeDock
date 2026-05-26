import { DiffResult, computeDiff as defaultLineDiff } from "./compute-diff";
import { createCssDiffStrategy } from "./css-diff";

export type DiffStrategy = (
  oldContent: string,
  newContent: string,
) => DiffResult[];

const diffStrategyMap: Record<string, DiffStrategy> = {
  ".css": createCssDiffStrategy(".css"),
  ".scss": createCssDiffStrategy(".scss"),
  ".less": createCssDiffStrategy(".less"),
};

export function getDiffStrategy(fileExtension: string): DiffStrategy {
  return diffStrategyMap[fileExtension.toLowerCase()] ?? defaultLineDiff;
}

export function getFileExtension(filePath: string): string {
  const normalized = filePath.split("#")[0].split("?")[0];
  const parts = normalized.split(".");
  if (parts.length < 2) {
    return "";
  }

  return `.${parts.pop()?.toLowerCase() ?? ""}`;
}
