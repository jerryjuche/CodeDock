"use client";
import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Check, Copy } from "lucide-react";

type CodeBlockProps = {
  language: string;
  filename: string;
  highlightLines?: number[];
  /** If true, removes outer border/radius so CodeBlock can be embedded flush inside a parent container */
  embedded?: boolean;
} & (
  | {
      code: string;
      tabs?: never;
    }
  | {
      code?: never;
      tabs: Array<{
        name: string;
        code: string;
        language?: string;
        highlightLines?: number[];
      }>;
    }
);

export const CodeBlock = ({
  language,
  filename,
  code,
  highlightLines = [],
  tabs = [],
  embedded = false,
}: CodeBlockProps) => {
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);

  const tabsExist = tabs.length > 0;

  const copyToClipboard = async () => {
    const textToCopy = tabsExist ? tabs[activeTab].code : code;
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeCode = tabsExist ? tabs[activeTab].code : code;
  const activeLanguage = tabsExist
    ? tabs[activeTab].language || language
    : language;
  const activeHighlightLines = tabsExist
    ? tabs[activeTab].highlightLines || []
    : highlightLines;

  const outerClasses = embedded
    ? "overflow-hidden bg-slate-950"
    : "overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950 shadow-[0_8px_32px_rgba(0,0,0,0.3)]";

  return (
    <div className={outerClasses}>
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] bg-[rgba(15,23,42,0.8)] px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Traffic-light dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-[10px] w-[10px] rounded-full bg-[rgba(255,95,87,0.8)]" />
            <span className="h-[10px] w-[10px] rounded-full bg-[rgba(255,189,46,0.8)]" />
            <span className="h-[10px] w-[10px] rounded-full bg-[rgba(39,201,63,0.8)]" />
          </div>
          <p className="truncate text-[13px] font-medium text-[rgb(180,195,214)]">
            {filename}
          </p>
        </div>

        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-[rgb(148,163,184)] transition-all hover:bg-white/[0.06] hover:text-white"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Tabs (if any) */}
      {tabsExist && (
        <div className="flex flex-wrap gap-1 border-b border-white/[0.06] bg-[rgba(15,23,42,0.5)] px-4 py-2">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === index
                  ? "bg-white/[0.08] text-white"
                  : "text-[rgb(148,163,184)] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* Code area */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-hide">
        <SyntaxHighlighter
          language={activeLanguage}
          style={atomDark}
          customStyle={{
            margin: 0,
            padding: "16px 0",
            background: "transparent",
            fontSize: "0.82rem",
            lineHeight: 1.7,
          }}
          wrapLines={true}
          wrapLongLines={true}
          showLineNumbers={true}
          lineNumberStyle={{
            color: "rgba(148,163,184,0.4)",
            paddingRight: 20,
            paddingLeft: 20,
            minWidth: 56,
            flexShrink: 0,
            fontSize: "0.75rem",
          }}
          lineProps={(lineNumber) => {
            const isHighlighted = activeHighlightLines.includes(lineNumber);
            return {
              style: {
                backgroundColor: isHighlighted
                  ? "rgba(46,160,67,0.12)"
                  : "transparent",
                borderLeft: isHighlighted
                  ? "3px solid rgba(46,160,67,0.7)"
                  : "3px solid transparent",
                display: "block",
                width: "100%",
                paddingRight: 16,
              },
            };
          }}
          PreTag="div"
        >
          {String(activeCode)}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
