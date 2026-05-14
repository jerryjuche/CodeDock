import { useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X, Activity, FileText, ArrowUpRight, Clock, ChevronRight } from "lucide-react";
import type { RoomPresenceMember } from "@/types/room";

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

  const fileGroups = useMemo(() => {
    const groups = new Map<string, { file: string; count: number; lastTimestamp: string }>();

    editActivities.forEach((activity) => {
      const file = activity.file_path || activity.details?.file || "Unknown file";
      const existing = groups.get(file);
      if (existing) {
        existing.count++;
        if (new Date(activity.created_at || activity.timestamp).getTime() > new Date(existing.lastTimestamp).getTime()) {
          existing.lastTimestamp = activity.created_at || activity.timestamp;
        }
      } else {
        groups.set(file, {
          file,
          count: 1,
          lastTimestamp: activity.created_at || activity.timestamp || new Date().toISOString(),
        });
      }
    });

    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime(),
    );
  }, [editActivities]);

  const filesModifiedCount = fileGroups.length;
  const totalEdits = editActivities.length;
  const initials = member.email.slice(0, 2).toUpperCase();
  const avatarColor = colorFromEmail(member.email);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-white/[0.12] bg-[rgba(8,18,36,0.98)] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent pointer-events-none" />
        {/* Compact Header */}
        <div className="relative flex items-center gap-4 border-b border-white/[0.08] bg-white/[0.04] px-6 py-5">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-xl ring-1 ring-white/20"
            style={{ background: avatarColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold tracking-tight text-white">
              {member.email}
            </h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${member.connected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-slate-500'}`} />
              <span className="text-[11px] font-bold text-[rgb(120,140,165)] uppercase tracking-[0.15em]">
                {member.role} • {member.connected ? "Active" : "Away"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] text-[rgb(148,163,184)] transition-all hover:bg-white/[0.1] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Premium Stats Row */}
        <div className="grid grid-cols-2 gap-3 px-6 py-5">
          <div className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all hover:bg-white/[0.05]">
            <div className="absolute top-0 right-0 p-2 opacity-10 transition-opacity group-hover:opacity-20">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[rgb(100,120,150)]">Edits</p>
            <p className="mt-2 text-3xl font-black text-white tracking-tight">{totalEdits}</p>
          </div>
          <div className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all hover:bg-white/[0.05]">
            <div className="absolute top-0 right-0 p-2 opacity-10 transition-opacity group-hover:opacity-20">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[rgb(100,120,150)]">Files</p>
            <p className="mt-2 text-3xl font-black text-white tracking-tight">{filesModifiedCount}</p>
          </div>
        </div>

        {/* Files list (Compact) */}
        <div className="px-5 pb-5">
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[rgb(100,120,150)]">
            Recent Changes
          </p>
          <div className="max-h-[160px] space-y-1.5 overflow-y-auto pr-1 scrollbar-hide">
            {fileGroups.length > 0 ? (
              fileGroups.map((group) => (
                <div
                  key={group.file}
                  className="group flex items-center justify-between rounded-xl border border-transparent bg-white/[0.03] px-3 py-2 transition-colors hover:border-white/[0.06] hover:bg-white/[0.05]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[rgb(200,215,230)] group-hover:text-white transition-colors">
                      {group.file}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[rgb(100,120,150)] uppercase font-bold tracking-wider">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTimestamp(group.lastTimestamp)}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold text-[rgb(148,163,184)]">
                      {group.count}
                    </span>
                    <ChevronRight className="h-3 w-3 text-white/20 group-hover:text-white/40" />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-6 text-center">
                <p className="text-[11px] font-medium text-[rgb(100,120,150)]">No activity recorded</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-white/[0.06] bg-white/[0.01] px-5 py-4">
          <div className="flex gap-2">
            {fileGroups.length > 0 && (
              <Link
                href={`/rooms/${roomId}/review/${member.user_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-[2]"
              >
                <Button className="w-full py-6 text-sm font-bold group" size="sm">
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    Review Changes
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className={`flex-1 py-6 text-sm font-bold text-[rgb(148,163,184)] border-white/[0.12] hover:bg-white/5 ${fileGroups.length === 0 ? "w-full" : ""}`}
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
