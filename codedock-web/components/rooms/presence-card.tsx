// components/rooms/presence-card.tsx
import { Card } from "@/components/ui/card";
import type { RoomPresence, RoomPresenceMember } from "@/types/room";

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
  onRetry,
  onMemberClick,
}: {
  presence: RoomPresence | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  onMemberClick?: (member: RoomPresenceMember) => void;
}) {
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
                  <div className="mt-0.5 text-[11px] capitalize text-[rgb(158,183,211)]">
                    {member.role}
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
