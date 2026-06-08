// components/rooms/open-ide-button.tsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLaunchIDE } from "@/hooks/use-launch";
import {
  EDITOR_TARGETS,
  EDITOR_LABELS,
  EDITOR_DESCRIPTIONS,
  CodeDockEditorTarget,
} from "@/lib/utils/editor-launch";

export default function OpenIDEButton({
  roomId,
  launchAllowed,
  launchReason,
  isHost,
}: {
  roomId: string;
  launchAllowed: boolean;
  launchReason?: string;
  isHost?: boolean;
}) {
  const { launchIDE, loading } = useLaunchIDE(roomId);
  const [showModal, setShowModal] = useState(false);
  const [selectedEditor, setSelectedEditor] =
    useState<CodeDockEditorTarget | null>(null);
  const [copiedEditor, setCopiedEditor] = useState<CodeDockEditorTarget | null>(
    null,
  );
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchingEditor, setLaunchingEditor] =
    useState<CodeDockEditorTarget | null>(null);
  const [launchLink, setLaunchLink] = useState<string | null>(null);
  const [showLaunchProgress, setShowLaunchProgress] = useState(false);
  const [launchMessage, setLaunchMessage] = useState(
    "Preparing your workspace and opening your editor.",
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const disabled = loading || (!isHost && !launchAllowed);

  async function handleLaunchEditor(editor: CodeDockEditorTarget) {
    setLaunchError(null);
    setLaunchingEditor(editor);
    setLaunchLink(null);
    setShowLaunchProgress(true);
    setLaunchMessage("Preparing your workspace and opening your editor.");

    const fallbackTimer = window.setTimeout(() => {
      setLaunchMessage(
        "Still waiting? Your editor should open automatically in a moment.",
      );
    }, 2500);

    try {
      const response = await launchIDE(editor, true);
      if (response.deep_link) {
        setLaunchLink(response.deep_link);
      }
      setLaunchMessage(`Opening ${EDITOR_LABELS[editor]}…`);
      window.location.assign(response.deep_link);
    } catch (err) {
      setLaunchError(
        err instanceof Error
          ? err.message
          : "Failed to launch. Please try again.",
      );
      setShowLaunchProgress(false);
      setLaunchingEditor(null);
    } finally {
      window.clearTimeout(fallbackTimer);
    }
  }

  async function handleCopyLink(editor: CodeDockEditorTarget) {
    try {
      const response = await launchIDE(editor, true);
      if (response.deep_link) {
        await navigator.clipboard.writeText(response.deep_link);
        setCopiedEditor(editor);
        setLaunchLink(response.deep_link);
        setTimeout(() => setCopiedEditor(null), 2000);
      }
    } catch (err) {
      setLaunchError(
        err instanceof Error
          ? err.message
          : "Failed to copy link. Please try again.",
      );
    }
  }

  return (
    <>
      <Card>
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(36,166,242,0.12)] border border-[rgba(36,166,242,0.2)]">
            {/* IDE icon approximation */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4.5 w-4.5 h-[18px] w-[18px] text-[rgb(36,166,242)]"
              aria-hidden="true"
            >
              <path
                d="M17 3L7 12.5L17 22M7 3l10 9.5L7 22"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Open IDE</h3>
            <p className="mt-0.5 text-sm text-[rgb(158,183,211)]">
              Generate a one-time launch link and continue the session inside
              your editor.
            </p>
          </div>
        </div>

        {/* Readiness warning */}
        {!launchAllowed && launchReason && !isHost ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-[rgba(249,145,53,0.2)] bg-[rgba(249,145,53,0.07)] px-4 py-3.5">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[rgb(249,145,53)]"
              aria-hidden="true"
            >
              <path
                d="M8 2L14.928 14H1.072L8 2Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M8 6v4M8 11.5h.01"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-sm leading-relaxed text-[rgb(249,145,53)]">
              {launchReason}
            </p>
          </div>
        ) : null}

        {isHost && !launchAllowed && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-[rgba(36,166,242,0.2)] bg-[rgba(36,166,242,0.05)] px-4 py-3.5">
            <p className="text-sm leading-relaxed text-[rgb(36,166,242)]">
              <strong>Host Note:</strong> You can launch now to set up the
              workspace. Guests will be able to join once you have opened the
              project in your editor.
            </p>
          </div>
        )}

        {/* Launch error */}
        {launchError ? (
          <div className="mt-4 flex items-start gap-3 rounded-[12px] border border-[rgba(255,90,107,0.25)] bg-[rgba(255,90,107,0.08)] px-4 py-3">
            <p className="text-sm text-[rgb(255,160,170)]">{launchError}</p>
          </div>
        ) : null}

        {/* Launch button */}
        <div className="mt-5">
          <Button
            disabled={disabled}
            onClick={() => {
              setShowModal(true);
              setLaunchError(null);
              setLaunchLink(null);
              setShowLaunchProgress(false);
              setLaunchingEditor(null);
              setLaunchMessage(
                "Preparing your workspace and opening your editor.",
              );
            }}
          >
            Open IDE
          </Button>
        </div>
      </Card>

      {/* IDE Selection Modal */}
      {showModal &&
        mounted &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowModal(false);
              }}
            >
              <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/[0.12] bg-[rgba(8,18,36,0.98)] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent pointer-events-none" />

                <div className="relative p-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">
                        Choose your IDE
                      </h2>
                      <p className="mt-2 text-sm font-medium text-[rgb(158,183,211)]">
                        Open this CodeDock room in the editor where you
                        installed the CodeDock extension.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setLaunchError(null);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] text-[rgb(148,163,184)] transition-all hover:bg-white/[0.1] hover:text-white"
                      aria-label="Close modal"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {/* Editor Options */}
                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    {[EDITOR_TARGETS.VSCODE, EDITOR_TARGETS.ANTIGRAVITY].map(
                      (editor) => (
                        <div
                          key={editor}
                          onClick={() => setSelectedEditor(editor)}
                          className={`group relative rounded-2xl border-2 p-5 cursor-pointer transition-all duration-200 ${
                            selectedEditor === editor
                              ? "border-[rgb(36,166,242)] bg-[rgba(36,166,242,0.1)] shadow-[0_8px_20px_rgba(36,166,242,0.15)]"
                              : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                          }`}
                        >
                          <h3
                            className={`font-bold transition-colors ${selectedEditor === editor ? "text-white" : "text-[rgb(200,215,230)]"}`}
                          >
                            {EDITOR_LABELS[editor]}
                          </h3>
                          <p className="mt-1 text-[11px] font-medium leading-relaxed text-[rgb(120,140,165)]">
                            {EDITOR_DESCRIPTIONS[editor]}
                          </p>
                          {selectedEditor === editor && (
                            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[rgb(36,166,242)] shadow-[0_0_8px_rgba(36,166,242,0.8)]" />
                          )}
                        </div>
                      ),
                    )}
                  </div>

                  {/* Error Message */}
                  {launchError && (
                    <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                      <p className="text-sm font-medium text-red-400">
                        {launchError}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-8 space-y-3">
                    {selectedEditor ? (
                      <>
                        <Button
                          disabled={launchingEditor !== null}
                          onClick={() => {
                            void handleLaunchEditor(selectedEditor);
                          }}
                          className="w-full py-6 text-sm font-bold shadow-lg"
                        >
                          {launchingEditor === selectedEditor
                            ? "Opening Session…"
                            : `Launch ${EDITOR_LABELS[selectedEditor]}`}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={launchingEditor !== null}
                          onClick={() => {
                            void handleCopyLink(selectedEditor);
                          }}
                          className="w-full py-6 text-sm font-bold border-white/[0.12]"
                        >
                          {copiedEditor === selectedEditor
                            ? "Deep Link Copied!"
                            : `Copy ${EDITOR_LABELS[selectedEditor]} Protocol Link`}
                        </Button>
                      </>
                    ) : (
                      <div className="h-[120px] flex items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01]">
                        <p className="text-xs font-bold uppercase tracking-widest text-[rgb(100,120,150)]">
                          Select an editor to continue
                        </p>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      disabled={launchingEditor !== null}
                      onClick={() => {
                        setShowModal(false);
                        setLaunchError(null);
                        setSelectedEditor(null);
                      }}
                      className="w-full py-6 text-sm font-bold text-[rgb(148,163,184)] hover:text-white"
                    >
                      Go Back
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {showLaunchProgress && launchingEditor && (
              <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/90 p-4">
                <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/[0.14] bg-[rgba(10,20,40,0.95)] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)]">
                  <div className="relative p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                          Opening CodeDock in {EDITOR_LABELS[launchingEditor]}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-[rgb(158,183,211)]">
                          {launchMessage}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLaunchProgress(false);
                          setLaunchingEditor(null);
                          setLaunchLink(null);
                          setLaunchError(null);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] text-[rgb(148,163,184)] transition-all hover:bg-white/[0.1] hover:text-white"
                        aria-label="Close launch progress"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-5 w-5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-8 rounded-[26px] border border-white/[0.08] bg-white/[0.03] p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(239,102,46,0.1)]">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-6 w-6 text-[rgb(239,102,46)]"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 4v8l4 4"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              stroke="currentColor"
                              strokeWidth="1.75"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Launch in progress
                          </p>
                          <p className="mt-1 text-xs text-[rgb(158,183,211)]">
                            Your browser is handing off the session to the
                            editor.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full border border-white/[0.08] bg-white/[0.06] grid place-items-center">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5 animate-spin text-[rgb(239,102,46)]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                        </div>
                        <p className="text-sm text-[rgb(158,183,211)]">
                          Waiting for the editor to open...
                        </p>
                      </div>

                      {launchLink ? (
                        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-slate-950/70 p-4 text-sm text-[rgb(158,183,211)]">
                          <p className="font-medium text-white">
                            Manual launch link
                          </p>
                          <p className="mt-2 break-words text-[rgb(181,197,219)]">
                            {launchLink}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <Button
                          variant="default"
                          className="w-full py-5 text-sm font-semibold"
                          onClick={() => {
                            if (launchLink) {
                              void navigator.clipboard.writeText(launchLink);
                              setLaunchMessage(
                                "Launch link copied. Paste it into your browser or editor if needed.",
                              );
                            }
                          }}
                        >
                          Copy launch link
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full py-5 text-sm font-semibold"
                          onClick={() => {
                            setShowLaunchProgress(false);
                          }}
                        >
                          Dismiss
                        </Button>
                      </div>

                      <p className="mt-4 text-xs leading-relaxed text-[rgb(120,140,165)]">
                        If your editor does not open automatically, use the link
                        above or try again from the room details page.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body,
        )}
    </>
  );
}
