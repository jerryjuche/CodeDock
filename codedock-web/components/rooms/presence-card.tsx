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
      <h3 className="text-lg font-semibold">Members</h3>

      {loading ? (
        <p className="mt-3 text-sm text-zinc-400">Loading presence...</p>
      ) : error ? (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      ) : !presence ? (
        <p className="mt-3 text-sm text-zinc-400">No presence data available.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-zinc-400">
            {presence.connected_count} connected · {presence.total_members} total
          </p>

          <div className="mt-4 space-y-3">
            {presence.members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-100">{member.email}</div>
                  <div className="text-xs text-zinc-500">{member.role}</div>
                </div>
                <div
                  className={`text-xs font-medium ${
                    member.connected ? "text-emerald-300" : "text-zinc-500"
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