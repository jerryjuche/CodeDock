"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { useRoomActivities } from "@/hooks/use-room-activities";
import {
  ArrowLeft,
  FileText,
  Activity,
  Clock,
  GitBranch,
  Layers,
  ChevronRight,
} from "lucide-react";

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

function computeChangedLines(earliest: string, latest: string): number[] {
  if (!earliest || earliest === latest) return [];
  const oldLines = earliest.split("\n");
  const newLines = latest.split("\n");
  const changed: number[] = [];
  for (let i = 0; i < newLines.length; i++) {
    if (i >= oldLines.length || newLines[i] !== oldLines[i]) {
      changed.push(i + 1);
    }
  }
  return changed;
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
      .filter((a: any) => a.user_id === userId && (a.type === "file_edited" || a.activity_type === "file_edited"))
      .map((a: any) => ({
        id: a.id,
        email: a.email || a.user_id,
        timestamp: a.created_at || a.timestamp || new Date().toISOString(),
        file_path: a.file_path,
        code: a.details?.code,
        language: a.details?.language,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activities, userId]);

  const fileGroups = useMemo(() => {
    const groups = new Map<string, any>();
    memberActivities.forEach((activity) => {
      const file = activity.file_path || "Unknown file";
      const existing = groups.get(file);
      if (existing) {
        if (activity.code) {
          existing.snapshots.push({ code: activity.code, timestamp: activity.timestamp });
          existing.latestCode = activity.code;
          existing.lastTimestamp = activity.timestamp;
        }
      } else {
        groups.set(file, {
          file,
          language: activity.language || "text",
          snapshots: activity.code ? [{ code: activity.code, timestamp: activity.timestamp }] : [],
          latestCode: activity.code || "",
          earliestCode: activity.code || "",
          lastTimestamp: activity.timestamp,
        });
      }
    });

    return Array.from(groups.values()).map(g => ({
      ...g,
      changedLines: computeChangedLines(g.earliestCode, g.latestCode)
    })).sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
  }, [memberActivities]);

  const activeFile = selectedFile ? fileGroups.find((g) => g.file === selectedFile) || fileGroups[0] : fileGroups[0];
  const memberEmail = memberActivities[0]?.email || userId;

  if (loading) return <div className="p-12 text-center text-white opacity-50">Loading session data...</div>;

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="flex flex-col gap-6">
        
        {/* Compact Navigation */}
        <div className="flex items-center justify-between">
          <Link href={`/rooms/${roomId}`} className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[rgb(120,140,165)] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to session
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-sky-400 border border-white/[0.06]">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            Live Activity Feed
          </div>
        </div>

        {/* Thinned Header */}
        <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[rgba(8,18,36,0.6)] px-6 py-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-lg" style={{ background: colorFromEmail(memberEmail) }}>
                {memberEmail.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{memberEmail}</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[rgb(120,140,165)]">Contribution Review</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CompactStatPill icon={<Activity className="h-3.5 w-3.5 text-emerald-400" />} label={`${memberActivities.length} changes`} />
              <CompactStatPill icon={<FileText className="h-3.5 w-3.5 text-sky-400" />} label={`${fileGroups.length} files`} />
            </div>
          </div>
        </div>

        {fileGroups.length === 0 ? (
          <div className="py-20 text-center opacity-40">
            <GitBranch className="mx-auto h-10 w-10 mb-4" />
            <p className="text-sm font-medium">No code changes recorded yet</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            
            {/* Thinned Sidebar */}
            <aside className="space-y-4">
              <p className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[rgb(80,100,130)]">Session Files</p>
              <nav className="space-y-1.5 scrollbar-hide">
                {fileGroups.map((group) => {
                  const isActive = activeFile?.file === group.file;
                  return (
                    <button key={group.file} onClick={() => setSelectedFile(group.file)} className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${isActive ? "border-sky-500/30 bg-sky-500/[0.08]" : "border-transparent bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                      <FileText className={`h-3.5 w-3.5 ${isActive ? "text-sky-400" : "text-[rgb(100,120,140)]"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs font-bold ${isActive ? "text-white" : "text-[rgb(160,180,200)]"}`}>{group.file}</p>
                        <p className="mt-0.5 text-[9px] font-bold text-[rgb(100,120,140)] uppercase tracking-wider">{group.snapshots.length} edits</p>
                      </div>
                      <ChevronRight className={`h-3 w-3 transition-all ${isActive ? "text-sky-400 translate-x-0" : "text-white/0 -translate-x-1 group-hover:text-white/20 group-hover:translate-x-0"}`} />
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Thinned Main Content */}
            <section className="min-w-0 space-y-4">
              {activeFile && (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-bold text-white">{activeFile.file}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold text-[rgb(120,140,160)] uppercase tracking-widest">{activeFile.language}</span>
                      {activeFile.changedLines.length > 0 && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">+{activeFile.changedLines.length} lines</span>
                      )}
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950 shadow-2xl">
                    <CodeBlock language={activeFile.language} filename={activeFile.file} code={activeFile.latestCode} highlightLines={activeFile.changedLines} embedded={true} />
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

function CompactStatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2">
      {icon}
      <span className="text-[11px] font-bold text-[rgb(180,195,214)]">{label}</span>
    </div>
  );
}

function BackLink({ roomId }: { roomId: string }) {
  return (
    <Link href={`/rooms/${roomId}`} className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[rgb(120,140,165)] hover:text-white transition-colors">
      <ArrowLeft className="h-4 w-4" />
      Back to session
    </Link>
  );
}
