"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { useRooms } from "@/hooks/use-rooms";
import ActivityTimelineCard, {
  ActivityEvent,
} from "@/components/rooms/activity-timeline-card";

export default function ActivityPage() {
  const { rooms, loading, error } = useRooms();

  const events: ActivityEvent[] = useMemo(() => {
    return rooms
      .map((room) => ({
        id: `${room.id}-status`,
        type: "member_connected" as const,
        user_id: room.id,
        email: room.owner_user_id,
        subject: room.name,
        timestamp: new Date().toISOString(),
        details: {
          file:
            room.source_type === "github_repo"
              ? `${String(room.source_metadata?.repo_owner ?? "repo")}/${String(
                  room.source_metadata?.repo_name ?? "unknown",
                )}`
              : room.source_type === "local_workspace"
              ? String(room.source_metadata?.workspace_label ?? "local workspace")
              : "workspace",
        },
      }))
      .reverse();
  }, [rooms]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
      <div className="mb-8 rounded-[28px] border border-white/10 bg-slate-950 p-8 shadow-2xl shadow-black/20">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-[rgb(158,183,211)]">
            Live activity
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-white">
            Collaboration feed
          </h1>
          <p className="mt-4 text-sm leading-7 text-[rgb(158,183,211)]">
            Monitor active rooms, recent status updates, and workspace sync
            state in real time.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.75fr]">
        <div className="space-y-6">
          <ActivityTimelineCard
            events={events}
            loading={loading}
            error={error}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[rgb(158,183,211)]">
                  Overview
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Active room summary
                </h2>
              </div>

              <div className="grid gap-4 text-sm text-[rgb(158,183,211)]">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">Rooms tracked</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {rooms.length}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">Refresh cadence</p>
                  <p className="mt-2">Updates every time room state changes.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">
                    Collaboration signal
                  </p>
                  <p className="mt-2">
                    Live room presence and workspace readiness from your
                    sessions.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
