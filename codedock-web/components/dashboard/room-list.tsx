// components/dashboard/room-list.tsx
"use client";

import Link from "next/link";
import { useRooms } from "@/hooks/use-rooms";
import { Button } from "@/components/ui/button";
import Skeleton from "@/components/ui/skeleton";
import RoomCard from "./room-card";

function RoomListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-[20px] border border-white/[0.07] bg-[rgba(8,30,63,0.60)] p-5"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-white/[0.12] bg-white/[0.02] py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-[rgb(100,140,185)]" aria-hidden="true">
          <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 3V21M4 7.5L20 16.5M20 7.5L4 16.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
        </svg>
      </div>
      <p className="mt-5 text-[15px] font-semibold text-white">No rooms yet</p>
      <p className="mt-1.5 max-w-xs text-sm text-[rgb(100,140,185)]">
        Create a room to start collaborating with your team inside VS Code.
      </p>
      <Link href="/rooms/new" className="mt-7">
        <Button>
          <svg viewBox="0 0 16 16" fill="none" className="mr-2 h-3.5 w-3.5" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          Create your first room
        </Button>
      </Link>
    </div>
  );
}

export default function RoomList() {
  const { rooms, loading, error } = useRooms();

  const activeCount = rooms.filter((r) => r.is_active).length;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-lg font-bold text-white">Your Rooms</h2>
            {!loading && !error && rooms.length > 0 && (
              <span className="rounded-full bg-[rgba(36,166,242,0.14)] px-2 py-0.5 text-[11px] font-semibold text-[rgb(36,166,242)]">
                {rooms.length}
              </span>
            )}
          </div>
          {!loading && !error && rooms.length > 0 && activeCount > 0 && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-[rgb(42,211,139)]"
                style={{ boxShadow: "0 0 5px rgba(42,211,139,0.6)" }}
              />
              <span className="text-[12px] text-[rgb(42,211,139)]">
                {activeCount} active
              </span>
            </div>
          )}
        </div>

        {/* Filter chips */}
        {!loading && rooms.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-[rgb(100,140,185)]">
              All
            </span>
            <span className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-[rgb(100,140,185)] hover:bg-white/[0.04] cursor-pointer transition-colors">
              Active
            </span>
          </div>
        )}

        <Link href="/rooms/new">
          <Button variant="secondary" size="sm">
            <svg viewBox="0 0 16 16" fill="none" className="mr-1.5 h-3.5 w-3.5" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            New Room
          </Button>
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <RoomListSkeleton />
      ) : error ? (
        <div className="rounded-[18px] border border-[rgba(255,90,107,0.2)] bg-[rgba(255,90,107,0.06)] p-5">
          <p className="text-sm text-[rgb(255,160,170)]">{error}</p>
          <p className="mt-1.5 text-xs text-[rgb(100,140,185)]">
            Refresh the page or check your connection.
          </p>
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
