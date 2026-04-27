import Link from "next/link";
import type { Room } from "@/types/room";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RoomCard({ room }: { room: Room }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{room.name}</h3>
          <p className="mt-1 text-sm text-zinc-400">{room.slug}</p>
        </div>
        <Badge>{room.source_type}</Badge>
      </div>
      <p className="mt-4 text-sm text-zinc-400">Primary code: {room.primary_join_code}</p>
      <Link className="mt-4 inline-block text-sm font-medium underline" href={`/rooms/${room.id}`}>
        Open room
      </Link>
    </Card>
  );
}
