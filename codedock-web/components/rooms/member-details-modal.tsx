import { useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X, Activity, FileText, ArrowUpRight, Clock, ChevronRight } from "lucide-react";
import type { RoomPresenceMember } from "@/types/room";
import { getDiffStrategy, getFileExtension } from "@/lib/diff/diff-strategy";

/** Deterministic hue from email for avatar background */
function colorFromEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function MemberDetailsModal({
  member,
  activities = [],
  roomId,
  onClose,
}: {
  member: RoomPresenceMember;
  activities?: any[];
  roomId: string;
  onClose: () => void;
}) {
  const memberActivities = useMemo(() => {
    return activities.filter((a) => a.user_id === member.user_id);
  }, [activities, member.user_id]);

  const editActivities = useMemo(() => {
    return memberActivities.filter((a) => a.type === "file_edited" || a.activity_type === "file_edited");
  }, [memberActivities]);

  const fileDiffs = useMemo(() => {
    const fileData = new Map<string, {
      file: string;
      earliestCode: string;
      latestCode: string;
      hasCode: boolean;
      lastTimestamp: string;
      activityCount: number;
    }>();

    // Sort edit activities chronologically to properly identify earliest and latest code state
    const sortedEdits = [...editActivities].sort(
      (a, b) => new Date(a.created_at || a.timestamp).getTime() - new Date(b.created_at || b.timestamp).getTime()
    );

    sortedEdits.forEach((activity) => {
      const file = activity.file_path || activity.details?.file || "Unknown file";
      const code = typeof activity.details?.code === "string" ? activity.details.code : "";
      const timestamp = activity.created_at || activity.timestamp || new Date().toISOString();

      const existing = fileData.get(file);
      if (existing) {
        existing.activityCount++;
        if (code) {
          if (!existing.hasCode) {
            existing.earliestCode = code;
            existing.hasCode = true;
          }
          existing.latestCode = code;
        }
        if (new Date(timestamp).getTime() > new Date(existing.lastTimestamp).getTime()) {
          existing.lastTimestamp = timestamp;
        }
      } else {
        fileData.set(file, {
          file,
          earliestCode: code,
          latestCode: code,
          hasCode: Boolean(code),
          lastTimestamp: timestamp,
          activityCount: 1,
        });
      }
    });

    let totalAdded = 0;
    let totalRemoved = 0;

    const list = Array.from(fileData.values()).map((data) => {
      let added = 0;
      let removed = 0;

      if (data.hasCode) {
        const extension = getFileExtension(data.file);
        const chunks = getDiffStrategy(extension)(data.earliestCode, data.latestCode);
        added = chunks
          .filter((c) => c.type === "add")
          .reduce((s, c) => s + c.lines.length, 0);
        removed = chunks
          .filter((c) => c.type === "remove")
          .reduce((s, c) => s + c.lines.length, 0);
      }

      totalAdded += added;
      totalRemoved += removed;

      return {
        file: data.file,
        lastTimestamp: data.lastTimestamp,
        activityCount: data.activityCount,
        added,
        removed,
      };
    });

    return {
      files: list.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()),
      totalAdded,
      totalRemoved,
    };
  }, [editActivities]);

  const filesModifiedCount = fileDiffs.files.length;
  const initials = member.email.slice(0, 2).toUpperCase();
  const avatarColor = colorFromEmail(member.email);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.1] bg-[rgba(8,18,36,0.98)] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent pointer-events-none" />
        
        {/* Compact, Clean Header */}
        <div className="relative flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-md ring-1 ring-white/10"
            style={{ background: avatarColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold tracking-tight text-white">
              {member.email}
            </h2>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${member.connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`} />
              <span className="text-[9px] font-bold text-[rgb(110,130,155)] uppercase tracking-wider">
                {member.role} • {member.connected ? "Active" : "Away"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-[rgb(148,163,184)] transition-all hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Compact Premium Stats Row */}
        <div className="grid grid-cols-2 gap-2.5 px-5 py-4">
          <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition-all hover:bg-white/[0.04]">
            <div className="absolute top-0 right-0 p-2 opacity-5 transition-opacity group-hover:opacity-10">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-[rgb(90,110,140)]">Line Changes</p>
            <div className="mt-1 text-lg font-black tracking-tight flex items-baseline gap-1">
              <span className="text-emerald-400">+{fileDiffs.totalAdded}</span>
              <span className="text-white/20 text-sm font-light">/</span>
              <span className="text-rose-400">-{fileDiffs.totalRemoved}</span>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition-all hover:bg-white/[0.04]">
            <div className="absolute top-0 right-0 p-2 opacity-5 transition-opacity group-hover:opacity-10">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-[rgb(90,110,140)]">Files Modified</p>
            <p className="mt-1 text-xl font-black text-white tracking-tight">{filesModifiedCount}</p>
          </div>
        </div>

        {/* Files list (Compact) */}
        <div className="px-5 pb-4">
          <p className="mb-2 px-0.5 text-[9px] font-extrabold uppercase tracking-widest text-[rgb(90,110,140)]">
            Recent Changes
          </p>
          <div className="max-h-[140px] space-y-1 overflow-y-auto pr-1 scrollbar-hide">
            {fileDiffs.files.length > 0 ? (
              fileDiffs.files.map((group) => (
                <Link
                  key={group.file}
                  href={`/rooms/${roomId}/review/${member.user_id}?file=${encodeURIComponent(group.file)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-white/[0.02] bg-white/[0.02] px-3 py-2 transition-all hover:border-white/[0.08] hover:bg-white/[0.05]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[rgb(210,225,240)] group-hover:text-sky-400 transition-colors">
                      {group.file}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[9px] text-[rgb(110,125,145)] uppercase font-bold tracking-wider">
                      <Clock className="h-2 w-2" />
                      {formatTimestamp(group.lastTimestamp)}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 text-[9px] font-extrabold font-mono">
                      {group.added > 0 && <span className="text-emerald-400">+{group.added}</span>}
                      {group.removed > 0 && <span className="text-rose-400">-{group.removed}</span>}
                      {group.added === 0 && group.removed === 0 && (
                        <span className="text-slate-500 font-normal">0 edits</span>
                      )}
                    </div>
                    <ChevronRight className="h-3 w-3 text-white/20 group-hover:text-white/50 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] p-5 text-center">
                <p className="text-[10px] font-medium text-[rgb(90,110,140)]">No activity recorded</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-white/[0.06] bg-white/[0.01] px-5 py-4">
          <div className="flex gap-2">
            {fileDiffs.files.length > 0 && (
              <Link
                href={`/rooms/${roomId}/review/${member.user_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-[2]"
              >
                <Button className="w-full h-9 text-xs font-bold group" size="sm">
                  <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                    Review Changes
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className={`flex-1 h-9 text-xs font-bold text-[rgb(148,163,184)] border-white/[0.1] hover:bg-white/5 ${fileDiffs.files.length === 0 ? "w-full" : ""}`}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}
