import SilkHero from "@/components/backgrounds/silk-hero";
import RoomSourceBadge from "@/components/rooms/room-source-badge";
import type { RoomDetails } from "@/types/room";

export default function RoomHeader({
  details,
}: {
  details: RoomDetails;
}) {
  const { room, membership } = details;

  return (
    <section className="relative overflow-hidden rounded-[20px] border border-white/10">
      <SilkHero />

      <div className="relative z-10 flex flex-col gap-6 px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-center gap-3">
          <RoomSourceBadge sourceType={room.source_type} />
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-[rgb(234,244,255)]">
            {membership.role}
          </span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-[rgb(234,244,255)]">
            {room.is_active ? "active" : "ended"}
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {room.name}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[rgb(158,183,211)] sm:text-base">
            Manage source readiness, invites, members, and launch state for this CodeDock session.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[14px] border border-white/10 bg-white/[0.05] p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(158,183,211)]">
              Join code
            </div>
            <div className="mt-2 font-mono text-lg text-white">
              {room.primary_join_code}
            </div>
          </div>

          <div className="rounded-[14px] border border-white/10 bg-white/[0.05] p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(158,183,211)]">
              Slug
            </div>
            <div className="mt-2 text-lg text-white">{room.slug}</div>
          </div>

          <div className="rounded-[14px] border border-white/10 bg-white/[0.05] p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(158,183,211)]">
              Source
            </div>
            <div className="mt-2 text-lg text-white">{room.source_type}</div>
          </div>
        </div>
      </div>
    </section>
  );
}