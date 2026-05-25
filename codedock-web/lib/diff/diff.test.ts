import { describe, expect, it } from "vitest";
import { computeDiff } from "./compute-diff";
import { createCssDiffStrategy } from "./css-diff";
import { getDiffStrategy, getFileExtension } from "./diff-strategy";

describe("computeDiff", () => {
  it("returns a single context chunk for identical content", () => {
    const source = "a\nb\nc\n";
    const diff = computeDiff(source, source);

    expect(diff).toHaveLength(1);
    expect(diff[0].type).toBe("context");
    expect(diff[0].lines).toEqual(["a", "b", "c", ""]);
  });

  it("preserves trailing newline semantics", () => {
    const oldText = "line1\nline2\n";
    const newText = "line1\nline2\nline3\n";
    const diff = computeDiff(oldText, newText);

    expect(diff.some((chunk) => chunk.type === "add")).toBe(true);
    expect(diff.some((chunk) => chunk.type === "context")).toBe(true);
    expect(diff[0].lines).toContain("line1");
  });

  it("handles repeated lines without collapsing duplicates", () => {
    const oldText = "a\na\nb\n";
    const newText = "a\nb\na\n";
    const diff = computeDiff(oldText, newText);

    expect(
      diff.filter((chunk) => chunk.type === "remove").length,
    ).toBeGreaterThan(0);
    expect(diff.filter((chunk) => chunk.type === "add").length).toBeGreaterThan(
      0,
    );
  });
});

describe("diff strategy helpers", () => {
  it("extracts an extension correctly from query and hash parameters", () => {
    expect(getFileExtension("styles/main.css?version=1#L10")).toBe(".css");
    expect(getFileExtension("archive.tar.gz")).toBe(".gz");
    expect(getFileExtension("README")).toBe("");
  });

  it("selects CSS diff strategy for .css files and preserves changed declarations", () => {
    const strategy = getDiffStrategy(".css");
    const diff = strategy(
      ".foo {\n  color: red;\n}\n",
      ".foo {\n  color: blue;\n}\n",
    );

    expect(diff.some((chunk) => chunk.type === "remove")).toBe(true);
    expect(diff.some((chunk) => chunk.type === "add")).toBe(true);
    expect(diff[0].lines).toContain(".foo {");
  });

  it("falls back to default line diff for unknown extensions", () => {
    const strategy = getDiffStrategy(".txt");
    const diff = strategy("hello\n", "hello world\n");

    expect(diff.some((chunk) => chunk.type === "add")).toBe(true);
    expect(diff.some((chunk) => chunk.type === "remove")).toBe(true);
  });

  it("preserves added blank lines in CSS formatting-only diffs", () => {
    const strategy = getDiffStrategy(".css");
    const diff = strategy(
      ".foo {\n  color: red;\n}\n",
      ".foo {\n  color: red;\n}\n\n",
    );

    expect(diff.some((chunk) => chunk.type === "add")).toBe(true);
    expect(diff.some((chunk) => chunk.lines.some((line) => line === ""))).toBe(
      true,
    );
  });
});

describe("CSS diff strategy", () => {
  it("does not throw on malformed CSS input", () => {
    const strategy = createCssDiffStrategy(".css");
    expect(() => strategy("invalid { css", "invalid { css")).not.toThrow();
  });
});
