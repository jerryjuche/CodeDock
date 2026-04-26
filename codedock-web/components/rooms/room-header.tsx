"use client";

import { useRoom } from "@/hooks/use-room";
import RoomSourceBadge from "./room-source-badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/format";

export default function RoomHeader({ roomId }: { roomId: string }) {
  const { room, loading, error } = useRoom(roomId);

  if (loading) {
    return <Card>Loading room...</Card>;
  }

  if (error || !room) {
    return <Card>{error ?? "Room not found"}</Card>;
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{room.name}</h1>
          <p className="mt-2 text-sm text-zinc-400">Slug: {room.slug}</p>
          <p className="mt-1 text-sm text-zinc-400">
            Primary code: <span className="font-mono text-zinc-200">{room.primary_join_code}</span>
          </p>
          {room.updated_at && (
            <p className="mt-1 text-sm text-zinc-500">
              Updated: {formatDateTime(room.updated_at)}
            </p>
          )}
        </div>

        <RoomSourceBadge sourceType={room.source_type} />
      </div>
    </Card>
  );
}