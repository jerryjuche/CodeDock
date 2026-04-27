"use client";

import InviteCreateForm from "@/components/rooms/invite-create-form";
import InviteList from "@/components/rooms/invite-list";
import OpenInVSCodeButton from "@/components/rooms/open-in-vscode-button";
import RoomHeader from "@/components/rooms/room-header";
import SourceStateCard from "@/components/rooms/source-state-card";
import DeleteRoomButton from "@/components/rooms/delete-room-button";
import { Card } from "@/components/ui/card";
import { useRoomDetails } from "@/hooks/use-room-details";

export default function RoomDetailsPageClient({ roomId }: { roomId: string }) {
  const { details, loading, error } = useRoomDetails(roomId);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Card>Loading room details...</Card>
      </main>
    );
  }

  if (error || !details) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Card>{error ?? "Room not found"}</Card>
      </main>
    );
  }

  const isHost = details.membership.role === "host";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <RoomHeader details={details} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          {isHost ? (
            <>
              <InviteList roomId={roomId} />
              <InviteCreateForm roomId={roomId} />
            </>
          ) : (
            <Card>
              <h3 className="text-lg font-semibold">Access</h3>
              <p className="mt-2 text-sm text-zinc-400">
                You joined this room as an editor. Only hosts can create, list, or revoke invite tokens.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <SourceStateCard sourceState={details.source_state} />
          <OpenInVSCodeButton roomId={roomId} />
          {isHost ? (
            <DeleteRoomButton roomId={roomId} roomName={details.room.name} />
          ) : null}
        </div>
      </div>
    </main>
  );
}