"use client";

import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

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

export function DiffView({
  filePath,
  oldCode,
  newCode,
  language,
}: DiffViewProps) {
  const diff = computeDiff(oldCode, newCode, filePath);

  return (
    <div className="font-mono text-[13px] leading-6 bg-slate-950 overflow-x-auto rounded-3xl border border-slate-800/70">
      {diff.map((line, idx) => {
        const isAddition = line.type === "addition";
        const isDeletion = line.type === "deletion";

        return (
          <div
            key={idx}
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
            <div className="flex-1 px-2 py-0.5 whitespace-pre break-all">
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
