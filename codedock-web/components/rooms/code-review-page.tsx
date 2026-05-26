"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { DiffView } from "@/components/ui/diff-view";
import { getDiffStrategy, getFileExtension } from "@/lib/diff/diff-strategy";
import { useRoomActivities } from "@/hooks/use-room-activities";
import { ArrowLeft, FileText, Activity, GitBranch } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function colorFromEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function CodeReviewPageClient({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string;
}) {
  const { activities, loading } = useRoomActivities(roomId);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fileParam = params.get("file");
      if (fileParam) {
        setSelectedFile(fileParam);
      }
    }
  }, []);

  const memberActivities = useMemo(() => {
    return activities
      .filter(
        (a: any) =>
          a.user_id === userId &&
          (a.type === "file_edited" || a.activity_type === "file_edited"),
      )
      .map((a: any) => ({
        id: a.id,
        email: a.email || a.user_id,
        timestamp: a.created_at || a.timestamp || new Date().toISOString(),
        file_path: a.file_path,
        code: typeof a.details?.code === "string" ? a.details.code : undefined,
        language: a.details?.language,
      }))
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
  }, [activities, userId]);

  const fileGroups = useMemo(() => {
    const groups = new Map<string, any>();
    memberActivities.forEach((activity) => {
      const file = activity.file_path || "Unknown file";
      const existing = groups.get(file);

      if (existing) {
        if (activity.code) {
          existing.snapshots.push({
            code: activity.code,
            timestamp: activity.timestamp,
          });

          if (!existing.hasCode) {
            existing.earliestCode = activity.code;
            existing.hasCode = true;
          }

          existing.latestCode = activity.code;
          existing.lastTimestamp = activity.timestamp;
        }
      } else {
        groups.set(file, {
          file,
          language: activity.language || "text",
          snapshots: activity.code
            ? [{ code: activity.code, timestamp: activity.timestamp }]
            : [],
          latestCode: activity.code || "",
          earliestCode: activity.code || "",
          hasCode: Boolean(activity.code),
          firstTimestamp: activity.timestamp,
          lastTimestamp: activity.timestamp,
        });
      }
    });

    return Array.from(groups.values())
      .map((group) => {
        if (!group.hasCode) {
          return { ...group, added: 0, removed: 0, hasDiffs: false };
        }

        const extension = getFileExtension(group.file);
        const chunks = getDiffStrategy(extension)(
          group.earliestCode,
          group.latestCode,
        );
        
        const added = chunks
          .filter((c) => c.type === "add")
          .reduce((s, c) => s + c.lines.length, 0);
        const removed = chunks
          .filter((c) => c.type === "remove")
          .reduce((s, c) => s + c.lines.length, 0);

        return {
          ...group,
          added,
          removed,
          hasDiffs: added > 0 || removed > 0,
        };
      })
      .filter((group) => group.hasDiffs)
      .sort(
        (a, b) =>
          new Date(b.lastTimestamp).getTime() -
          new Date(a.lastTimestamp).getTime(),
      );
  }, [memberActivities]);

  const filteredFileGroups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return fileGroups;
    return fileGroups.filter((g) => g.file.toLowerCase().includes(q));
  }, [fileGroups, searchTerm]);

  const activeFile = useMemo(() => {
    if (!filteredFileGroups || filteredFileGroups.length === 0) return null;
    if (selectedFile)
      return (
        filteredFileGroups.find((g) => g.file === selectedFile) ||
        filteredFileGroups[0]
      );
    return filteredFileGroups[0];
  }, [filteredFileGroups, selectedFile]);

  const memberEmail = memberActivities[0]?.email || userId;

  if (loading)
    return (
      <div className="p-12 text-center text-white opacity-50">
        Loading session data...
      </div>
    );

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/rooms/${roomId}`}
            className="flex items-center gap-3 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to session
          </Link>
        </div>

        <header className="rounded-3xl border border-slate-800/70 bg-slate-950/80 px-6 py-5 shadow-sm shadow-slate-950/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center text-sm font-semibold text-white"
                style={{ background: colorFromEmail(memberEmail) }}
              >
                {memberEmail.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-lg font-semibold text-white">
                  {memberEmail}
                </div>
                <div className="text-sm text-slate-400">
                  Code Contribution Review
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatPill
                icon={<Activity className="h-4 w-4 text-slate-400" />}
                label={`${memberActivities.length} changes`}
              />
              <StatPill
                icon={<FileText className="h-4 w-4 text-slate-400" />}
                label={`${fileGroups.length} files`}
              />
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-3">
            <div className="sticky top-24 space-y-3">
              <div>
                <label htmlFor="file-search" className="sr-only">
                  Search files
                </label>
                <input
                  id="file-search"
                  aria-label="Search files"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search files"
                  className="w-full rounded-md bg-slate-950/80 border border-slate-800/70 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <nav className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-hide">
                {filteredFileGroups.map((group) => {
                  const isActive = activeFile?.file === group.file;
                  return (
                    <button
                      key={group.file}
                      onClick={() => setSelectedFile(group.file)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${isActive ? "bg-slate-800/80 text-white font-medium animate-in fade-in duration-100" : "text-slate-300 hover:bg-slate-900/70"}`}
                      aria-current={isActive ? "true" : undefined}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0 text-slate-400 mt-0.5" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{group.file}</div>
                          <div className="text-[10px] text-slate-500 font-medium uppercase mt-0.5 tracking-wider">
                            {formatTimestamp(group.lastTimestamp)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 text-[10px] font-extrabold font-mono ml-2">
                        {group.added > 0 && <span className="text-emerald-400">+{group.added}</span>}
                        {group.removed > 0 && <span className="text-rose-400">-{group.removed}</span>}
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="min-w-0 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-hidden scrollbar-hide hover:overflow-y-auto">
            {activeFile ? (
              <>
                <div className="flex items-center justify-between rounded-md border border-slate-800/70 bg-slate-950/80 px-4 py-3">
                  <div>
                    <div className="text-base font-medium text-white truncate">
                      {activeFile.file}
                    </div>
                    <div className="text-[13px] text-slate-400">
                      {activeFile.language} •{" "}
                      {formatTimestamp(activeFile.lastTimestamp)}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    {activeFile.snapshots.length} variants
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-800/70">
                  <DiffView
                    filePath={activeFile.file}
                    oldCode={activeFile.earliestCode}
                    newCode={activeFile.latestCode}
                    language={activeFile.language}
                  />
                </div>
              </>
            ) : (
              <div className="py-20 text-center opacity-40">
                <GitBranch className="mx-auto h-8 w-8 mb-4" />
                <p className="text-sm font-medium">
                  No files match your search
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function StatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded px-2.5 py-1.5 bg-slate-900/80 border border-slate-800/70">
      {icon}
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}
