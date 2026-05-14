"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DiffView } from "@/components/ui/diff-view";
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

    return Array.from(groups.values()).sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
  }, [memberActivities]);

  const activeFile = selectedFile ? fileGroups.find((g) => g.file === selectedFile) || fileGroups[0] : fileGroups[0];
  const memberEmail = memberActivities[0]?.email || userId;

  if (loading) return <div className="p-12 text-center text-white opacity-50">Loading session data...</div>;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="flex flex-col gap-5">
        
        {/* Compact Navigation */}
        <div className="flex items-center justify-between">
          <Link href={`/rooms/${roomId}`} className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to session
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
            <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
            Activity Log Verified
          </div>
        </div>

        {/* Tightened Header */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-900/50 px-5 py-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-inner" style={{ background: colorFromEmail(memberEmail) }}>
                {memberEmail.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">{memberEmail}</h1>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 mt-0.5">Contribution Review</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CompactStatPill icon={<Activity className="h-3 w-3 text-emerald-400" />} label={`${memberActivities.length} commits`} />
              <CompactStatPill icon={<FileText className="h-3 w-3 text-sky-400" />} label={`${fileGroups.length} files`} />
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
            
            {/* Thinned Sidebar */}
            <aside className="space-y-3">
              <p className="px-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Session Files</p>
              <nav className="space-y-1 scrollbar-hide">
                {fileGroups.map((group) => {
                  const isActive = activeFile?.file === group.file;
                  return (
                    <button key={group.file} onClick={() => setSelectedFile(group.file)} className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${isActive ? "border-sky-500/30 bg-sky-500/10" : "border-transparent bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                      <FileText className={`h-3.5 w-3.5 ${isActive ? "text-sky-400" : "text-slate-600"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs font-bold ${isActive ? "text-white" : "text-slate-400"}`}>{group.file}</p>
                        <p className="mt-0.5 text-[8px] font-bold text-slate-600 uppercase tracking-wider">{group.snapshots.length} variants</p>
                      </div>
                      <ChevronRight className={`h-3 w-3 transition-all ${isActive ? "text-sky-400 opacity-100" : "opacity-0"}`} />
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Main Content: Unified Diff */}
            <section className="min-w-0 space-y-4">
              {activeFile && (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-sky-500/10 text-sky-400">
                        <FileText className="h-3 w-3" />
                      </div>
                      <span className="text-[11px] font-bold text-white tracking-tight">{activeFile.file}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">{activeFile.language}</span>
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400 uppercase tracking-widest">Active Variant</span>
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500/20 to-emerald-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl">
                      <DiffView 
                        oldCode={activeFile.earliestCode} 
                        newCode={activeFile.latestCode} 
                        language={activeFile.language} 
                      />
                    </div>
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
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5">
      {icon}
      <span className="text-[10px] font-bold text-slate-400">{label}</span>
    </div>
  );
}
