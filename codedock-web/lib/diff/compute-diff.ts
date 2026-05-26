import { diffLines } from "diff";

/**
 * DiffResult represents a chunk of line-level changes between two texts.
 */
export type DiffResult = {
  type: "add" | "remove" | "context";
  lines: string[];
  lineNumber: { old: number | null; new: number | null };
};

/**
 * computeDiff - compute a line-level diff between two strings using `diffLines`.
 *
 * Inputs:
 *  - oldContent: string | null | undefined
 *  - newContent: string | null | undefined
 *
 * Output: DiffResult[] where each item is a contiguous chunk. `lines` contains
 * the raw line strings (split on "\n"; a trailing newline will produce a
 * trailing empty-string line to preserve line numbering semantics).
 *
 * Failure modes: never throws for normal text inputs. If `diffLines` throws
 * (very unlikely), the error is caught and an empty context result is returned.
 */
export function computeDiff(
  oldContent: string | null | undefined,
  newContent: string | null | undefined,
): DiffResult[] {
  const oldText = oldContent ?? "";
  const newText = newContent ?? "";

  try {
    const changes = diffLines(oldText, newText);
    const results: DiffResult[] = [];

    let oldLine = 1;
    let newLine = 1;

    for (const ch of changes) {
      // Preserve split semantics similar to `String.prototype.split("\n")` used
      // elsewhere: this keeps a trailing empty string when the text ends with a newline.
      const lines = ch.value.split("\n");

      const type: DiffResult["type"] = ch.added
        ? "add"
        : ch.removed
        ? "remove"
        : "context";

      const entry: DiffResult = {
        type,
        lines,
        lineNumber: {
          old: ch.removed ? oldLine : ch.added ? null : oldLine,
          new: ch.added ? newLine : ch.removed ? null : newLine,
        },
      };

      results.push(entry);

      // Advance counters: we treat the number of lines as `lines.length` which
      // mirrors the previous codebase behavior that used `split("\n")`.
      if (ch.removed) {
        oldLine += lines.length;
      } else if (ch.added) {
        newLine += lines.length;
      } else {
        oldLine += lines.length;
        newLine += lines.length;
      }
    }

    return results;
  } catch (err) {
    // Fail-safe: return a single context chunk representing the full inputs.
    return [
      {
        type: "context",
        lines: (newText ?? "").split("\n"),
        lineNumber: { old: oldText ? 1 : null, new: newText ? 1 : null },
      },
    ];
  }
}
