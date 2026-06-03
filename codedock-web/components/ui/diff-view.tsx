"use client";
import React, { useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { diffWordsWithSpace } from "diff";

export interface DiffLine {
  type: "addition" | "deletion" | "unchanged";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

import { getDiffStrategy, getFileExtension } from "@/lib/diff/diff-strategy";
import { DiffResult } from "@/lib/diff/compute-diff";

export function computeDiff(
  oldCode: string,
  newCode: string,
  filePath: string,
): DiffLine[] {
  const extension = getFileExtension(filePath);
  const chunks: DiffResult[] = getDiffStrategy(extension)(oldCode, newCode);
  const lines: DiffLine[] = [];

  let oldLine = 1;
  let newLine = 1;

  for (const chunk of chunks) {
    const kind = chunk.type;

    for (const rawLine of chunk.lines) {
      if (kind === "add") {
        lines.push({
          type: "addition",
          content: rawLine,
          newLineNumber: newLine,
        });
        newLine++;
      } else if (kind === "remove") {
        lines.push({
          type: "deletion",
          content: rawLine,
          oldLineNumber: oldLine,
        });
        oldLine++;
      } else {
        lines.push({
          type: "unchanged",
          content: rawLine,
          oldLineNumber: oldLine,
          newLineNumber: newLine,
        });
        oldLine++;
        newLine++;
      }
    }
  }

  return lines;
}

interface DiffViewProps {
  filePath: string;
  oldCode: string;
  newCode: string;
  language: string;
}

const InlineDiff = React.memo(function InlineDiff({
  lineContent,
  pairContent,
  isAddition,
}: {
  lineContent: string;
  pairContent: string;
  isAddition: boolean;
}) {
  const wordDiffs = useMemo(() => {
    const oldStr = isAddition ? pairContent : lineContent;
    const newStr = isAddition ? lineContent : pairContent;
    return diffWordsWithSpace(oldStr, newStr);
  }, [lineContent, pairContent, isAddition]);

  return (
    <span>
      {wordDiffs.map((part, pIdx) => {
        if (isAddition) {
          if (part.removed) return null;
          if (part.added) {
            return (
              <span
                key={pIdx}
                className="bg-emerald-500/35 text-emerald-100 rounded px-0.5 font-semibold border border-emerald-500/20"
              >
                {part.value}
              </span>
            );
          }
          return <span key={pIdx}>{part.value}</span>;
        } else {
          if (part.added) return null;
          if (part.removed) {
            return (
              <span
                key={pIdx}
                className="bg-rose-500/35 text-rose-100 rounded px-0.5 font-semibold border border-rose-500/20"
              >
                {part.value}
              </span>
            );
          }
          return <span key={pIdx}>{part.value}</span>;
        }
      })}
    </span>
  );
});

// 1. Memoized single diff line component to prevent re-running Prism parser on scroll or unrelated updates
const DiffLineRow = React.memo(function DiffLineRow({
  line,
  language,
  isAddition,
  isDeletion,
  pairContent,
}: {
  line: DiffLine;
  language: string;
  isAddition: boolean;
  isDeletion: boolean;
  pairContent?: string;
}) {
  return (
    <div
      className={`flex group ${
        isAddition
          ? "bg-emerald-500/15"
          : isDeletion
            ? "bg-rose-500/15"
            : "hover:bg-white/[0.02]"
      }`}
    >
      {/* Line Numbers */}
      <div className="flex flex-shrink-0 select-none border-r border-slate-800/70 bg-slate-900/70 text-right text-[8px] text-slate-500 w-[50px]">
        <div className="w-[25px] px-1 py-0.5 border-r border-slate-800/60">
          {line.oldLineNumber || ""}
        </div>
        <div className="w-[25px] px-1 py-0.5">
          {line.newLineNumber || ""}
        </div>
      </div>

      {/* Marker */}
      <div
        className={`flex flex-shrink-0 items-center justify-center w-4 select-none font-bold text-[10px] ${
          isAddition
            ? "text-emerald-400"
            : isDeletion
              ? "text-rose-400"
              : "text-slate-600"
        }`}
      >
        {isAddition ? "+" : isDeletion ? "-" : " "}
      </div>

      {/* Content */}
      <div
        className={`flex-1 px-2 py-0.5 whitespace-pre break-all ${
          isAddition && pairContent !== undefined
            ? "text-emerald-300"
            : isDeletion && pairContent !== undefined
              ? "text-rose-300"
              : "text-slate-300"
        }`}
      >
        {pairContent !== undefined ? (
          <InlineDiff
            lineContent={line.content}
            pairContent={pairContent}
            isAddition={isAddition}
          />
        ) : (
          <SyntaxHighlighter
            language={language}
            style={atomDark}
            customStyle={{
              margin: 0,
              padding: 0,
              background: "transparent",
              fontSize: "inherit",
            }}
            PreTag="div"
            CodeTag="span"
          >
            {line.content || " "}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
});

// 2. Fully memoized DiffView component. It will never re-render when other dynamic state updates
// in the parent component (like live activity notifications, sidebar items, or user presence).
export const DiffView = React.memo(function DiffView({
  filePath,
  oldCode,
  newCode,
  language,
}: DiffViewProps) {
  // Memoize the diff calculation to avoid CPU thrashing on re-renders
  const diff = useMemo(
    () => computeDiff(oldCode, newCode, filePath),
    [oldCode, newCode, filePath]
  );

  const pairedLines = useMemo(() => {
    const paired = new Map<number, number>();
    let i = 0;
    while (i < diff.length) {
      if (diff[i].type === "deletion") {
        let delCount = 0;
        while (i + delCount < diff.length && diff[i + delCount].type === "deletion") {
          delCount++;
        }
        let addCount = 0;
        const addStart = i + delCount;
        while (addStart + addCount < diff.length && diff[addStart + addCount].type === "addition") {
          addCount++;
        }

        if (delCount > 0 && addCount > 0) {
          const pairCount = Math.min(delCount, addCount);
          for (let k = 0; k < pairCount; k++) {
            paired.set(i + k, addStart + k);
            paired.set(addStart + k, i + k);
          }
        }
        i += delCount + addCount;
      } else {
        i++;
      }
    }
    return paired;
  }, [diff]);

  return (
    <div className="font-mono text-[13px] leading-6 bg-slate-950 overflow-x-auto rounded-3xl border border-slate-800/70">
      {diff.map((line, idx) => {
        const isAddition = line.type === "addition";
        const isDeletion = line.type === "deletion";
        const pairIdx = pairedLines.get(idx);
        const pairContent = pairIdx !== undefined ? diff[pairIdx].content : undefined;

        return (
          <DiffLineRow
            key={idx}
            line={line}
            language={language}
            isAddition={isAddition}
            isDeletion={isDeletion}
            pairContent={pairContent}
          />
        );
      })}
    </div>
  );
});

