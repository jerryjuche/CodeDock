// components/dashboard/room-list.tsx
"use client";

import Link from "next/link";
import { useRooms } from "@/hooks/use-rooms";
import { Card } from "@/components/ui/card";
import Skeleton from "@/components/ui/skeleton";
import RoomCard from "./room-card";

function RoomListSkeleton() {
  return (
    <div className="grid gap-4">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-4 w-36" />
          <Skeleton className="mt-4 h-4 w-20" />
        </Card>
      ))}
    </div>
  );
}

export default function RoomList() {
  const { rooms, loading, error } = useRooms();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Rooms</h2>
        <Link
          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-900"
          href="/rooms/new"
        >
          Create Room
        </Link>
      </div>

      {loading ? (
        <RoomListSkeleton />
      ) : error ? (
        <Card>
          <p className="text-sm text-[rgb(255,160,170)]">{error}</p>
          <p className="mt-2 text-xs text-[rgb(158,183,211)]">
            Refresh the page or check your connection.
          </p>
        </Card>
      ) : rooms.length === 0 ? (
        <Card>
          <div className="text-sm text-zinc-400">No rooms yet. Create one to start collaborating.</div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}