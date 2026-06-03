// components/dashboard/room-card.tsx
import Link from "next/link";
import type { Room } from "@/types/room";
import { Card } from "@/components/ui/card";
import RoomSourceBadge from "@/components/rooms/room-source-badge";

export default function RoomCard({ room }: { room: Room }) {
  const primaryJoinCodeExpired = room.created_at
    ? new Date(room.created_at).getTime() + 5 * 60 * 1000 < Date.now()
    : false;

  return (
    <Card className="group transition-all duration-200 hover:border-white/20 hover:shadow-[0_20px_50px_rgba(0,0,0,0.30)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Active status indicator + name */}
          <div className="flex items-center gap-2">
            <span
              className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{
                background: room.source_metadata?.activated ? "rgb(42,211,139)" : "rgb(249,145,53)",
                boxShadow: room.source_metadata?.activated ? "0 0 6px rgba(42,211,139,0.5)" : "0 0 6px rgba(249,145,53,0.5)",
              }}
            />
            <h3 className="truncate text-base font-semibold text-white">
              {room.name}
            </h3>
          </div>

          {/* Slug */}
          <p className="mt-1 font-mono text-xs text-[rgb(158,183,211)]">
            {room.slug}
          </p>
        </div>

        <RoomSourceBadge sourceType={room.source_type} />
      </div>

      {/* Join code */}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2" style={primaryJoinCodeExpired ? { opacity: 0.5 } : {}}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[rgb(158,183,211)]">
            Code
          </span>
          <span className={`font-mono text-sm font-semibold tracking-[0.15em] ${primaryJoinCodeExpired ? "text-white/40 line-through select-none" : "text-white"}`}>
            {room.primary_join_code}
          </span>
        </div>
        {primaryJoinCodeExpired && (
          <span className="text-[9px] text-[rgb(255,160,170)] font-medium">Expired</span>
        )}
      </div>

      {/* Action */}
      <div className="mt-4">
        <Link
          href={`/rooms/${room.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[rgba(36,166,242,0.10)] px-3 py-1.5 text-sm font-medium text-[rgb(36,166,242)] transition-all duration-150 hover:bg-[rgba(36,166,242,0.18)] hover:text-[rgb(47,203,255)]"
        >
          Open room
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          >
            <path
              d="M4 12L12 4M12 4H6M12 4V10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </Card>
  );
}