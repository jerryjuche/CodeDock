import { Card } from "@/components/ui/card";
import type { RoomPresence } from "@/types/room";

export default function PresenceCard({
  presence,
  loading,
  error,
}: {
  presence: RoomPresence | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-white">Members</h3>

      {loading ? (
        <p className="mt-3 text-sm text-[rgb(158,183,211)]">Loading presence...</p>
      ) : error ? (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      ) : !presence ? (
        <p className="mt-3 text-sm text-[rgb(158,183,211)]">
          No presence data available.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-[rgb(158,183,211)]">
            {presence.connected_count} connected Â· {presence.total_members} total
          </p>

          <div className="mt-4 space-y-3">
            {presence.members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div>
                  <div className="text-sm font-medium text-white">{member.email}</div>
                  <div className="text-xs text-[rgb(158,183,211)]">{member.role}</div>
                </div>

                <div
                  className={`text-xs font-medium ${
                    member.connected ? "text-emerald-300" : "text-[rgb(158,183,211)]"
                  }`}
                >
                  {member.connected ? "Connected" : "Offline"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}