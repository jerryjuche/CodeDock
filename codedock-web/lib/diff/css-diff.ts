import { diffArrays, diffLines } from "diff";
import postcss, {
  AtRule,
  Comment,
  Declaration,
  Node,
  Root,
  Rule,
} from "postcss";
import * as lessSyntax from "postcss-less";
import scssSyntax from "postcss-scss";
import { computeDiff as defaultLineDiff, DiffResult } from "./compute-diff";

type CssBlockKind = "rule" | "atrule" | "decl" | "comment" | "other";

type CssBlock = {
  kind: CssBlockKind;
  signature: string;
  lines: string[];
  selector?: string;
  name?: string;
  params?: string;
  simple: boolean;
  declLines?: string[];
};

function parseCss(text: string, extension: string): Root {
  const syntax =
    extension === ".scss"
      ? scssSyntax
      : extension === ".less"
        ? lessSyntax
        : undefined;
  const options: Record<string, unknown> = { from: undefined };
  if (syntax) {
    options.syntax = syntax;
  }
  return postcss.parse(text, options as any);
}

function toLines(value: string): string[] {
  let val = value;
  if (val.endsWith("\n")) {
    val = val.slice(0, -1);
  }
  return val.split("\n");
}

function isDeclaration(node: Node): node is Declaration {
  return node.type === "decl";
}

function isComment(node: Node): node is Comment {
  return node.type === "comment";
}

function isRule(node: Node): node is Rule {
  return node.type === "rule";
}

function isAtRule(node: Node): node is AtRule {
  return node.type === "atrule";
}

function createRuleBlock(rule: Rule): CssBlock {
  const lines = toLines(rule.toString());
  const childNodes = rule.nodes ?? [];
  const simple = childNodes.every(
    (node) => isDeclaration(node) || isComment(node),
  );
  const declLines = childNodes.map((node) => node.toString());

  return {
    kind: "rule",
    signature: `rule:${rule.selector}`,
    lines,
    selector: rule.selector,
    simple,
    declLines,
  };
}

function createAtRuleBlock(atRule: AtRule): CssBlock {
  const lines = toLines(atRule.toString());
  const childNodes = atRule.nodes ?? [];
  const simple = childNodes.every(
    (node) => isDeclaration(node) || isComment(node),
  );
  const declLines = childNodes.map((node) => node.toString());

  return {
    kind: "atrule",
    signature: `atrule:${atRule.name}:${atRule.params}`,
    lines,
    name: atRule.name,
    params: atRule.params,
    simple,
    declLines,
  };
}

function createDeclBlock(decl: Declaration): CssBlock {
  return {
    kind: "decl",
    signature: `decl:${decl.prop}:${decl.value}`,
    lines: [decl.toString()],
    simple: true,
    declLines: [decl.toString()],
  };
}

function createCommentBlock(comment: Comment): CssBlock {
  return {
    kind: "comment",
    signature: `comment:${comment.text}`,
    lines: [comment.toString()],
    simple: true,
  };
}

function createOtherBlock(node: Node): CssBlock {
  return {
    kind: "other",
    signature: `other:${node.toString()}`,
    lines: toLines(node.toString()),
    simple: false,
  };
}

function extractCssBlocks(root: Root): CssBlock[] {
  return (root.nodes ?? []).map((node) => {
    if (isRule(node)) return createRuleBlock(node);
    if (isAtRule(node)) return createAtRuleBlock(node);
    if (isDeclaration(node)) return createDeclBlock(node);
    if (isComment(node)) return createCommentBlock(node);
    return createOtherBlock(node);
  });
}

function computeRuleBodyDiff(
  oldBlock: CssBlock,
  newBlock: CssBlock,
): DiffResult[] {
  const oldLines = oldBlock.lines;
  const newLines = newBlock.lines;
  const header = oldLines[0] ?? "";
  const footer = oldLines[oldLines.length - 1] ?? "";
  const oldBody = oldLines.slice(1, oldLines.length - 1);
  const newBody = newLines.slice(1, newLines.length - 1);
  const parts = diffLines(oldBody.join("\n"), newBody.join("\n"));
  const diffResults: DiffResult[] = [];

  diffResults.push({
    type: "context",
    lines: [header],
    lineNumber: { old: 0, new: 0 },
  });

  for (const part of parts) {
    const lines = toLines(part.value);
    if (lines.length === 1 && lines[0] === "") {
      continue;
    }

    diffResults.push({
      type: part.added ? "add" : part.removed ? "remove" : "context",
      lines,
      lineNumber: { old: part.removed ? 0 : 0, new: part.added ? 0 : 0 },
    });
  }

  diffResults.push({
    type: "context",
    lines: [footer],
    lineNumber: { old: 0, new: 0 },
  });

  return diffResults;
}

function blocksAreIdentical(oldBlock: CssBlock, newBlock: CssBlock): boolean {
  return oldBlock.lines.join("\n") === newBlock.lines.join("\n");
}

const warnedParseIssues = new Set<string>();

function warnParseIssue(extension: string, error: unknown): void {
  if (
    process.env.NODE_ENV !== "production" &&
    !warnedParseIssues.has(extension)
  ) {
    warnedParseIssues.add(extension);
    console.warn(
      `CSS diff parser failed for ${extension}, falling back to line diff.`,
      error,
    );
  }
}

export function createCssDiffStrategy(
  extension: string,
): (oldContent: string, newContent: string) => DiffResult[] {
  return function cssDiff(
    oldContent: string,
    newContent: string,
  ): DiffResult[] {
    let oldRoot: Root;
    let newRoot: Root;

    try {
      oldRoot = parseCss(oldContent, extension);
      newRoot = parseCss(newContent, extension);
    } catch (error) {
      warnParseIssue(extension, error);
      return defaultLineDiff(oldContent, newContent);
    }

    if (
      oldRoot.toString().trim() === newRoot.toString().trim() &&
      oldContent !== newContent
    ) {
      return defaultLineDiff(oldContent, newContent);
    }

    const oldBlocks = extractCssBlocks(oldRoot);
    const newBlocks = extractCssBlocks(newRoot);
    const changes = diffArrays(oldBlocks, newBlocks, {
      comparator: (a, b) => a.signature === b.signature,
    });

    const results: DiffResult[] = [];
    let oldLine = 1;
    let newLine = 1;
    let oldIndex = 0;
    let newIndex = 0;

    for (const change of changes) {
      if (change.added) {
        for (const block of change.value as CssBlock[]) {
          results.push({
            type: "add",
            lines: block.lines,
            lineNumber: { old: null, new: newLine },
          });
          newLine += block.lines.length;
          newIndex += 1;
        }
        continue;
      }

      if (change.removed) {
        for (const block of change.value as CssBlock[]) {
          results.push({
            type: "remove",
            lines: block.lines,
            lineNumber: { old: oldLine, new: null },
          });
          oldLine += block.lines.length;
          oldIndex += 1;
        }
        continue;
      }

      const blockCount = (change.value as CssBlock[]).length;
      for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
        const oldBlock = oldBlocks[oldIndex + blockIndex];
        const newBlock = newBlocks[newIndex + blockIndex];
        if (!oldBlock || !newBlock) {
          break;
        }

        if (blocksAreIdentical(oldBlock, newBlock)) {
          results.push({
            type: "context",
            lines: oldBlock.lines,
            lineNumber: { old: oldLine, new: newLine },
          });
          oldLine += oldBlock.lines.length;
          newLine += newBlock.lines.length;
        } else if (
          (oldBlock.kind === "rule" || oldBlock.kind === "atrule") &&
          oldBlock.simple &&
          newBlock.simple &&
          oldBlock.signature === newBlock.signature
        ) {
          const innerChunks = computeRuleBodyDiff(oldBlock, newBlock);
          for (const chunk of innerChunks) {
            results.push({
              type: chunk.type,
              lines: chunk.lines,
              lineNumber: {
                old: chunk.type === "add" ? null : oldLine,
                new: chunk.type === "remove" ? null : newLine,
              },
            });
            if (chunk.type !== "add") {
              oldLine += chunk.lines.length;
            }
            if (chunk.type !== "remove") {
              newLine += chunk.lines.length;
            }
          }
        } else {
          const fallbackChunks = defaultLineDiff(
            oldBlock.lines.join("\n"),
            newBlock.lines.join("\n"),
          );
          for (const chunk of fallbackChunks) {
            const adjusted: DiffResult = {
              type: chunk.type,
              lines: chunk.lines,
              lineNumber: {
                old: chunk.lineNumber.old
                  ? oldLine + chunk.lineNumber.old - 1
                  : null,
                new: chunk.lineNumber.new
                  ? newLine + chunk.lineNumber.new - 1
                  : null,
              },
            };
            results.push(adjusted);
            if (chunk.type !== "add") {
              oldLine += chunk.lines.length;
            }
            if (chunk.type !== "remove") {
              newLine += chunk.lines.length;
            }
          }
        }
      }

      oldIndex += blockCount;
      newIndex += blockCount;
    }

    return results;
  };
}
