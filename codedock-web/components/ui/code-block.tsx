"use client";
import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Check, Copy } from "lucide-react";

type CodeBlockProps = {
  language: string;
  filename: string;
  highlightLines?: number[];
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

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-slate-900 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.26em] text-[rgb(158,183,211)]">
            Code preview
          </p>
          <p className="truncate text-sm font-semibold text-white">
            {filename}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-[rgb(158,183,211)] transition-colors hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {tabsExist && (
        <div className="flex flex-wrap gap-2 border-b border-white/10 bg-slate-950 px-4 py-3">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                activeTab === index
                  ? "bg-slate-800 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                  : "text-[rgb(148,163,184)] hover:bg-white/5 hover:text-white"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto px-4 py-4">
        <div className="rounded-[20px] border border-white/10 bg-slate-950 p-3">
          <SyntaxHighlighter
            language={activeLanguage}
            style={atomDark}
            customStyle={{
              margin: 0,
              padding: 0,
              background: "transparent",
              fontSize: "0.9rem",
              lineHeight: 1.6,
            }}
            wrapLines={true}
            showLineNumbers={true}
            lineNumberStyle={{
              color: "rgba(148,163,184,0.75)",
              paddingRight: 16,
              minWidth: 28,
            }}
            lineProps={(lineNumber) => ({
              style: {
                backgroundColor: activeHighlightLines.includes(lineNumber)
                  ? "rgba(255,255,255,0.08)"
                  : "transparent",
                display: "block",
                width: "100%",
              },
            })}
            PreTag="div"
          >
            {String(activeCode)}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
};
