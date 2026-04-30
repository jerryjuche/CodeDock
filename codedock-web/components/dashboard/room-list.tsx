// components/dashboard/room-list.tsx
"use client";

import Link from "next/link";
import { useRooms } from "@/hooks/use-rooms";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Skeleton from "@/components/ui/skeleton";
import RoomCard from "./room-card";

function RoomListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-8 w-full rounded-lg" />
          <Skeleton className="mt-4 h-8 w-24 rounded-lg" />
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-[rgb(158,183,211)]">
          <path
            d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M12 3V21M4 7.5L20 16.5M20 7.5L4 16.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeOpacity="0.4"
          />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-white">No rooms yet</p>
      <p className="mt-1 text-sm text-[rgb(158,183,211)]">
        Create a room to start collaborating with your team.
      </p>
      <Link href="/rooms/new" className="mt-6">
        <Button>Create your first room</Button>
      </Link>
    </Card>
  );
}

export default function RoomList() {
  const { rooms, loading, error } = useRooms();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Your Rooms</h2>
          {!loading && !error && rooms.length > 0 && (
            <p className="mt-0.5 text-sm text-[rgb(158,183,211)]">
              {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
            </p>
          )}
        </div>
        <Link href="/rooms/new">
          <Button variant="secondary" size="sm">
            New Room
          </Button>
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