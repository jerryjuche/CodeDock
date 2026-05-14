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

export function computeDiff(oldCode: string, newCode: string): DiffLine[] {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  const diff: DiffLine[] = [];

  let i = 0; // old
  let j = 0; // new

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      diff.push({
        type: "unchanged",
        content: oldLines[i],
        oldLineNumber: i + 1,
        newLineNumber: j + 1,
      });
      i++;
      j++;
    } else if (j < newLines.length && (i >= oldLines.length || !oldLines.slice(i).includes(newLines[j]))) {
      diff.push({
        type: "addition",
        content: newLines[j],
        newLineNumber: j + 1,
      });
      j++;
    } else if (i < oldLines.length) {
      diff.push({
        type: "deletion",
        content: oldLines[i],
        oldLineNumber: i + 1,
      });
      i++;
    }
  }

  return diff;
}

interface DiffViewProps {
  oldCode: string;
  newCode: string;
  language: string;
}

export function DiffView({ oldCode, newCode, language }: DiffViewProps) {
  const diff = computeDiff(oldCode, newCode);

  return (
    <div className="font-mono text-[13px] leading-6 bg-[#0d1117] overflow-x-auto rounded-xl border border-white/[0.06]">
      {diff.map((line, idx) => {
        const isAddition = line.type === "addition";
        const isDeletion = line.type === "deletion";

        return (
          <div
            key={idx}
            className={`flex group ${
              isAddition ? "bg-emerald-500/15" : isDeletion ? "bg-rose-500/15" : "hover:bg-white/[0.02]"
            }`}
          >
            {/* Line Numbers */}
            <div className="flex flex-shrink-0 select-none border-r border-white/[0.05] bg-white/[0.02] text-right text-[8px] text-slate-500 w-[50px]">
              <div className="w-[25px] px-1 py-0.5 border-r border-white/[0.03]">{line.oldLineNumber || ""}</div>
              <div className="w-[25px] px-1 py-0.5">{line.newLineNumber || ""}</div>
            </div>

            {/* Marker */}
            <div
              className={`flex flex-shrink-0 items-center justify-center w-4 select-none font-bold text-[10px] ${
                isAddition ? "text-emerald-400" : isDeletion ? "text-rose-400" : "text-slate-600"
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
