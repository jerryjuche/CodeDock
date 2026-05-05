// components/rooms/open-ide-button.tsx
"use client";

import { useState } from "react";
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

  const disabled = loading || (!isHost && !launchAllowed);

  async function handleLaunchEditor(editor: CodeDockEditorTarget) {
    setLaunchError(null);
    setLaunchingEditor(editor);
    try {
      await launchIDE(editor);
    } catch (err) {
      setLaunchError(
        err instanceof Error
          ? err.message
          : "Failed to launch. Please try again.",
      );
    } finally {
      setLaunchingEditor(null);
    }
  }

  async function handleCopyLink(editor: CodeDockEditorTarget) {
    try {
      const response = await launchIDE(editor, true);
      if (response.deep_link) {
        await navigator.clipboard.writeText(response.deep_link);
        setCopiedEditor(editor);
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
            }}
          >
            Open IDE
          </Button>
        </div>
      </Card>

      {/* IDE Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl mx-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Choose your IDE
                </h2>
                <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                  Open this CodeDock room in the editor where you installed the
                  CodeDock extension.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setLaunchError(null);
                }}
                className="text-[rgb(158,183,211)] hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                  stroke="currentColor"
                  strokeWidth="2"
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
                    className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
                      selectedEditor === editor
                        ? "border-[rgb(36,166,242)] bg-[rgba(36,166,242,0.1)]"
                        : "border-[rgba(158,183,211,0.2)] hover:border-[rgb(158,183,211)]"
                    }`}
                  >
                    <h3 className="font-semibold text-white">
                      {EDITOR_LABELS[editor]}
                    </h3>
                    <p className="mt-1 text-xs text-[rgb(158,183,211)]">
                      {EDITOR_DESCRIPTIONS[editor]}
                    </p>
                  </div>
                ),
              )}
            </div>

            {/* Error Message */}
            {launchError && (
              <div className="mt-4 flex items-start gap-3 rounded-[12px] border border-[rgba(255,90,107,0.25)] bg-[rgba(255,90,107,0.08)] px-4 py-3">
                <p className="text-sm text-[rgb(255,160,170)]">{launchError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 space-y-3">
              {selectedEditor && (
                <>
                  <Button
                    disabled={launchingEditor !== null}
                    onClick={() => {
                      void handleLaunchEditor(selectedEditor);
                    }}
                    className="w-full"
                  >
                    {launchingEditor === selectedEditor
                      ? "Opening…"
                      : `Open in ${EDITOR_LABELS[selectedEditor]}`}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={launchingEditor !== null}
                    onClick={() => {
                      void handleCopyLink(selectedEditor);
                    }}
                    className="w-full"
                  >
                    {copiedEditor === selectedEditor
                      ? "Link copied!"
                      : `Copy ${EDITOR_LABELS[selectedEditor]} link`}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                disabled={launchingEditor !== null}
                onClick={() => {
                  setShowModal(false);
                  setLaunchError(null);
                  setSelectedEditor(null);
                }}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
