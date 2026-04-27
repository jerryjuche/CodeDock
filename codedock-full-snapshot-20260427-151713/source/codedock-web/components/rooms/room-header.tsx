import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/format";
import type { RoomDetails } from "@/types/room";

export default function RoomHeader({ details }: { details: RoomDetails }) {
  const { room, membership } = details;

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

        <div className="flex flex-wrap gap-2">
          <Badge>{room.source_type}</Badge>
          <Badge>{membership.role}</Badge>
        </div>
      </div>
    </Card>
  );
}