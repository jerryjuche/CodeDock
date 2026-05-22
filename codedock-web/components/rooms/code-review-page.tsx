"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DiffView } from "@/components/ui/diff-view";
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
        code: a.details?.code,
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
          lastTimestamp: activity.timestamp,
        });
      }
    });

    return Array.from(groups.values()).sort(
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

        <header className="rounded-lg border border-white/6 bg-white/[0.02] px-6 py-5">
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
                  className="w-full rounded-md bg-white/[0.02] border border-white/6 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <nav className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-hide">
                {filteredFileGroups.map((group) => {
                  const isActive = activeFile?.file === group.file;
                  return (
                    <button
                      key={group.file}
                      onClick={() => setSelectedFile(group.file)}
                      className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive ? "bg-sky-600/20 text-white font-medium" : "text-slate-300 hover:bg-white/5"}`}
                      aria-current={isActive ? "true" : undefined}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0 text-slate-400 mt-1" />
                      <div className="min-w-0">
                        <div className="truncate">{group.file}</div>
                        <div className="text-[12px] text-slate-500">
                          {group.snapshots.length} variants •{" "}
                          {formatTimestamp(group.lastTimestamp)}
                        </div>
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
                <div className="flex items-center justify-between rounded-md border border-white/6 bg-white/[0.02] px-4 py-3">
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

                <div className="overflow-hidden rounded-md border border-white/6">
                  <DiffView
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
    <div className="flex items-center gap-2 rounded px-2.5 py-1.5 bg-white/[0.03] border border-white/6">
      {icon}
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}
