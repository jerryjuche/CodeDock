"use client";

import Link from "next/link";
import { useRooms } from "@/hooks/use-rooms";
import { Card } from "@/components/ui/card";
import RoomCard from "./room-card";

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
        <Card>Loading rooms...</Card>
      ) : error ? (
        <Card>{error}</Card>
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