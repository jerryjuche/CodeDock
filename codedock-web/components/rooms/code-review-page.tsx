"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DiffView } from "@/components/ui/diff-view";
import { useRoomActivities } from "@/hooks/use-room-activities";
import { ArrowLeft, FileText, Activity, GitBranch } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatTimestamp = (timestamp: string) => {
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
  const { activities, loading, error } = useRoomActivities(roomId);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

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

  const activeFile = selectedFile
    ? fileGroups.find((g) => g.file === selectedFile) || fileGroups[0]
    : fileGroups[0];
  const memberEmail = memberActivities[0]?.email || userId;

  if (loading)
    return (
      <div className="p-12 text-center text-white opacity-50">
        Loading session data...
      </div>
    );

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="flex flex-col gap-5">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href={`/rooms/${roomId}`}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to session
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded text-xs font-semibold text-white"
                style={{ background: colorFromEmail(memberEmail) }}
              >
                {memberEmail.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-base font-semibold text-white">
                  {memberEmail}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Code Contribution Review
                </p>
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
        </div>

        {fileGroups.length === 0 ? (
          <div className="py-20 text-center opacity-40">
            <GitBranch className="mx-auto h-8 w-8 mb-4" />
            <p className="text-sm font-medium">No code changes recorded yet</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            {/* Sidebar */}
            <aside className="space-y-2">
              <p className="px-2 text-xs font-semibold text-slate-500">Files</p>
              <nav className="space-y-1 scrollbar-hide">
                {fileGroups.map((group) => {
                  const isActive = activeFile?.file === group.file;
                  return (
                    <button
                      key={group.file}
                      onClick={() => setSelectedFile(group.file)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs transition-colors ${
                        isActive
                          ? "bg-slate-700/50 text-white font-medium"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-300"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{group.file}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Main Content: Unified Diff */}
            <section className="min-w-0 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto overflow-x-hidden scrollbar-hide hover:overflow-y-auto">
              {activeFile && (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                    <span className="text-sm font-medium text-white">
                      {activeFile.file}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {activeFile.language}
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-white/5">
                    <DiffView
                      oldCode={activeFile.earliestCode}
                      newCode={activeFile.latestCode}
                      language={activeFile.language}
                    />
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function StatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded px-2.5 py-1.5 bg-white/[0.03] border border-white/5">
      {icon}
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
