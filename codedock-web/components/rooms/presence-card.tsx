// components/rooms/presence-card.tsx
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import type { RoomPresence, RoomPresenceMember } from "@/types/room";
import { getDiffStrategy, getFileExtension } from "@/lib/diff/diff-strategy";

/** Deterministic hue from email for avatar background */
function colorFromEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 50%)`;
}

function Avatar({ email }: { email: string }) {
  const initials = email.slice(0, 2).toUpperCase();
  const bg = colorFromEmail(email);
  return (
    <div
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
      style={{ background: bg }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default function PresenceCard({
  presence,
  loading,
  error,
  activities = [],
  onRetry,
  onMemberClick,
}: {
  presence: RoomPresence | null;
  loading: boolean;
  error: string | null;
  activities?: any[];
  onRetry?: () => void;
  onMemberClick?: (member: RoomPresenceMember) => void;
}) {
  const memberDiffs = useMemo(() => {
    if (!presence?.members || !activities) return new Map<string, { added: number; removed: number }>();

    const diffMap = new Map<string, { added: number; removed: number }>();

    presence.members.forEach((member) => {
      // Filter edit activities for this member
      const editActivities = activities.filter(
        (a) => a.user_id === member.user_id && (a.type === "file_edited" || a.activity_type === "file_edited")
      );

      if (editActivities.length === 0) {
        diffMap.set(member.user_id, { added: 0, removed: 0 });
        return;
      }

      const fileData = new Map<string, { earliestCode: string; latestCode: string; hasCode: boolean; file: string }>();

      // Sort edit activities chronologically
      const sortedEdits = [...editActivities].sort(
        (a, b) => new Date(a.created_at || a.timestamp).getTime() - new Date(b.created_at || b.timestamp).getTime()
      );

      sortedEdits.forEach((activity) => {
        const file = activity.file_path || activity.details?.file || "Unknown file";
        const code = typeof activity.details?.code === "string" ? activity.details.code : "";

        const existing = fileData.get(file);
        if (existing) {
          if (code) {
            if (!existing.hasCode) {
              existing.earliestCode = code;
              existing.hasCode = true;
            }
            existing.latestCode = code;
          }
        } else {
          fileData.set(file, {
            file,
            earliestCode: code,
            latestCode: code,
            hasCode: Boolean(code),
          });
        }
      });

      let added = 0;
      let removed = 0;

      fileData.forEach((data) => {
        if (data.hasCode) {
          const extension = getFileExtension(data.file);
          const chunks = getDiffStrategy(extension)(data.earliestCode, data.latestCode);
          added += chunks
            .filter((c) => c.type === "add")
            .reduce((s, c) => s + c.lines.length, 0);
          removed += chunks
            .filter((c) => c.type === "remove")
            .reduce((s, c) => s + c.lines.length, 0);
        }
      });

      diffMap.set(member.user_id, { added, removed });
    });

    return diffMap;
  }, [presence?.members, activities]);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Members</h3>
        {presence && !loading && (
          <div className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  presence.connected_count > 0
                    ? "rgb(42,211,139)"
                    : "rgb(158,183,211)",
                boxShadow:
                  presence.connected_count > 0
                    ? "0 0 5px rgba(42,211,139,0.5)"
                    : "none",
              }}
            />
            <span className="text-[11px] font-medium text-[rgb(158,183,211)]">
              {presence.connected_count} / {presence.total_members} online
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-5 space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-4 py-3"
            >
              <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm text-[rgb(255,160,170)] mb-2">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs font-medium rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      ) : !presence ? (
        <p className="mt-3 text-sm text-[rgb(158,183,211)]">
          No presence data available.
        </p>
      ) : (
        <div className="mt-5 space-y-2.5">
          {presence.members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 transition-colors cursor-pointer hover:bg-white/[0.06]"
              onClick={() => onMemberClick?.(member)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar email={member.email} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {member.email}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px] capitalize text-[rgb(158,183,211)]">
                      {member.role}
                    </span>
                    {(() => {
                      const diff = memberDiffs.get(member.user_id);
                      if (!diff || (diff.added === 0 && diff.removed === 0)) return null;
                      return (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                          {diff.added > 0 && <span className="text-emerald-400">+{diff.added}</span>}
                          {diff.removed > 0 && <span className="text-rose-400">-{diff.removed}</span>}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: member.connected
                      ? "rgb(42,211,139)"
                      : "rgb(158,183,211)",
                    boxShadow: member.connected
                      ? "0 0 5px rgba(42,211,139,0.4)"
                      : "none",
                  }}
                />
                <span
                  className="text-xs font-medium"
                  style={{
                    color: member.connected
                      ? "rgb(42,211,139)"
                      : "rgb(158,183,211)",
                  }}
                >
                  {member.connected ? "Connected" : "Offline"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
