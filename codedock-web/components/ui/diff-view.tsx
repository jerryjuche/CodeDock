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

/**
 * Computes Longest Common Subsequence using dynamic programming
 * Returns indices of matching lines in both old and new code
 */
function computeLCS(
  oldLines: string[],
  newLines: string[],
): Array<[number, number]> {
  const m = oldLines.length;
  const n = newLines.length;

  // DP table: dp[i][j] = length of LCS of oldLines[0..i-1] and newLines[0..j-1]
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find actual matching pairs
  const matches: Array<[number, number]> = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      matches.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches;
}

export function computeDiff(oldCode: string, newCode: string): DiffLine[] {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  const diff: DiffLine[] = [];

  // Find matching lines using LCS
  const matches = computeLCS(oldLines, newLines);
  const matchedOldIndices = new Set(matches.map(([oi]) => oi));
  const matchedNewIndices = new Set(matches.map(([, ni]) => ni));

  let oldIdx = 0;
  let newIdx = 0;
  let matchIdx = 0;

  // Merge deletions, unchanged, and additions in order
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const nextMatch = matches[matchIdx];

    // Process all deletions before next match
    while (oldIdx < oldLines.length && (!nextMatch || oldIdx < nextMatch[0])) {
      if (!matchedOldIndices.has(oldIdx)) {
        diff.push({
          type: "deletion",
          content: oldLines[oldIdx],
          oldLineNumber: oldIdx + 1,
        });
      }
      oldIdx++;
    }

    // Process all additions before next match
    while (newIdx < newLines.length && (!nextMatch || newIdx < nextMatch[1])) {
      if (!matchedNewIndices.has(newIdx)) {
        diff.push({
          type: "addition",
          content: newLines[newIdx],
          newLineNumber: newIdx + 1,
        });
      }
      newIdx++;
    }

    // Add the matched line as unchanged
    if (nextMatch && oldIdx === nextMatch[0] && newIdx === nextMatch[1]) {
      diff.push({
        type: "unchanged",
        content: oldLines[oldIdx],
        oldLineNumber: oldIdx + 1,
        newLineNumber: newIdx + 1,
      });
      oldIdx++;
      newIdx++;
      matchIdx++;
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
              isAddition
                ? "bg-emerald-500/15"
                : isDeletion
                  ? "bg-rose-500/15"
                  : "hover:bg-white/[0.02]"
            }`}
          >
            {/* Line Numbers */}
            <div className="flex flex-shrink-0 select-none border-r border-white/[0.05] bg-white/[0.02] text-right text-[8px] text-slate-500 w-[50px]">
              <div className="w-[25px] px-1 py-0.5 border-r border-white/[0.03]">
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
