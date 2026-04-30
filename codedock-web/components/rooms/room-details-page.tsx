"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useRoomDetails } from "@/hooks/use-room-details";
import { useRoomPresence } from "@/hooks/use-room-presence";
import { useInvites } from "@/hooks/use-invites";
import { useAuth } from "@/hooks/use-auth";
import RoomHeader from "@/components/rooms/room-header";
import PresenceCard from "@/components/rooms/presence-card";
import SourceStateCard from "@/components/rooms/source-state-card";
import InviteList from "@/components/rooms/invite-list";
import InviteCreateForm from "@/components/rooms/invite-create-form";
import OpenInVSCodeButton from "@/components/rooms/open-in-vscode-button";
import DeleteRoomButton from "@/components/rooms/delete-room-button";
import { Button } from "@/components/ui/button";

export default function RoomDetailsPageClient({ roomId }: { roomId: string }) {
  const { userId } = useAuth();
  const { details, loading, error, reload } = useRoomDetails(roomId);
  const {
    presence,
    loading: presenceLoading,
    error: presenceError,
  } = useRoomPresence(roomId);

  const {
    invites,
    loading: invitesLoading,
    error: invitesError,
    createInvite,
    revokeInvite,
  } = useInvites(roomId);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
        <Card>Loading room details...</Card>
      </main>
    );
  }

  if (error || !details) {
    const friendly =
      error?.toLowerCase().includes("forbidden")
        ? "You no longer have access to this room."
        : error?.toLowerCase().includes("not found")
          ? "This session has ended or the room no longer exists."
          : error ?? "Room not found.";

    return (
      <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
        <Card className="text-center">
          <h1 className="text-2xl font-semibold text-white">Session ended</h1>
          <p className="mt-3 text-sm text-[rgb(158,183,211)]">{friendly}</p>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button>Back to dashboard</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const isHost =
    details.membership.role === "host" || details.room.owner_user_id === userId;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-8 sm:px-8 lg:px-10">
      <RoomHeader details={details} />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <PresenceCard
            presence={presence}
            loading={presenceLoading}
            error={presenceError}
          />

          {isHost ? (
            <>
              <InviteList
                invites={invites}
                loading={invitesLoading}
                error={invitesError}
                onRevoke={revokeInvite}
              />
              <InviteCreateForm onCreate={createInvite} />
            </>
          ) : (
            <Card>
              <h3 className="text-lg font-semibold text-white">Access</h3>
              <p className="mt-2 text-sm text-[rgb(158,183,211)]">
                You joined this room as an editor. Invite management is available only to the host.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <SourceStateCard
            sourceState={details.source_state}
            roomId={roomId}
            isHost={isHost}
            onActivated={reload}
          />
          <OpenInVSCodeButton
            roomId={roomId}
            launchAllowed={details.source_state.launch_allowed}
            launchReason={details.source_state.launch_reason}
            isHost={isHost}
          />
          {isHost ? (
            <DeleteRoomButton roomId={roomId} roomName={details.room.name} />
          ) : null}
        </div>
      </div>
    </main>
  );
}